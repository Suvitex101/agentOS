import {
  CapabilityCategory,
  ConnectorAuthType,
  ConnectorHealthStatus,
  ConnectorVisibility,
  type AgentOSError,
  type AgentOSMetadata,
  type Capability,
  type ConnectorManifest,
  type ConnectorProvider,
  type RegisteredTool,
  type Resource,
  type ResourceType,
  type ToolAuthor,
} from "@agentos/types";

export interface ConnectorHealthCheckResult {
  healthy: boolean;
  status?: ConnectorHealthStatus;
  checkedAt?: Date;
  message?: string;
  metadata?: AgentOSMetadata;
}

export interface ConnectorDefinitionConfig {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: ToolAuthor;
  tags?: string[];
  visibility?: ConnectorVisibility;
  metadata?: AgentOSMetadata;
  provider?: ConnectorProvider;
  authType?: ConnectorAuthType;
  capabilities: Array<string | Capability>;
  tools: RegisteredTool[];
  resources?: Resource[];
  health: () => ConnectorHealthCheckResult;
}

export interface ConnectorDefinition extends ConnectorManifest {
  description: string;
  author?: ToolAuthor;
  tags: string[];
  visibility: ConnectorVisibility;
  resources: Resource[];
  health(): ConnectorHealthCheckResult;
  inspect(): ConnectorInspection;
  summary(): ConnectorSummary;
}

export interface ConnectorInspection {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: ToolAuthor;
  tags: string[];
  visibility: ConnectorVisibility;
  metadata?: AgentOSMetadata;
  health: ConnectorHealthCheckResult;
  capabilityCount: number;
  toolCount: number;
  resourceCount: number;
  capabilities: string[];
}

export interface ConnectorSummary {
  id: string;
  name: string;
  description: string;
  version: string;
  visibility: ConnectorVisibility;
  capabilities: string[];
  toolCount: number;
  resourceCount: number;
}

export interface ConnectorDefinitionValidationOptions {
  existingIds?: string[];
}

export interface ConnectorDefinitionValidationResult {
  valid: boolean;
  errors: AgentOSError[];
}

export class ConnectorDefinitionValidationError extends Error {
  readonly errors: AgentOSError[];

  constructor(errors: AgentOSError[]) {
    super(errors.map((error) => error.message).join(" "));
    this.name = "ConnectorDefinitionValidationError";
    this.errors = errors;
  }
}

type ConnectorHelperConfig = Omit<ConnectorDefinitionConfig, "capabilities"> &
  Partial<Pick<ConnectorDefinitionConfig, "capabilities">>;

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

export function defineConnector(config: ConnectorDefinitionConfig): ConnectorDefinition {
  const validation = validateConnectorDefinitionConfig(config);

  if (!validation.valid) {
    throw new ConnectorDefinitionValidationError(validation.errors);
  }

  const tags = Object.freeze([...(config.tags ?? [])]);
  const resources = Object.freeze([...(config.resources ?? [])]);
  const tools = Object.freeze([...config.tools]);
  const capabilities = Object.freeze(normalizeCapabilities(config.id, config.capabilities));
  const resourceTypes = Object.freeze(uniqueResourceTypes(resources));
  const visibility = config.visibility ?? ConnectorVisibility.Private;
  const provider =
    config.provider ??
    Object.freeze({
      id: `provider-${config.id}`,
      name: config.id,
      displayName: config.name,
    });

  const connector: ConnectorDefinition = Object.freeze({
    id: config.id,
    name: config.name,
    description: config.description,
    provider,
    version: Object.freeze({
      current: config.version,
    }),
    capabilities: Object.freeze({
      capabilities: capabilities as Capability[],
      tools: tools as RegisteredTool[],
      resources: resourceTypes as ResourceType[],
    }),
    authType: config.authType ?? ConnectorAuthType.None,
    author: config.author,
    tags: tags as string[],
    visibility,
    resources: resources as Resource[],
    metadata: config.metadata,
    health() {
      return normalizeHealth(config.health());
    },
    inspect() {
      return {
        id: config.id,
        name: config.name,
        description: config.description,
        version: config.version,
        author: config.author,
        tags: [...tags],
        visibility,
        metadata: config.metadata,
        health: normalizeHealth(config.health()),
        capabilityCount: capabilities.length,
        toolCount: tools.length,
        resourceCount: resources.length,
        capabilities: capabilities.map((capability) => capability.id),
      };
    },
    summary() {
      return {
        id: config.id,
        name: config.name,
        description: config.description,
        version: config.version,
        visibility,
        capabilities: capabilities.map((capability) => capability.id),
        toolCount: tools.length,
        resourceCount: resources.length,
      };
    },
  });

  return connector;
}

export function defineMessagingConnector(config: ConnectorHelperConfig): ConnectorDefinition {
  return defineConnector({
    ...config,
    capabilities: config.capabilities ?? ["messaging", "communication"],
  });
}

export function defineResearchConnector(config: ConnectorHelperConfig): ConnectorDefinition {
  return defineConnector({
    ...config,
    capabilities: config.capabilities ?? ["research", "analytics"],
  });
}

export function defineBusinessConnector(config: ConnectorHelperConfig): ConnectorDefinition {
  return defineConnector({
    ...config,
    capabilities: config.capabilities ?? ["business", "payments"],
  });
}

export function validateConnectorDefinitionConfig(
  config: Partial<ConnectorDefinitionConfig>,
  options: ConnectorDefinitionValidationOptions = {}
): ConnectorDefinitionValidationResult {
  const errors: AgentOSError[] = [];

  if (!config.id?.trim()) {
    errors.push(createValidationError("connector_missing_id", "Connector id is required."));
  } else if (options.existingIds?.includes(config.id)) {
    errors.push(
      createValidationError(
        "connector_duplicate_id",
        `Connector id "${config.id}" is already registered.`
      )
    );
  }

  if (!config.name?.trim()) {
    errors.push(createValidationError("connector_missing_name", "Connector name is required."));
  }

  if (!config.version?.trim()) {
    errors.push(
      createValidationError("connector_missing_version", "Connector version is required.")
    );
  } else if (!SEMVER_PATTERN.test(config.version)) {
    errors.push(
      createValidationError(
        "connector_invalid_version",
        `Connector version "${config.version}" must use x.y.z semantic version format.`
      )
    );
  }

  if (!config.capabilities?.length) {
    errors.push(
      createValidationError(
        "connector_missing_capabilities",
        "Connector must expose at least one capability."
      )
    );
  }

  if (!config.tools?.length) {
    errors.push(
      createValidationError("connector_missing_tools", "Connector must expose at least one tool.")
    );
  }

  if (!config.health) {
    errors.push(
      createValidationError("connector_missing_health", "Connector health function is required.")
    );
  }

  addDuplicateErrors(errors, "capability", getCapabilityIds(config.capabilities ?? []));
  addDuplicateErrors(
    errors,
    "tool",
    (config.tools ?? []).map((tool) => tool.id)
  );
  addDuplicateErrors(
    errors,
    "resource",
    (config.resources ?? []).map((resource) => resource.id)
  );

  return {
    valid: errors.length === 0,
    errors,
  };
}

function normalizeCapabilities(connectorId: string, capabilities: Array<string | Capability>) {
  return capabilities.map((capability) => {
    if (typeof capability === "string") {
      return {
        id: capability,
        name: titleCase(capability),
        description: `Provides ${titleCase(capability)} capability.`,
        category: capabilityCategoryFor(capability),
        supportedConnectors: [connectorId],
      };
    }

    return {
      ...capability,
      supportedConnectors: capability.supportedConnectors.includes(connectorId)
        ? capability.supportedConnectors
        : [...capability.supportedConnectors, connectorId],
    };
  });
}

function normalizeHealth(health: ConnectorHealthCheckResult): ConnectorHealthCheckResult {
  return {
    ...health,
    status:
      health.status ??
      (health.healthy ? ConnectorHealthStatus.Healthy : ConnectorHealthStatus.Unhealthy),
    checkedAt: health.checkedAt ?? new Date(),
  };
}

function uniqueResourceTypes(resources: readonly Resource[]): ResourceType[] {
  return [...new Set(resources.map((resource) => resource.type))];
}

function getCapabilityIds(capabilities: Array<string | Capability>): string[] {
  return capabilities.map((capability) =>
    typeof capability === "string" ? capability : capability.id
  );
}

function addDuplicateErrors(errors: AgentOSError[], entityType: string, ids: string[]): void {
  const seen = new Set<string>();

  for (const id of ids) {
    if (seen.has(id)) {
      errors.push(
        createValidationError(
          `connector_duplicate_${entityType}_id`,
          `Connector includes duplicate ${entityType} id "${id}".`
        )
      );
    }

    seen.add(id);
  }
}

function capabilityCategoryFor(capabilityId: string): CapabilityCategory {
  const categories: Record<string, CapabilityCategory> = {
    analytics: CapabilityCategory.Analytics,
    communication: CapabilityCategory.Communication,
    messaging: CapabilityCategory.Messaging,
    notifications: CapabilityCategory.Notifications,
    payments: CapabilityCategory.Payments,
    research: CapabilityCategory.Research,
    scheduling: CapabilityCategory.Scheduling,
    search: CapabilityCategory.Search,
    storage: CapabilityCategory.Storage,
  };

  return categories[capabilityId] ?? CapabilityCategory.Custom;
}

function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function createValidationError(code: string, message: string): AgentOSError {
  return {
    code,
    message,
    recoverable: true,
  };
}
