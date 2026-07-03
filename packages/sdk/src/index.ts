export const agentOSSDK = {
  name: "@agentos/sdk",
  description: "Developer-facing exports for AgentOS.",
} as const;

export { createTask } from "@agentos/core";
export type { CreateTaskInput } from "@agentos/core";
export * from "@agentos/types";
