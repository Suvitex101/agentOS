import {
  ToolCategory,
  ToolPermissionLevel,
  ToolVisibility,
  type AgentOSError,
  type AgentOSJSONSchema,
  type AgentOSMetadata,
  type AgentPermission,
  type ExecutionContext,
  type RegisteredTool,
  type ToolAuthor,
  type ToolExample,
  type ToolExecutionResult,
} from "@agentosdev/types";

export interface ToolExecutionContext<Input = unknown> {
  input: Input;
  executionContext: ExecutionContext;
  tool: ToolDefinition<Input>;
  metadata?: AgentOSMetadata;
}

export interface ToolDefinitionConfig<Input = unknown, Output = unknown> {
  id: string;
  name: string;
  description: string;
  version?: string;
  capability: string;
  capabilityIds?: string[];
  category?: ToolCategory;
  author?: ToolAuthor;
  tags?: string[];
  examples?: ToolExample<Input, Output>[];
  permissions?: AgentPermission[];
  permissionLevel?: ToolPermissionLevel;
  visibility?: ToolVisibility;
  inputSchema?: AgentOSJSONSchema;
  outputSchema?: AgentOSJSONSchema;
  metadata?: AgentOSMetadata;
  execute: (
    context: ToolExecutionContext<Input>
  ) => Promise<ToolExecutionResult<Output>> | ToolExecutionResult<Output>;
}

export interface ToolDefinition<Input = unknown, Output = unknown> extends RegisteredTool<
  Input,
  Output
> {
  inspect(): ToolInspection;
  summary(): ToolSummary;
}

export interface ToolInspection {
  id: string;
  name: string;
  description: string;
  version: string;
  capability: string;
  capabilityIds: string[];
  category: ToolCategory;
  author?: ToolAuthor;
  tags: string[];
  examples: ToolExample[];
  permissions: AgentPermission[];
  permissionLevel: ToolPermissionLevel;
  visibility: ToolVisibility;
  inputSchema: AgentOSJSONSchema;
  outputSchema: AgentOSJSONSchema;
  executionSignature: "execute(context)";
  metadata?: AgentOSMetadata;
}

export interface ToolSummary {
  id: string;
  name: string;
  description: string;
  version: string;
  capability: string;
  category: ToolCategory;
  tags: string[];
  visibility: ToolVisibility;
}

export interface ToolDefinitionValidationOptions {
  existingIds?: string[];
}

export interface ToolDefinitionValidationResult {
  valid: boolean;
  errors: AgentOSError[];
}

export class ToolDefinitionValidationError extends Error {
  readonly errors: AgentOSError[];

  constructor(errors: AgentOSError[]) {
    super(errors.map((error) => error.message).join(" "));
    this.name = "ToolDefinitionValidationError";
    this.errors = errors;
  }
}

type ToolHelperConfig<Input = unknown, Output = unknown> = Omit<
  ToolDefinitionConfig<Input, Output>,
  "capability" | "category"
> &
  Partial<Pick<ToolDefinitionConfig<Input, Output>, "capability" | "category">>;

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

export function defineTool<Input = unknown, Output = unknown>(
  config: ToolDefinitionConfig<Input, Output>
): ToolDefinition<Input, Output> {
  const validation = validateToolDefinitionConfig(config);

  if (!validation.valid) {
    throw new ToolDefinitionValidationError(validation.errors);
  }

  const version = config.version ?? "0.1.0";
  const category = config.category ?? ToolCategory.Custom;
  const capabilityIds = Object.freeze([...(config.capabilityIds ?? [config.capability])]);
  const tags = Object.freeze([...(config.tags ?? [])]);
  const examples = Object.freeze([...(config.examples ?? [])]);
  const permissions = Object.freeze([...(config.permissions ?? [])]);
  const visibility = config.visibility ?? ToolVisibility.Private;
  const permissionLevel = config.permissionLevel ?? ToolPermissionLevel.Read;
  const inputSchema = config.inputSchema ?? { type: "object" };
  const outputSchema = config.outputSchema ?? { type: "object" };

  const tool: ToolDefinition<Input, Output> = Object.freeze({
    id: config.id,
    name: config.name,
    description: config.description,
    version,
    capability: config.capability,
    category,
    author: config.author,
    tags: tags as string[],
    examples: examples as ToolExample<Input, Output>[],
    permissions: permissions as AgentPermission[],
    visibility,
    inputSchema,
    outputSchema,
    permissionLevel,
    capabilityIds: capabilityIds as string[],
    metadata: config.metadata,
    execute(
      input: Input,
      executionContext: ExecutionContext
    ): Promise<ToolExecutionResult<Output>> | ToolExecutionResult<Output> {
      return config.execute({
        input,
        executionContext,
        tool,
        metadata: config.metadata,
      });
    },
    inspect() {
      return {
        id: config.id,
        name: config.name,
        description: config.description,
        version,
        capability: config.capability,
        capabilityIds: [...capabilityIds],
        category,
        author: config.author,
        tags: [...tags],
        examples: [...examples],
        permissions: [...permissions],
        permissionLevel,
        visibility,
        inputSchema,
        outputSchema,
        executionSignature: "execute(context)" as const,
        metadata: config.metadata,
      };
    },
    summary() {
      return {
        id: config.id,
        name: config.name,
        description: config.description,
        version,
        capability: config.capability,
        category,
        tags: [...tags],
        visibility,
      };
    },
  });

  return tool;
}

export function defineMessagingTool<Input = unknown, Output = unknown>(
  config: ToolHelperConfig<Input, Output>
): ToolDefinition<Input, Output> {
  return defineTool({
    ...config,
    capability: config.capability ?? "messaging",
    category: config.category ?? ToolCategory.Communication,
  });
}

export function defineResearchTool<Input = unknown, Output = unknown>(
  config: ToolHelperConfig<Input, Output>
): ToolDefinition<Input, Output> {
  return defineTool({
    ...config,
    capability: config.capability ?? "research",
    category: config.category ?? ToolCategory.Research,
  });
}

export function defineBusinessTool<Input = unknown, Output = unknown>(
  config: ToolHelperConfig<Input, Output>
): ToolDefinition<Input, Output> {
  return defineTool({
    ...config,
    capability: config.capability ?? "business",
    category: config.category ?? ToolCategory.Productivity,
  });
}

export function validateToolDefinitionConfig<Input = unknown, Output = unknown>(
  config: Partial<ToolDefinitionConfig<Input, Output>>,
  options: ToolDefinitionValidationOptions = {}
): ToolDefinitionValidationResult {
  const errors: AgentOSError[] = [];

  if (!config.id?.trim()) {
    errors.push(createValidationError("tool_missing_id", "Tool id is required."));
  } else if (options.existingIds?.includes(config.id)) {
    errors.push(
      createValidationError("tool_duplicate_id", `Tool id "${config.id}" is already registered.`)
    );
  }

  if (!config.name?.trim()) {
    errors.push(createValidationError("tool_missing_name", "Tool name is required."));
  }

  if (!config.capability?.trim()) {
    errors.push(createValidationError("tool_missing_capability", "Tool capability is required."));
  }

  if (!config.execute) {
    errors.push(
      createValidationError("tool_missing_execute", "Tool execute function is required.")
    );
  }

  if (config.version && !SEMVER_PATTERN.test(config.version)) {
    errors.push(
      createValidationError(
        "tool_invalid_version",
        `Tool version "${config.version}" must use x.y.z semantic version format.`
      )
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function createValidationError(code: string, message: string): AgentOSError {
  return {
    code,
    message,
    recoverable: true,
  };
}
