import {
  PlanSchemaVersion,
  PlanStepType,
  type AgentOSError,
  type AgentOSMetadata,
  type PlanValidationIssue,
  type PlanValidationResult,
} from "@agentos/types";
import { redactMetadata, redactSecretValue } from "./credential-resolver";

export interface PlanValidatorOptions {
  maxSteps?: number;
  maxStringLength?: number;
  maxMetadataBytes?: number;
  maxPlanBytes?: number;
  supportedSchemaVersions?: string[];
}

const DEFAULT_MAX_STEPS = 20;
const DEFAULT_MAX_STRING_LENGTH = 4000;
const DEFAULT_MAX_METADATA_BYTES = 8192;
const DEFAULT_MAX_PLAN_BYTES = 128 * 1024;
const VALID_STEP_TYPES = new Set(Object.values(PlanStepType));
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const FORBIDDEN_MODEL_FIELDS = new Set([
  "execute",
  "registryMutation",
  "memoryMutation",
  "toolOutput",
  "toolResult",
  "systemPrompt",
]);
const FORBIDDEN_METADATA_FIELDS = new Set([
  "executionId",
  "toolCallId",
  "toolOutput",
  "toolResult",
  "registryMutation",
  "memoryMutation",
  "execute",
]);
const SAFE_IDENTIFIER_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const CAPABILITY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;

export class PlanValidator {
  private readonly options: Required<PlanValidatorOptions>;

  constructor(options: PlanValidatorOptions = {}) {
    this.options = {
      maxSteps: options.maxSteps ?? DEFAULT_MAX_STEPS,
      maxStringLength: options.maxStringLength ?? DEFAULT_MAX_STRING_LENGTH,
      maxMetadataBytes: options.maxMetadataBytes ?? DEFAULT_MAX_METADATA_BYTES,
      maxPlanBytes: options.maxPlanBytes ?? DEFAULT_MAX_PLAN_BYTES,
      supportedSchemaVersions: options.supportedSchemaVersions ?? [PlanSchemaVersion.V1],
    };
  }

  validate(plan: unknown): PlanValidationResult {
    const startedAt = Date.now();
    const issues: PlanValidationIssue[] = [];

    if (!isPlainObject(plan)) {
      issues.push(
        createIssue(
          "plan_missing",
          "Plan must be a plain object.",
          "error",
          "$",
          summarizeOffendingValue(plan)
        )
      );

      return createResult(issues, startedAt);
    }

    const planRecord = plan as Record<string, unknown>;
    const schemaVersion = readSchemaVersion(planRecord.metadata);

    if (!schemaVersion) {
      issues.push(
        createIssue(
          "plan_schema_version_missing",
          "Plan metadata must include a schemaVersion.",
          "warning",
          "$.metadata.schemaVersion"
        )
      );
    } else if (!this.options.supportedSchemaVersions.includes(schemaVersion)) {
      issues.push(
        createIssue(
          "plan_schema_version_unsupported",
          `Plan schema version "${schemaVersion}" is not supported.`,
          "error",
          "$.metadata.schemaVersion",
          schemaVersion
        )
      );
    }

    validateString(planRecord.taskId, "$.taskId", "plan_missing_task_id", issues, {
      nonEmpty: true,
      pattern: SAFE_IDENTIFIER_PATTERN,
      invalidCode: "plan_invalid_task_id",
    });

    if (!Array.isArray(planRecord.steps)) {
      issues.push(
        createIssue(
          "plan_steps_missing",
          "Plan must include a steps array.",
          "error",
          "$.steps",
          summarizeOffendingValue(planRecord.steps)
        )
      );
    } else {
      validateSteps(planRecord.steps, issues, this.options);
    }

    validateMetadata(planRecord.metadata, "$.metadata", issues, this.options);
    scanForUnsafeFields(planRecord.metadata, "$.metadata", issues);
    scanForUnsafeFields(planRecord.steps, "$.steps", issues);
    validateTotalSize(planRecord, issues, this.options);

    return createResult(issues, startedAt, {
      schemaVersion,
      stepCount: Array.isArray(planRecord.steps) ? planRecord.steps.length : 0,
    });
  }
}

export function createPlanValidator(options?: PlanValidatorOptions): PlanValidator {
  return new PlanValidator(options);
}

function validateSteps(
  steps: unknown[],
  issues: PlanValidationIssue[],
  options: Required<PlanValidatorOptions>
): void {
  if (steps.length === 0) {
    issues.push(
      createIssue("plan_steps_empty", "Plan must include at least one step.", "error", "$.steps")
    );
  }

  if (steps.length > options.maxSteps) {
    issues.push(
      createIssue(
        "plan_steps_excessive",
        `Plan includes ${steps.length} steps, exceeding the maximum of ${options.maxSteps}.`,
        "error",
        "$.steps.length",
        steps.length
      )
    );
  }

  const ids = new Set<string>();

  steps.forEach((step, index) => {
    const path = `$.steps[${index}]`;

    if (!isPlainObject(step)) {
      issues.push(
        createIssue(
          "plan_step_invalid",
          "Plan step must be a plain object.",
          "error",
          path,
          summarizeOffendingValue(step)
        )
      );
      return;
    }

    const record = step as Record<string, unknown>;

    validateString(record.id, `${path}.id`, "plan_step_missing_id", issues, {
      nonEmpty: true,
      pattern: SAFE_IDENTIFIER_PATTERN,
      invalidCode: "plan_step_invalid_id",
    });

    if (typeof record.id === "string") {
      if (ids.has(record.id)) {
        issues.push(
          createIssue(
            "plan_step_duplicate_id",
            `Plan step id "${record.id}" is duplicated.`,
            "error",
            `${path}.id`,
            record.id
          )
        );
      }

      ids.add(record.id);
    }

    if (record.order !== index + 1) {
      issues.push(
        createIssue(
          "plan_step_order_invalid",
          `Plan step order must be ${index + 1}.`,
          "error",
          `${path}.order`,
          record.order
        )
      );
    }

    validateString(
      record.description,
      `${path}.description`,
      "plan_step_missing_description",
      issues,
      {
        nonEmpty: true,
        invalidCode: "plan_step_description_invalid",
        maxLength: options.maxStringLength,
      }
    );

    if (typeof record.type !== "string" || !VALID_STEP_TYPES.has(record.type as PlanStepType)) {
      issues.push(
        createIssue(
          "plan_step_type_invalid",
          "Plan step type is not supported.",
          "error",
          `${path}.type`,
          summarizeOffendingValue(record.type)
        )
      );
    }

    if (record.requiredTool !== undefined) {
      validateString(
        record.requiredTool,
        `${path}.requiredTool`,
        "plan_step_tool_invalid",
        issues,
        {
          nonEmpty: true,
          pattern: SAFE_IDENTIFIER_PATTERN,
          invalidCode: "plan_step_tool_invalid",
        }
      );
    }

    const requiredCapability = isPlainObject(record.metadata)
      ? (record.metadata as Record<string, unknown>).requiredCapability
      : undefined;

    if (requiredCapability !== undefined) {
      validateString(
        requiredCapability,
        `${path}.metadata.requiredCapability`,
        "plan_step_capability_invalid",
        issues,
        {
          nonEmpty: true,
          pattern: CAPABILITY_PATTERN,
          invalidCode: "plan_step_capability_invalid",
        }
      );
    }

    if (record.input !== undefined && !isPlainObject(record.input)) {
      issues.push(
        createIssue(
          "plan_step_input_invalid",
          "Plan step input must be a plain object when provided.",
          "error",
          `${path}.input`,
          summarizeOffendingValue(record.input)
        )
      );
    }

    if (record.output !== undefined || record.error !== undefined) {
      issues.push(
        createIssue(
          "plan_step_execution_state_forbidden",
          "Model-generated plans must not include execution output or errors.",
          "error",
          path
        )
      );
    }

    validateMetadata(record.metadata, `${path}.metadata`, issues, options);
  });
}

function validateString(
  value: unknown,
  path: string,
  missingCode: string,
  issues: PlanValidationIssue[],
  options: {
    nonEmpty?: boolean;
    pattern?: RegExp;
    invalidCode: string;
    maxLength?: number;
  }
): void {
  if (typeof value !== "string") {
    issues.push(
      createIssue(
        missingCode,
        "Expected a string value.",
        "error",
        path,
        summarizeOffendingValue(value)
      )
    );
    return;
  }

  if (options.nonEmpty && !value.trim()) {
    issues.push(createIssue(missingCode, "Value must not be empty.", "error", path, value));
  }

  if (options.maxLength !== undefined && value.length > options.maxLength) {
    issues.push(
      createIssue(
        "plan_string_too_long",
        `String exceeds maximum length of ${options.maxLength}.`,
        "error",
        path,
        summarizeOffendingValue(value)
      )
    );
  }

  if (options.pattern && !options.pattern.test(value)) {
    issues.push(
      createIssue(
        options.invalidCode,
        "String contains unsupported characters.",
        "error",
        path,
        value
      )
    );
  }
}

function validateMetadata(
  metadata: unknown,
  path: string,
  issues: PlanValidationIssue[],
  options: Required<PlanValidatorOptions>
): void {
  if (metadata === undefined) {
    return;
  }

  if (!isPlainObject(metadata)) {
    issues.push(
      createIssue(
        "plan_metadata_invalid",
        "Metadata must be a plain object.",
        "error",
        path,
        summarizeOffendingValue(metadata)
      )
    );
    return;
  }

  for (const key of Object.keys(metadata)) {
    if (FORBIDDEN_METADATA_FIELDS.has(key)) {
      issues.push(
        createIssue(
          "plan_metadata_forbidden_field",
          `Metadata field "${key}" is not allowed before execution.`,
          "error",
          `${path}.${key}`
        )
      );
    }
  }

  const size = safeJsonSize(metadata);

  if (size > options.maxMetadataBytes) {
    issues.push(
      createIssue(
        "plan_metadata_too_large",
        `Metadata exceeds ${options.maxMetadataBytes} bytes.`,
        "error",
        path,
        { bytes: size }
      )
    );
  }
}

function validateTotalSize(
  plan: Record<string, unknown>,
  issues: PlanValidationIssue[],
  options: Required<PlanValidatorOptions>
): void {
  const size = safeJsonSize(plan);

  if (size > options.maxPlanBytes) {
    issues.push(
      createIssue("plan_too_large", `Plan exceeds ${options.maxPlanBytes} bytes.`, "error", "$", {
        bytes: size,
      })
    );
  }
}

function scanForUnsafeFields(
  value: unknown,
  path: string,
  issues: PlanValidationIssue[],
  seen = new WeakSet<object>()
): void {
  if (!value || typeof value !== "object") {
    return;
  }

  if (seen.has(value)) {
    return;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForUnsafeFields(entry, `${path}[${index}]`, issues, seen));
    return;
  }

  const record = value as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    const keyPath = `${path}.${key}`;

    if (DANGEROUS_KEYS.has(key)) {
      issues.push(
        createIssue(
          "plan_dangerous_key",
          `Dangerous key "${key}" is not allowed.`,
          "error",
          keyPath
        )
      );
      continue;
    }

    if (FORBIDDEN_MODEL_FIELDS.has(key)) {
      issues.push(
        createIssue(
          "plan_forbidden_field",
          `Field "${key}" is not allowed in model-generated plan data.`,
          "error",
          keyPath
        )
      );
    }

    scanForUnsafeFields(record[key], keyPath, issues, seen);
  }
}

function readSchemaVersion(metadata: unknown): string | undefined {
  if (!isPlainObject(metadata)) {
    return undefined;
  }

  const schemaVersion = metadata.schemaVersion;

  return typeof schemaVersion === "string" ? schemaVersion : undefined;
}

function createResult(
  issues: PlanValidationIssue[],
  startedAt: number,
  metadata: AgentOSMetadata = {}
): PlanValidationResult {
  const errors = issues
    .filter((issue) => issue.severity === "error")
    .map((issue) => issueToError(issue));

  return {
    valid: errors.length === 0,
    errors,
    warnings: issues.filter((issue) => issue.severity === "warning").map((issue) => issue.message),
    issues,
    metadata: {
      ...metadata,
      validationDurationMs: Date.now() - startedAt,
      issueCount: issues.length,
    },
  };
}

function issueToError(issue: PlanValidationIssue): AgentOSError {
  return {
    code: issue.code,
    message: issue.message,
    recoverable: true,
    metadata: {
      path: issue.path,
      offendingValue: issue.offendingValue,
      ...issue.metadata,
    },
  };
}

function createIssue(
  code: string,
  message: string,
  severity: "error" | "warning",
  path: string,
  offendingValue?: unknown,
  metadata?: AgentOSMetadata
): PlanValidationIssue {
  return {
    code,
    message,
    severity,
    path,
    offendingValue: redactOffendingValue(offendingValue),
    metadata: redactMetadata(metadata),
  };
}

function redactOffendingValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactSecretValue(value).slice(0, 200);
  }

  if (isPlainObject(value)) {
    return redactMetadata(value as AgentOSMetadata);
  }

  return value;
}

function summarizeOffendingValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.length > 200
      ? `${redactSecretValue(value.slice(0, 200))}...`
      : redactSecretValue(value);
  }

  if (Array.isArray(value)) {
    return {
      type: "array",
      length: value.length,
    };
  }

  if (value && typeof value === "object") {
    return {
      type: "object",
      keys: Object.keys(value).slice(0, 20),
    };
  }

  return value;
}

function safeJsonSize(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}
