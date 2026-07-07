export const agentOSSDK = {
  name: "@agentos/sdk",
  description: "Developer-facing exports for AgentOS.",
} as const;

export { RuleBasedPlanner, createTask } from "@agentos/core";
export type { CreateTaskInput, RuleBasedPlannerOptions } from "@agentos/core";
export * from "@agentos/types";
