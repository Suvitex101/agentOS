import {
  CredentialType,
  type AgentOSError,
  type AgentOSMetadata,
  type CredentialReference,
  type CredentialReferenceSummary,
  type CredentialResolutionResult,
  type CredentialValidationResult,
  type CredentialResolver as CredentialResolverContract,
  type ResolvedCredential,
} from "@agentosdev/types";

export interface CredentialResolverOptions {
  environment?: Record<string, string | undefined>;
  allowStaticCredentials?: boolean;
}

const SENSITIVE_KEY_PATTERN = /(api[_-]?key|authorization|credential|password|secret|token|value)/i;

export class CredentialResolver implements CredentialResolverContract {
  private readonly environment: Record<string, string | undefined>;
  private readonly allowStaticCredentials: boolean;

  constructor(options: CredentialResolverOptions = {}) {
    this.environment = options.environment ?? readProcessEnvironment();
    this.allowStaticCredentials = options.allowStaticCredentials ?? true;
  }

  resolve(reference: CredentialReference): CredentialResolutionResult {
    const validation = this.validateReference(reference);

    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors,
        warnings: validation.warnings,
        reference: this.inspectReference(reference),
      };
    }

    if (isEnvironmentCredentialReference(reference)) {
      const value = this.environment[reference.name];

      if (!value) {
        return {
          success: false,
          errors: [
            createCredentialError(
              "credential_environment_missing",
              `Environment credential "${reference.name}" is not available.`,
              {
                type: reference.type,
                name: reference.name,
              }
            ),
          ],
          warnings: validation.warnings,
          reference: this.inspectReference(reference),
        };
      }

      return createSuccessfulResolution(
        {
          type: reference.type,
          value,
          source: `env:${reference.name}`,
          metadata: redactMetadata(reference.metadata),
        },
        validation.warnings,
        this.inspectReference(reference)
      );
    }

    if (isStaticCredentialReference(reference)) {
      return createSuccessfulResolution(
        {
          type: reference.type,
          value: reference.value,
          source: "static",
          metadata: redactMetadata(reference.metadata),
        },
        validation.warnings,
        this.inspectReference(reference)
      );
    }

    return {
      success: false,
      errors: [
        createCredentialError("credential_unsupported_type", "Unsupported credential type.", {
          type: reference.type,
        }),
      ],
      warnings: validation.warnings,
      reference: this.inspectReference(reference),
    };
  }

  validateReference(reference: CredentialReference): CredentialValidationResult {
    const errors: AgentOSError[] = [];
    const warnings: AgentOSError[] = [];

    if (!reference || typeof reference !== "object") {
      errors.push(
        createCredentialError("credential_invalid_reference", "Credential reference is invalid.")
      );
    } else if (!("type" in reference) || typeof reference.type !== "string") {
      errors.push(
        createCredentialError("credential_missing_type", "Credential reference type is required.")
      );
    } else if (isEnvironmentCredentialReference(reference)) {
      if (!reference.name?.trim()) {
        errors.push(
          createCredentialError(
            "credential_environment_missing_name",
            "Environment credential name is required."
          )
        );
      }
    } else if (isStaticCredentialReference(reference)) {
      if (!this.allowStaticCredentials) {
        errors.push(
          createCredentialError(
            "credential_static_disabled",
            "Static credentials are disabled by this resolver."
          )
        );
      }

      if (!reference.value) {
        errors.push(
          createCredentialError(
            "credential_static_missing_value",
            "Static credential value is required."
          )
        );
      }

      warnings.push(
        createCredentialError(
          "credential_static_development_only",
          "Static credentials are intended for development and testing only.",
          {
            type: reference.type,
          },
          false
        )
      );
    } else {
      errors.push(
        createCredentialError("credential_unsupported_type", "Unsupported credential type.", {
          type: reference.type,
        })
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      reference:
        reference && typeof reference === "object" ? this.inspectReference(reference) : undefined,
    };
  }

  inspectReference(reference: CredentialReference): CredentialReferenceSummary {
    if (isEnvironmentCredentialReference(reference)) {
      return Object.freeze({
        type: reference.type,
        name: reference.name,
        redacted: true,
        metadata: redactMetadata(reference.metadata),
      });
    }

    if (isStaticCredentialReference(reference)) {
      return Object.freeze({
        type: reference.type,
        redacted: true,
        developmentOnly: reference.developmentOnly ?? true,
        metadata: redactMetadata(reference.metadata),
      });
    }

    return Object.freeze({
      type: reference.type,
      redacted: true,
    });
  }
}

function isEnvironmentCredentialReference(
  reference: CredentialReference
): reference is Extract<CredentialReference, { type: typeof CredentialType.Environment }> {
  return (
    reference &&
    typeof reference === "object" &&
    reference.type === CredentialType.Environment &&
    "name" in reference
  );
}

function isStaticCredentialReference(
  reference: CredentialReference
): reference is Extract<CredentialReference, { type: typeof CredentialType.Static }> {
  return (
    reference &&
    typeof reference === "object" &&
    reference.type === CredentialType.Static &&
    "value" in reference
  );
}

function readProcessEnvironment(): Record<string, string | undefined> {
  const maybeProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process;

  return maybeProcess?.env ?? {};
}

export function validateCredentialReference(
  reference: CredentialReference,
  options?: CredentialResolverOptions
): CredentialValidationResult {
  return new CredentialResolver(options).validateReference(reference);
}

export function redactCredentialReference(
  reference: CredentialReference | undefined
): CredentialReferenceSummary | undefined {
  return reference ? new CredentialResolver().inspectReference(reference) : undefined;
}

export function redactSecretValue(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\b(?:sk|pk|rk|ghp|gho|github_pat)-[A-Za-z0-9_-]+\b/g, "[redacted]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[redacted]");
}

export function redactMetadata(metadata: AgentOSMetadata | undefined): AgentOSMetadata | undefined {
  if (!metadata) {
    return undefined;
  }

  const output: AgentOSMetadata = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      output[key] = "[redacted]";
    } else if (typeof value === "string") {
      output[key] = redactSecretValue(value);
    } else if (Array.isArray(value)) {
      output[key] = value.map((item) =>
        typeof item === "string"
          ? redactSecretValue(item)
          : item && typeof item === "object"
            ? redactMetadata(item as AgentOSMetadata)
            : item
      );
    } else if (value && typeof value === "object") {
      output[key] = redactMetadata(value as AgentOSMetadata);
    } else {
      output[key] = value;
    }
  }

  return output;
}

function createSuccessfulResolution(
  credential: ResolvedCredential,
  warnings: AgentOSError[],
  reference: CredentialReferenceSummary
): CredentialResolutionResult {
  return {
    success: true,
    credential,
    errors: [],
    warnings,
    reference,
  };
}

function createCredentialError(
  code: string,
  message: string,
  metadata?: AgentOSMetadata,
  recoverable = true
): AgentOSError {
  return {
    code,
    message: redactSecretValue(message),
    recoverable,
    metadata: redactMetadata(metadata),
  };
}
