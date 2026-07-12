import {
  ExecutionEventType,
  MemoryScope,
  MemoryType,
  ResultStatus,
  TaskPriority,
  TaskStatus,
  type Agent,
  type AgentCapability,
  type AgentOSError,
  type AgentOSMetadata,
  type AgentPermission,
  type ExecutionEngine,
  type ExecutionContext,
  type ExecutionTrace,
  type MemoryRecord,
  type MemoryScopeReference,
  type Planner,
  type Plan,
  type RegistrySummary,
  type Result,
  type Task,
  type TaskSource,
} from "@agentosdev/types";
import type { MemoryStore } from "@agentosdev/memory";
import type { AgentOSRegistry } from "./agentos-registry";
import { ToolResolver } from "./tool-resolver";

export interface AgentDefinitionConfig {
  id: string;
  name: string;
  description: string;
  version?: string;
  metadata?: AgentOSMetadata;
  planner: Planner;
  executionEngine: ExecutionEngine;
  registry: AgentOSRegistry;
  memoryStore: MemoryStore;
  capabilities?: AgentCapability[];
  permissions?: AgentPermission[];
}

export interface AgentDefinitionSummary {
  id: string;
  name: string;
  description: string;
  version: string;
  capabilityCount: number;
  permissionCount: number;
  metadata?: AgentOSMetadata;
}

export interface AgentDefinitionInspection {
  id: string;
  name: string;
  version: string;
  planner: {
    id: string;
    name: string;
    strategy: string;
  };
  executionEngine: {
    id: string;
    name: string;
  };
  memoryProvider: string;
  registeredCapabilities: string[];
  connectorCount: number;
  registrySummary: RegistrySummary;
  metadata?: AgentOSMetadata;
}

export interface AgentRunOptions {
  memory?: boolean;
  metadata?: AgentOSMetadata;
  scope?: MemoryScopeReference;
}

export interface AgentRunTaskInput {
  id?: string;
  input: unknown;
  source?: TaskSource;
  priority?: TaskPriority;
  status?: TaskStatus;
  createdAt?: Date;
  updatedAt?: Date;
  metadata?: AgentOSMetadata;
}

export type AgentRunInput = string | Task | AgentRunTaskInput;

export interface AgentDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly metadata?: AgentOSMetadata;
  readonly planner: Planner;
  readonly executionEngine: ExecutionEngine;
  readonly registry: AgentOSRegistry;
  readonly memoryStore: MemoryStore;
  readonly capabilities: readonly AgentCapability[];
  readonly permissions: readonly AgentPermission[];
  run(input: AgentRunInput, options?: AgentRunOptions): Promise<Result>;
  inspect(): AgentDefinitionInspection;
  summary(): AgentDefinitionSummary;
}

export interface AgentDefinitionValidationResult {
  valid: boolean;
  errors: AgentOSError[];
}

export class AgentDefinitionValidationError extends Error {
  readonly errors: AgentOSError[];

  constructor(errors: AgentOSError[]) {
    super(errors.map((error) => error.message).join(" "));
    this.name = "AgentDefinitionValidationError";
    this.errors = errors;
  }
}

export function defineAgent(config: AgentDefinitionConfig): AgentDefinition {
  const validation = validateAgentDefinitionConfig(config);

  if (!validation.valid) {
    throw new AgentDefinitionValidationError(validation.errors);
  }

  const capabilities = Object.freeze([...(config.capabilities ?? [])]);
  const permissions = Object.freeze([...(config.permissions ?? [])]);
  const version = config.version ?? "0.1.0";
  const domainAgent = createDomainAgent(config, capabilities, permissions, version);
  const toolResolver = new ToolResolver({
    registry: config.registry,
  });

  const definition: AgentDefinition = {
    id: config.id,
    name: config.name,
    description: config.description,
    version,
    metadata: config.metadata,
    planner: config.planner,
    executionEngine: config.executionEngine,
    registry: config.registry,
    memoryStore: config.memoryStore,
    capabilities,
    permissions,
    async run(input, options = {}) {
      const runtimeStartedAt = new Date();
      const memoryEnabled = options.memory ?? true;
      const memoryScope = options.scope ?? {
        type: MemoryScope.Agent,
        id: config.id,
      };
      const task = normalizeRunInput(input, memoryScope);
      const memoryErrors: AgentOSError[] = [];
      let memoryRecords: MemoryRecord[] = [];

      if (memoryEnabled) {
        try {
          memoryRecords = await config.memoryStore.search({
            query: stringifyTaskInput(task.input),
            scope: memoryScope,
          });
        } catch (error) {
          memoryErrors.push(normalizeRuntimeError("agent_memory_read_failed", error));
        }
      }

      const context: ExecutionContext = {
        agent: domainAgent,
        task,
        memory: memoryRecords,
        resources: config.registry.listResources(),
        variables: {},
        environment: {},
        metadata: {
          agentId: config.id,
          ...options.metadata,
        },
      };

      let plan: Plan;

      try {
        plan = await config.planner.plan(domainAgent, task, context, {
          metadata: options.metadata,
        });
      } catch (error) {
        return createFailedRuntimeResult({
          task,
          startedAt: runtimeStartedAt,
          error: normalizeRuntimeError("agent_planning_failed", error),
          memoryErrors,
          metadata: createRuntimeMetadata(config, {
            memoryReadCount: memoryRecords.length,
            memoryWriteAttempted: false,
            runtimeStartedAt,
            runtimeCompletedAt: new Date(),
            optionsMetadata: options.metadata,
          }),
        });
      }

      const validation = await config.planner.validatePlan(plan);

      if (!validation.valid) {
        return createFailedRuntimeResult({
          task,
          plan,
          startedAt: runtimeStartedAt,
          error:
            validation.errors[0] ?? createRuntimeError("agent_plan_invalid", "Plan is invalid."),
          memoryErrors: [...memoryErrors, ...validation.errors.slice(1)],
          metadata: createRuntimeMetadata(config, {
            memoryReadCount: memoryRecords.length,
            memoryWriteAttempted: false,
            runtimeStartedAt,
            runtimeCompletedAt: new Date(),
            optionsMetadata: options.metadata,
          }),
        });
      }

      let result: Result;

      try {
        result = await config.executionEngine.executePlan(domainAgent, task, plan, context, {
          toolResolver,
          metadata: options.metadata,
        });
      } catch (error) {
        return createFailedRuntimeResult({
          task,
          plan,
          startedAt: runtimeStartedAt,
          error: normalizeRuntimeError("agent_execution_failed", error),
          memoryErrors,
          metadata: createRuntimeMetadata(config, {
            memoryReadCount: memoryRecords.length,
            memoryWriteAttempted: false,
            runtimeStartedAt,
            runtimeCompletedAt: new Date(),
            optionsMetadata: options.metadata,
          }),
        });
      }

      let memoryWriteAttempted = false;

      if (memoryEnabled) {
        memoryWriteAttempted = true;

        try {
          const write = await config.memoryStore.write({
            content: {
              taskInput: task.input,
              resultStatus: result.status,
              answer: result.answer,
              completedAt: result.completedAt,
            },
            type: MemoryType.Summary,
            scope: memoryScope,
            taskId: task.id,
            metadata: {
              agentId: config.id,
              source: "agent.run",
            },
          });

          if (!write.success && write.error) {
            memoryErrors.push(write.error);
          }
        } catch (error) {
          memoryErrors.push(normalizeRuntimeError("agent_memory_write_failed", error));
        }
      }

      const runtimeCompletedAt = new Date();

      return {
        ...result,
        errors: [...result.errors, ...memoryErrors],
        metadata: {
          ...result.metadata,
          ...createRuntimeMetadata(config, {
            memoryReadCount: memoryRecords.length,
            memoryWriteAttempted,
            runtimeStartedAt,
            runtimeCompletedAt,
            optionsMetadata: options.metadata,
          }),
          memoryErrors,
        },
      };
    },
    inspect() {
      const registrySummary = config.registry.summary();

      return {
        id: config.id,
        name: config.name,
        version,
        planner: {
          id: config.planner.id,
          name: config.planner.name,
          strategy: config.planner.strategy.type,
        },
        executionEngine: {
          id: config.executionEngine.id,
          name: config.executionEngine.name,
        },
        memoryProvider: config.memoryStore.constructor.name,
        registeredCapabilities: config.registry
          .listCapabilities()
          .map((capability) => capability.id),
        connectorCount: registrySummary.connectors,
        registrySummary,
        metadata: config.metadata,
      };
    },
    summary() {
      return {
        id: config.id,
        name: config.name,
        description: config.description,
        version,
        capabilityCount: capabilities.length,
        permissionCount: permissions.length,
        metadata: config.metadata,
      };
    },
  };

  return Object.freeze(definition);
}

interface RuntimeMetadataInput {
  memoryReadCount: number;
  memoryWriteAttempted: boolean;
  runtimeStartedAt: Date;
  runtimeCompletedAt: Date;
  optionsMetadata?: AgentOSMetadata;
}

export function validateAgentDefinitionConfig(
  config: Partial<AgentDefinitionConfig>
): AgentDefinitionValidationResult {
  const errors: AgentOSError[] = [];

  if (!config.id?.trim()) {
    errors.push(createValidationError("agent_missing_id", "Agent id is required."));
  }

  if (!config.name?.trim()) {
    errors.push(createValidationError("agent_missing_name", "Agent name is required."));
  }

  if (!config.planner) {
    errors.push(createValidationError("agent_missing_planner", "Agent planner is required."));
  }

  if (!config.executionEngine) {
    errors.push(
      createValidationError("agent_missing_execution_engine", "Agent execution engine is required.")
    );
  }

  if (!config.registry) {
    errors.push(createValidationError("agent_missing_registry", "Agent registry is required."));
  }

  if (!config.memoryStore) {
    errors.push(
      createValidationError("agent_missing_memory_store", "Agent memory store is required.")
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

function createDomainAgent(
  config: AgentDefinitionConfig,
  capabilities: readonly AgentCapability[],
  permissions: readonly AgentPermission[],
  version: string
): Agent {
  return {
    id: config.id,
    name: config.name,
    description: config.description,
    version,
    capabilities: [...capabilities],
    tools: [],
    memoryPolicy: {
      enabled: true,
      scopes: [
        MemoryScope.User,
        MemoryScope.Organization,
        MemoryScope.Agent,
        MemoryScope.Task,
        MemoryScope.Mission,
        MemoryScope.Project,
        MemoryScope.Global,
      ],
      readableTypes: [
        MemoryType.Fact,
        MemoryType.Preference,
        MemoryType.Summary,
        MemoryType.Event,
        MemoryType.Document,
        MemoryType.Custom,
      ],
      writableTypes: [
        MemoryType.Fact,
        MemoryType.Preference,
        MemoryType.Summary,
        MemoryType.Event,
        MemoryType.Document,
        MemoryType.Custom,
      ],
    },
    permissions: [...permissions],
    metadata: config.metadata,
  };
}

function normalizeRunInput(input: AgentRunInput, scope: MemoryScopeReference): Task {
  if (typeof input === "string") {
    return createTaskFromInput({
      input,
      source: {
        type: "agent.run",
        name: scope.id,
      },
    });
  }

  if (isTask(input)) {
    return input;
  }

  return createTaskFromInput(input);
}

function createTaskFromInput(input: AgentRunTaskInput): Task {
  const createdAt = input.createdAt ?? new Date();

  return {
    id: input.id ?? `task-${createdAt.getTime()}`,
    input: input.input,
    status: input.status ?? TaskStatus.Pending,
    priority: input.priority ?? TaskPriority.Normal,
    source: input.source ?? { type: "agent.run" },
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
    metadata: input.metadata,
  };
}

function isTask(input: AgentRunInput): input is Task {
  return (
    typeof input === "object" &&
    input !== null &&
    "id" in input &&
    "status" in input &&
    "priority" in input &&
    "createdAt" in input &&
    "updatedAt" in input
  );
}

function createFailedRuntimeResult(input: {
  task: Task;
  plan?: Plan;
  startedAt: Date;
  error: AgentOSError;
  memoryErrors: AgentOSError[];
  metadata: AgentOSMetadata;
}): Result {
  const completedAt = new Date();
  const errors = [input.error, ...input.memoryErrors];

  return {
    taskId: input.task.id,
    status: ResultStatus.Failed,
    answer: input.error.message,
    plan: input.plan,
    trace: [
      createRuntimeTrace(ExecutionEventType.TaskFailed, {
        error: input.error,
        input: input.task.input,
        metadata: {
          taskId: input.task.id,
        },
      }),
    ],
    toolCalls: [],
    memoryWrites: [],
    errors,
    startedAt: input.startedAt,
    completedAt,
    durationMs: completedAt.getTime() - input.startedAt.getTime(),
    metadata: {
      ...input.metadata,
      memoryErrors: input.memoryErrors,
    },
  };
}

function createRuntimeTrace(
  event: ExecutionEventType,
  input: Omit<ExecutionTrace, "event" | "timestamp">
): ExecutionTrace {
  return {
    event,
    timestamp: new Date(),
    ...input,
  };
}

function createRuntimeMetadata(
  config: AgentDefinitionConfig,
  input: RuntimeMetadataInput
): AgentOSMetadata {
  return {
    agentId: config.id,
    planner: config.planner.name,
    executionEngine: config.executionEngine.name,
    memoryReadCount: input.memoryReadCount,
    memoryWriteAttempted: input.memoryWriteAttempted,
    runtimeStartedAt: input.runtimeStartedAt,
    runtimeCompletedAt: input.runtimeCompletedAt,
    ...input.optionsMetadata,
  };
}

function normalizeRuntimeError(code: string, error: unknown): AgentOSError {
  if (error && typeof error === "object" && "message" in error) {
    return createRuntimeError(code, String(error.message), error);
  }

  return createRuntimeError(code, "Agent runtime failed.", error);
}

function createRuntimeError(code: string, message: string, details?: unknown): AgentOSError {
  return {
    code,
    message,
    details,
    recoverable: true,
  };
}

function stringifyTaskInput(input: unknown): string {
  if (typeof input === "string") {
    return input;
  }

  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
}
