export const agentOSSDK = {
  name: "@agentos/sdk",
  description: "Developer-facing exports for AgentOS.",
} as const;

export {
  AgentOSRegistry,
  RuleBasedPlanner,
  SimpleExecutionEngine,
  createAgentOSRegistryBootstrapExample,
  createTask,
} from "@agentos/core";
export type {
  CreateTaskInput,
  RuleBasedPlannerOptions,
  SimpleExecutionEngineOptions,
} from "@agentos/core";
export * from "@agentos/types";
