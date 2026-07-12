import {
  ModelFinishReason,
  ModelProviderCapability,
  type AgentOSError,
  type AgentOSMetadata,
  type ModelGenerationRequest,
  type ModelGenerationResponse,
  type ModelProvider,
  type ToolAuthor,
} from "@agentosdev/types";

export interface ModelProviderGenerationContext {
  request: ModelGenerationRequest;
  provider: ModelProviderDefinition;
  metadata?: AgentOSMetadata;
}

export interface ModelProviderDefinitionConfig {
  id: string;
  name: string;
  description?: string;
  version: string;
  author?: ToolAuthor;
  tags?: string[];
  metadata?: AgentOSMetadata;
  capabilities?: ModelProviderCapability[];
  generate: (
    request: ModelGenerationRequest
  ) => Promise<ModelGenerationResponse> | ModelGenerationResponse;
}

export interface ModelProviderDefinition extends ModelProvider {
  tags: string[];
  capabilities: ModelProviderCapability[];
  inspect(): ModelProviderInspection;
  summary(): ModelProviderSummary;
}

export interface ModelProviderInspection {
  id: string;
  name: string;
  description?: string;
  version: string;
  author?: ToolAuthor;
  tags: string[];
  capabilities: ModelProviderCapability[];
  generationSignature: "generate(request)";
  metadata?: AgentOSMetadata;
}

export interface ModelProviderSummary {
  id: string;
  name: string;
  description?: string;
  version: string;
  capabilities: ModelProviderCapability[];
  tags: string[];
}

export interface ModelProviderDefinitionValidationOptions {
  existingIds?: string[];
}

export interface ModelProviderDefinitionValidationResult {
  valid: boolean;
  errors: AgentOSError[];
}

export class ModelProviderDefinitionValidationError extends Error {
  readonly errors: AgentOSError[];

  constructor(errors: AgentOSError[]) {
    super(errors.map((error) => error.message).join(" "));
    this.name = "ModelProviderDefinitionValidationError";
    this.errors = errors;
  }
}

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

export function defineModelProvider(
  config: ModelProviderDefinitionConfig
): ModelProviderDefinition {
  const validation = validateModelProviderDefinitionConfig(config);

  if (!validation.valid) {
    throw new ModelProviderDefinitionValidationError(validation.errors);
  }

  const tags = Object.freeze([...(config.tags ?? [])]);
  const capabilities = Object.freeze([...(config.capabilities ?? ["generation"])]);

  const provider: ModelProviderDefinition = Object.freeze({
    id: config.id,
    name: config.name,
    description: config.description,
    version: config.version,
    author: config.author,
    tags: tags as string[],
    metadata: config.metadata,
    capabilities: capabilities as string[],
    async generate(request: ModelGenerationRequest): Promise<ModelGenerationResponse> {
      const startedAt = Date.now();
      const response = await config.generate(request);

      return normalizeModelGenerationResponse(response, {
        providerId: config.id,
        durationMs: Date.now() - startedAt,
      });
    },
    inspect() {
      return {
        id: config.id,
        name: config.name,
        description: config.description,
        version: config.version,
        author: config.author,
        tags: [...tags],
        capabilities: [...capabilities],
        generationSignature: "generate(request)" as const,
        metadata: config.metadata,
      };
    },
    summary() {
      return {
        id: config.id,
        name: config.name,
        description: config.description,
        version: config.version,
        capabilities: [...capabilities],
        tags: [...tags],
      };
    },
  });

  return provider;
}

export function validateModelProviderDefinitionConfig(
  config: Partial<ModelProviderDefinitionConfig>,
  options: ModelProviderDefinitionValidationOptions = {}
): ModelProviderDefinitionValidationResult {
  const errors: AgentOSError[] = [];

  if (!config.id?.trim()) {
    errors.push(
      createValidationError("model_provider_missing_id", "Model provider id is required.")
    );
  } else if (options.existingIds?.includes(config.id)) {
    errors.push(
      createValidationError(
        "model_provider_duplicate_id",
        `Model provider id "${config.id}" is already registered.`
      )
    );
  }

  if (!config.name?.trim()) {
    errors.push(
      createValidationError("model_provider_missing_name", "Model provider name is required.")
    );
  }

  if (!config.version?.trim()) {
    errors.push(
      createValidationError("model_provider_missing_version", "Model provider version is required.")
    );
  } else if (!SEMVER_PATTERN.test(config.version)) {
    errors.push(
      createValidationError(
        "model_provider_invalid_version",
        `Model provider version "${config.version}" must use x.y.z semantic version format.`
      )
    );
  }

  if (!config.generate) {
    errors.push(
      createValidationError(
        "model_provider_missing_generate",
        "Model provider generate function is required."
      )
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export const MockModelProvider = defineModelProvider({
  id: "mock",
  name: "Mock Provider",
  description: "Deterministic local provider for tests and examples.",
  version: "1.0.0",
  capabilities: [ModelProviderCapability.TextGeneration, "generation", "testing"],
  tags: ["mock", "local"],
  generate(request) {
    return {
      text: `Mock response for: ${request.prompt}`,
      usage: estimateUsage(request.prompt),
      finishReason: ModelFinishReason.Stop,
      model: "mock-deterministic",
      metadata: {
        deterministic: true,
      },
    };
  },
});

export const EchoModelProvider = defineModelProvider({
  id: "echo",
  name: "Echo Provider",
  description: "Returns the prompt exactly as provided.",
  version: "1.0.0",
  capabilities: [ModelProviderCapability.TextGeneration, "generation", "echo"],
  tags: ["echo", "local"],
  generate(request) {
    return {
      text: request.prompt,
      usage: estimateUsage(request.prompt),
      finishReason: ModelFinishReason.Stop,
      model: "echo",
      metadata: {
        echoed: true,
      },
    };
  },
});

function normalizeModelGenerationResponse(
  response: ModelGenerationResponse,
  defaults: { providerId: string; durationMs: number }
): ModelGenerationResponse {
  return {
    ...response,
    provider: response.provider ?? defaults.providerId,
    finishReason: response.finishReason ?? ModelFinishReason.Unknown,
    durationMs: response.durationMs ?? defaults.durationMs,
  };
}

function estimateUsage(prompt: string) {
  const inputTokens = prompt.trim() ? prompt.trim().split(/\s+/).length : 0;
  const outputTokens = inputTokens;

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}

function createValidationError(code: string, message: string): AgentOSError {
  return {
    code,
    message,
    recoverable: true,
  };
}
