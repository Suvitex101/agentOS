import {
  TaskPriority,
  TaskStatus,
  type AgentOSMetadata,
  type Task,
  type TaskSource,
} from "@agentos/types";

export const agentOSCore = {
  name: "@agentos/core",
  description: "Minimal core helpers for AgentOS domain objects.",
} as const;

export interface CreateTaskInput {
  id: string;
  input: unknown;
  source: TaskSource;
  priority?: TaskPriority;
  status?: TaskStatus;
  createdAt?: Date;
  updatedAt?: Date;
  metadata?: AgentOSMetadata;
}

export function createTask(input: CreateTaskInput): Task {
  const createdAt = input.createdAt ?? new Date();

  return {
    id: input.id,
    input: input.input,
    status: input.status ?? TaskStatus.Pending,
    priority: input.priority ?? TaskPriority.Normal,
    source: input.source,
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
    metadata: input.metadata,
  };
}

export type * from "@agentos/types";
