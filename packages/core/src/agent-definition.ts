import {
  type AgentCapability,
  type AgentOSError,
  type AgentOSMetadata,
  type AgentPermission,
  type ExecutionEngine,
  type Planner,
  type RegistrySummary,
} from "@agentos/types";
import type { MemoryStore } from "@agentos/memory";
import type { AgentOSRegistry } from "./agentos-registry";

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
