import {
  TaskPriority,
  TaskStatus,
  type AgentOSMetadata,
  type Task,
  type TaskSource,
} from "@agentos/types";

export { RuleBasedPlanner } from "./rule-based-planner";
export type { RuleBasedPlannerOptions } from "./rule-based-planner";
export { ModelAssistedPlanner } from "./model-assisted-planner";
export type { ModelAssistedPlannerConstructorOptions } from "./model-assisted-planner";
export { SimpleExecutionEngine } from "./simple-execution-engine";
export type { SimpleExecutionEngineOptions } from "./simple-execution-engine";
export { createMockTools } from "./mock-tools";
export {
  ConnectorDefinitionValidationError,
  defineBusinessConnector,
  defineConnector,
  defineMessagingConnector,
  defineResearchConnector,
  validateConnectorDefinitionConfig,
} from "./connector-definition";
export type {
  ConnectorDefinition,
  ConnectorDefinitionConfig,
  ConnectorDefinitionValidationOptions,
  ConnectorDefinitionValidationResult,
  ConnectorHealthCheckResult,
  ConnectorInspection,
  ConnectorSummary,
} from "./connector-definition";
export {
  ToolDefinitionValidationError,
  defineBusinessTool,
  defineMessagingTool,
  defineResearchTool,
  defineTool,
  validateToolDefinitionConfig,
} from "./tool-definition";
export type {
  ToolDefinition,
  ToolDefinitionConfig,
  ToolDefinitionValidationOptions,
  ToolDefinitionValidationResult,
  ToolExecutionContext,
  ToolInspection,
  ToolSummary,
} from "./tool-definition";
export { ToolResolver } from "./tool-resolver";
export type { ToolResolverOptions } from "./tool-resolver";
export {
  EchoModelProvider,
  MockModelProvider,
  ModelProviderDefinitionValidationError,
  defineModelProvider,
  validateModelProviderDefinitionConfig,
} from "./model-provider-definition";
export type {
  ModelProviderDefinition,
  ModelProviderDefinitionConfig,
  ModelProviderDefinitionValidationOptions,
  ModelProviderDefinitionValidationResult,
  ModelProviderGenerationContext,
  ModelProviderInspection,
  ModelProviderSummary,
} from "./model-provider-definition";
export { ModelProviderResolver } from "./model-provider-resolver";
export type { ModelProviderResolverOptions } from "./model-provider-resolver";
export {
  DEFAULT_PLANNING_SYSTEM_PROMPT,
  PLANNER_PROMPT_METADATA,
  PLANNER_PROMPT_VERSION,
  REPAIR_SYSTEM_PROMPT,
  buildPlanningPrompt,
  buildRepairPrompt,
  createPlannerPromptMetadata,
} from "./planner-prompts";
export type {
  PlannerPromptBuildInput,
  PlannerPromptBuildResult,
  PlannerPromptMetadata,
  PlannerRepairPromptBuildInput,
} from "./planner-prompts";
export { PlanValidator, createPlanValidator } from "./plan-validator";
export type { PlanValidatorOptions } from "./plan-validator";
export { SecurityPolicyEngine } from "./security-policy-engine";
export {
  CredentialResolver,
  redactCredentialReference,
  redactMetadata,
  redactSecretValue,
  validateCredentialReference,
} from "./credential-resolver";
export type { CredentialResolverOptions } from "./credential-resolver";
export { AgentOSRegistry, createAgentOSRegistryBootstrapExample } from "./agentos-registry";
export type { AgentOSRegistryOptions, ConnectorBundleRegistration } from "./agentos-registry";
export { LocalCommunityConnector } from "./local-community-connector";
export {
  AgentDefinitionValidationError,
  defineAgent,
  validateAgentDefinitionConfig,
} from "./agent-definition";
export { createAgentDefinitionExamples } from "./agent-definition.examples";
export { createAgentRuntimeExamples } from "./agent-runtime.examples";
export type {
  AgentDefinition,
  AgentDefinitionConfig,
  AgentDefinitionInspection,
  AgentRunInput,
  AgentRunOptions,
  AgentRunTaskInput,
  AgentDefinitionSummary,
  AgentDefinitionValidationResult,
} from "./agent-definition";

export const agentOSCore = {
  name: "@agentos/core",
  description: "Minimal core helpers for AgentOS domain objects.",
} as const;

export interface CreateTaskInput {
  id?: string;
  input: unknown;
  source?: TaskSource;
  priority?: TaskPriority;
  status?: TaskStatus;
  createdAt?: Date;
  updatedAt?: Date;
  metadata?: AgentOSMetadata;
}

export function createTask(input: CreateTaskInput): Task {
  const createdAt = input.createdAt ?? new Date();

  return {
    id: input.id ?? `task-${createdAt.getTime()}`,
    input: input.input,
    status: input.status ?? TaskStatus.Pending,
    priority: input.priority ?? TaskPriority.Normal,
    source: input.source ?? { type: "unknown" },
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
    metadata: input.metadata,
  };
}

export type * from "@agentos/types";
