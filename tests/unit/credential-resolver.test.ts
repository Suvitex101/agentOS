import { describe, expect, it } from "vitest";
import {
  CredentialResolver,
  CredentialType,
  redactCredentialReference,
  redactMetadata,
  redactSecretValue,
  validateCredentialReference,
} from "@agentosdev/sdk";

describe("CredentialResolver", () => {
  it("resolves environment credentials without exposing the value in the reference", () => {
    const resolver = new CredentialResolver({
      environment: {
        MODEL_API_KEY: "sk-env-secret",
      },
    });
    const result = resolver.resolve({
      type: CredentialType.Environment,
      name: "MODEL_API_KEY",
    });

    expect(result.success).toBe(true);
    expect(result.credential?.value).toBe("sk-env-secret");
    expect(result.credential?.source).toBe("env:MODEL_API_KEY");
    expect(result.reference).toEqual({
      type: CredentialType.Environment,
      name: "MODEL_API_KEY",
      redacted: true,
      metadata: undefined,
    });
    expect(JSON.stringify(result.reference)).not.toContain("sk-env-secret");
  });

  it("returns typed errors for missing environment credentials", () => {
    const resolver = new CredentialResolver({
      environment: {},
    });
    const result = resolver.resolve({
      type: CredentialType.Environment,
      name: "MISSING_API_KEY",
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual([
      expect.objectContaining({
        code: "credential_environment_missing",
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain("MISSING_SECRET_VALUE");
  });

  it("resolves static credentials with a development-only warning", () => {
    const resolver = new CredentialResolver();
    const result = resolver.resolve({
      type: CredentialType.Static,
      value: "sk-static-secret",
    });

    expect(result.success).toBe(true);
    expect(result.credential?.value).toBe("sk-static-secret");
    expect(result.reference).toMatchObject({
      type: CredentialType.Static,
      redacted: true,
      developmentOnly: true,
    });
    expect(result.warnings.map((warning) => warning.code)).toContain(
      "credential_static_development_only"
    );
    expect(JSON.stringify(result.reference)).not.toContain("sk-static-secret");
  });

  it("can disable static credentials", () => {
    const resolver = new CredentialResolver({
      allowStaticCredentials: false,
    });
    const result = resolver.resolve({
      type: CredentialType.Static,
      value: "sk-static-secret",
    });

    expect(result.success).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain("credential_static_disabled");
  });

  it("validates unsupported and invalid references", () => {
    expect(
      validateCredentialReference({
        type: "future-vault",
        path: "secret/model",
      })
    ).toMatchObject({
      valid: false,
      errors: [
        expect.objectContaining({
          code: "credential_unsupported_type",
        }),
      ],
    });

    expect(
      validateCredentialReference({
        type: CredentialType.Environment,
        name: "",
      })
    ).toMatchObject({
      valid: false,
      errors: [
        expect.objectContaining({
          code: "credential_environment_missing_name",
        }),
      ],
    });
  });

  it("redacts credential references and metadata", () => {
    const reference = redactCredentialReference({
      type: CredentialType.Static,
      value: "sk-static-secret",
      metadata: {
        apiKey: "sk-nested-secret",
      },
    });
    const metadata = redactMetadata({
      authorization: "Bearer sk-token",
      nested: {
        token: "secret-value",
      },
      message: "Use Bearer sk-message-secret",
    });

    expect(JSON.stringify(reference)).not.toContain("sk-static-secret");
    expect(metadata).toEqual({
      authorization: "[redacted]",
      nested: {
        token: "[redacted]",
      },
      message: "Use Bearer [redacted]",
    });
    expect(redactSecretValue("Bearer sk-direct-secret")).toBe("Bearer [redacted]");
  });
});
