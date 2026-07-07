export const agentOSSDK = {
  name: "@agentos/sdk",
  description: "Developer-facing exports for AgentOS.",
} as const;

export { RuleBasedPlanner, SimpleExecutionEngine, createTask } from "@agentos/core";
export type {
  CreateTaskInput,
  RuleBasedPlannerOptions,
  SimpleExecutionEngineOptions,
} from "@agentos/core";
export * from "@agentos/types";
