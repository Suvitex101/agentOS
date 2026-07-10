import {
  CapabilityCategory,
  ResourceType,
  SecurityPolicyDecisionType,
  type AgentOSError,
  type AgentOSMetadata,
  type Capability,
  type ConnectorManifest,
  type ModelProvider,
  type RegisteredTool,
  type RegistryOperationResult,
  type RegistrySummary,
  type RegistryValidationIssue,
  type RegistryValidationResult,
  type Resource,
} from "@agentos/types";
import { defineConnector, type ConnectorDefinition } from "./connector-definition";
import { createMockTools } from "./mock-tools";
import { SecurityPolicyEngine } from "./security-policy-engine";

export interface ConnectorBundleRegistration {
  connectorId: string;
  connector: ConnectorManifest;
  capabilityIds: string[];
  toolIds: string[];
  resourceIds: string[];
  registeredAt: Date;
}

export interface AgentOSRegistryOptions {
  securityPolicyEngine?: SecurityPolicyEngine;
}

export class AgentOSRegistry {
  private readonly capabilities = new Map<string, Capability>();
  private readonly connectors = new Map<string, ConnectorManifest>();
  private readonly tools = new Map<string, RegisteredTool>();
  private readonly resources = new Map<string, Resource>();
  private readonly modelProviders = new Map<string, ModelProvider>();
  private readonly connectorBundles = new Map<string, ConnectorBundleRegistration>();
  private readonly securityPolicyEngine: SecurityPolicyEngine;
  private defaultModelProviderId?: string;

  constructor(options: AgentOSRegistryOptions = {}) {
    this.securityPolicyEngine = options.securityPolicyEngine ?? new SecurityPolicyEngine();
  }

  registerCapability(capability: Capability): RegistryOperationResult<Capability> {
    return this.register(this.capabilities, capability, "capability");
  }

  registerConnector(connector: ConnectorManifest): RegistryOperationResult<ConnectorManifest> {
    return this.register(this.connectors, connector, "connector");
  }

  registerTool(tool: RegisteredTool): RegistryOperationResult<RegisteredTool> {
    return this.register(this.tools, tool, "tool");
  }

  registerResource(resource: Resource): RegistryOperationResult<Resource> {
    return this.register(this.resources, resource, "resource");
  }

  registerModelProvider(provider: ModelProvider): RegistryOperationResult<ModelProvider> {
    const validation = this.validateModelProviderRegistration(provider);

    if (!validation.success) {
      return validation;
    }

    this.modelProviders.set(provider.id, provider);

    if (!this.defaultModelProviderId) {
      this.defaultModelProviderId = provider.id;
    }

    return {
      success: true,
      item: provider,
    };
  }

  registerConnectorBundle(
    connector: ConnectorDefinition
  ): RegistryOperationResult<ConnectorBundleRegistration> {
    const securityDecision = this.securityPolicyEngine.evaluateConnector(connector);

    if (securityDecision.decision === SecurityPolicyDecisionType.Deny) {
      return {
        success: false,
        error: createRegistryError(
          "registry_connector_denied_by_policy",
          `Connector bundle "${connector.id}" was denied by security policy.`,
          {
            securityDecision,
          }
        ),
      };
    }

    if (securityDecision.decision === SecurityPolicyDecisionType.RequiresApproval) {
      return {
        success: false,
        error: createRegistryError(
          "registry_connector_requires_approval",
          `Connector bundle "${connector.id}" requires approval before registration.`,
          {
            securityDecision,
          }
        ),
      };
    }

    const validation = this.validateConnectorBundleRegistration(connector);

    if (!validation.success) {
      return validation;
    }

    const registeredCapabilityIds: string[] = [];
    const registeredToolIds: string[] = [];
    const registeredResourceIds: string[] = [];

    this.connectors.set(connector.id, connector);

    for (const capability of connector.capabilities.capabilities) {
      if (!this.capabilities.has(capability.id)) {
        this.capabilities.set(capability.id, capability);
        registeredCapabilityIds.push(capability.id);
      }
    }

    for (const tool of connector.capabilities.tools) {
      this.tools.set(tool.id, {
        ...tool,
        connectorId: connector.id,
      });
      registeredToolIds.push(tool.id);
    }

    for (const resource of connector.resources) {
      this.resources.set(resource.id, {
        ...resource,
        source: connector.id,
      });
      registeredResourceIds.push(resource.id);
    }

    const registration: ConnectorBundleRegistration = Object.freeze({
      connectorId: connector.id,
      connector,
      capabilityIds: Object.freeze(registeredCapabilityIds) as string[],
      toolIds: Object.freeze(registeredToolIds) as string[],
      resourceIds: Object.freeze(registeredResourceIds) as string[],
      registeredAt: new Date(),
    });

    this.connectorBundles.set(connector.id, registration);

    return {
      success: true,
      item: registration,
    };
  }

  unregisterCapability(capabilityId: string): RegistryOperationResult<Capability> {
    return this.unregister(this.capabilities, capabilityId, "capability");
  }

  unregisterConnector(connectorId: string): RegistryOperationResult<ConnectorManifest> {
    return this.unregister(this.connectors, connectorId, "connector");
  }

  unregisterTool(toolId: string): RegistryOperationResult<RegisteredTool> {
    return this.unregister(this.tools, toolId, "tool");
  }

  unregisterResource(resourceId: string): RegistryOperationResult<Resource> {
    return this.unregister(this.resources, resourceId, "resource");
  }

  unregisterModelProvider(providerId: string): RegistryOperationResult<ModelProvider> {
    const result = this.unregister(this.modelProviders, providerId, "model provider");

    if (result.success && this.defaultModelProviderId === providerId) {
      this.defaultModelProviderId = undefined;
    }

    return result;
  }

  unregisterConnectorBundle(
    connectorId: string
  ): RegistryOperationResult<ConnectorBundleRegistration> {
    const registration = this.connectorBundles.get(connectorId);

    if (!registration) {
      return {
        success: false,
        error: createRegistryError(
          "registry_bundle_not_found",
          `Connector bundle "${connectorId}" is not registered.`
        ),
      };
    }

    for (const toolId of registration.toolIds) {
      this.tools.delete(toolId);
    }

    for (const resourceId of registration.resourceIds) {
      this.resources.delete(resourceId);
    }

    this.connectors.delete(connectorId);

    for (const capabilityId of registration.capabilityIds) {
      if (!this.isCapabilityReferenced(capabilityId)) {
        this.capabilities.delete(capabilityId);
      }
    }

    this.connectorBundles.delete(connectorId);

    return {
      success: true,
      item: registration,
    };
  }

  findCapabilityById(capabilityId: string): Capability | undefined {
    return this.capabilities.get(capabilityId);
  }

  findConnectorById(connectorId: string): ConnectorManifest | undefined {
    return this.connectors.get(connectorId);
  }

  findToolById(toolId: string): RegisteredTool | undefined {
    return this.tools.get(toolId);
  }

  findResourceById(resourceId: string): Resource | undefined {
    return this.resources.get(resourceId);
  }

  findModelProvider(providerId: string): ModelProvider | undefined {
    return this.modelProviders.get(providerId);
  }

  findConnectorBundle(connectorId: string): ConnectorBundleRegistration | undefined {
    return this.connectorBundles.get(connectorId);
  }

  findCapabilitiesByCategory(category: CapabilityCategory): Capability[] {
    return this.listCapabilities().filter((capability) => capability.category === category);
  }

  findToolsByCapability(capabilityId: string): RegisteredTool[] {
    return this.listTools().filter((tool) => tool.capabilityIds.includes(capabilityId));
  }

  findConnectorsByCapability(capabilityId: string): ConnectorManifest[] {
    return this.listConnectors().filter((connector) =>
      connector.capabilities.capabilities.some((capability) => capability.id === capabilityId)
    );
  }

  listCapabilities(): Capability[] {
    return [...this.capabilities.values()];
  }

  listConnectors(): ConnectorManifest[] {
    return [...this.connectors.values()];
  }

  listTools(): RegisteredTool[] {
    return [...this.tools.values()];
  }

  listResources(): Resource[] {
    return [...this.resources.values()];
  }

  listModelProviders(): ModelProvider[] {
    return [...this.modelProviders.values()];
  }

  listConnectorBundles(): ConnectorBundleRegistration[] {
    return [...this.connectorBundles.values()];
  }

  defaultModelProvider(): ModelProvider | undefined {
    return this.defaultModelProviderId
      ? this.modelProviders.get(this.defaultModelProviderId)
      : undefined;
  }

  setDefaultModelProvider(providerId: string): RegistryOperationResult<ModelProvider> {
    const provider = this.modelProviders.get(providerId);

    if (!provider) {
      return {
        success: false,
        error: createRegistryError(
          "registry_unknown_default_model_provider",
          `Model provider "${providerId}" is not registered.`
        ),
      };
    }

    this.defaultModelProviderId = providerId;

    return {
      success: true,
      item: provider,
    };
  }

  clearDefaultModelProvider(): RegistryOperationResult<ModelProvider> {
    const provider = this.defaultModelProvider();

    if (!provider) {
      return {
        success: false,
        error: createRegistryError(
          "registry_default_model_provider_not_set",
          "No default model provider is set."
        ),
      };
    }

    this.defaultModelProviderId = undefined;

    return {
      success: true,
      item: provider,
    };
  }

  summary(): RegistrySummary {
    return {
      capabilities: this.capabilities.size,
      connectors: this.connectors.size,
      tools: this.tools.size,
      resources: this.resources.size,
      modelProviders: this.modelProviders.size,
    };
  }

  validate(): RegistryValidationResult {
    const issues: RegistryValidationIssue[] = [];

    for (const connector of this.connectors.values()) {
      for (const capability of connector.capabilities.capabilities) {
        if (!this.capabilities.has(capability.id)) {
          issues.push({
            code: "registry_connector_missing_capability",
            message: `Connector "${connector.id}" references missing capability "${capability.id}".`,
            severity: "error",
            entityType: "connector",
            entityId: connector.id,
            metadata: {
              capabilityId: capability.id,
            },
          });
        }
      }
    }

    for (const tool of this.tools.values()) {
      for (const capabilityId of tool.capabilityIds) {
        if (!this.capabilities.has(capabilityId)) {
          issues.push({
            code: "registry_tool_missing_capability",
            message: `Tool "${tool.id}" references missing capability "${capabilityId}".`,
            severity: "error",
            entityType: "tool",
            entityId: tool.id,
            metadata: {
              capabilityId,
            },
          });
        }
      }

      if (tool.connectorId && !this.connectors.has(tool.connectorId)) {
        issues.push({
          code: "registry_tool_missing_connector",
          message: `Tool "${tool.id}" references missing connector "${tool.connectorId}".`,
          severity: "error",
          entityType: "tool",
          entityId: tool.id,
          metadata: {
            connectorId: tool.connectorId,
          },
        });
      }
    }

    for (const resource of this.resources.values()) {
      const hasConnectorOrigin = this.connectors.has(resource.source);

      if (!hasConnectorOrigin) {
        issues.push({
          code: "registry_resource_unknown_origin",
          message: `Resource "${resource.id}" references unknown source "${resource.source}".`,
          severity: "warning",
          entityType: "resource",
          entityId: resource.id,
          metadata: {
            source: resource.source,
          },
        });
      }
    }

    if (this.defaultModelProviderId && !this.modelProviders.has(this.defaultModelProviderId)) {
      issues.push({
        code: "registry_unknown_default_model_provider",
        message: `Default model provider "${this.defaultModelProviderId}" is not registered.`,
        severity: "error",
        entityType: "model_provider",
        entityId: this.defaultModelProviderId,
      });
    }

    for (const provider of this.modelProviders.values()) {
      if (provider.capabilities.length === 0) {
        issues.push({
          code: "registry_model_provider_missing_capabilities",
          message: `Model provider "${provider.id}" does not declare capabilities.`,
          severity: "error",
          entityType: "model_provider",
          entityId: provider.id,
        });
      }

      if (provider.metadata !== undefined && !isPlainObject(provider.metadata)) {
        issues.push({
          code: "registry_model_provider_invalid_metadata",
          message: `Model provider "${provider.id}" has invalid metadata.`,
          severity: "error",
          entityType: "model_provider",
          entityId: provider.id,
        });
      }
    }

    return {
      valid: issues.every((issue) => issue.severity !== "error"),
      issues,
      summary: this.summary(),
      metadata: {
        validatedAt: new Date(),
      },
    };
  }

  private register<T extends { id: string }>(
    collection: Map<string, T>,
    item: T,
    entityType: string
  ): RegistryOperationResult<T> {
    if (collection.has(item.id)) {
      return {
        success: false,
        error: createRegistryError(
          "registry_duplicate_id",
          `${capitalize(entityType)} "${item.id}" is already registered.`
        ),
      };
    }

    collection.set(item.id, item);

    return {
      success: true,
      item,
    };
  }

  private unregister<T extends { id: string }>(
    collection: Map<string, T>,
    itemId: string,
    entityType: string
  ): RegistryOperationResult<T> {
    const item = collection.get(itemId);

    if (!item) {
      return {
        success: false,
        error: createRegistryError(
          "registry_item_not_found",
          `${capitalize(entityType)} "${itemId}" is not registered.`
        ),
      };
    }

    collection.delete(itemId);

    return {
      success: true,
      item,
    };
  }

  private validateConnectorBundleRegistration(
    connector: ConnectorDefinition
  ): RegistryOperationResult<ConnectorBundleRegistration> {
    const duplicateCapabilityId = findDuplicate(
      connector.capabilities.capabilities.map((capability) => capability.id)
    );
    const duplicateToolId = findDuplicate(connector.capabilities.tools.map((tool) => tool.id));
    const duplicateResourceId = findDuplicate(connector.resources.map((resource) => resource.id));

    if (this.connectors.has(connector.id) || this.connectorBundles.has(connector.id)) {
      return {
        success: false,
        error: createRegistryError(
          "registry_duplicate_connector_bundle",
          `Connector bundle "${connector.id}" is already registered.`
        ),
      };
    }

    if (duplicateCapabilityId) {
      return {
        success: false,
        error: createRegistryError(
          "registry_duplicate_bundled_capability",
          `Connector bundle "${connector.id}" includes duplicate capability "${duplicateCapabilityId}".`
        ),
      };
    }

    if (duplicateToolId) {
      return {
        success: false,
        error: createRegistryError(
          "registry_duplicate_bundled_tool",
          `Connector bundle "${connector.id}" includes duplicate tool "${duplicateToolId}".`
        ),
      };
    }

    if (duplicateResourceId) {
      return {
        success: false,
        error: createRegistryError(
          "registry_duplicate_bundled_resource",
          `Connector bundle "${connector.id}" includes duplicate resource "${duplicateResourceId}".`
        ),
      };
    }

    for (const tool of connector.capabilities.tools) {
      if (this.tools.has(tool.id)) {
        return {
          success: false,
          error: createRegistryError(
            "registry_duplicate_bundled_tool",
            `Tool "${tool.id}" is already registered.`
          ),
        };
      }
    }

    for (const resource of connector.resources) {
      if (this.resources.has(resource.id)) {
        return {
          success: false,
          error: createRegistryError(
            "registry_duplicate_bundled_resource",
            `Resource "${resource.id}" is already registered.`
          ),
        };
      }
    }

    return {
      success: true,
      item: {
        connectorId: connector.id,
        connector,
        capabilityIds: [],
        toolIds: [],
        resourceIds: [],
        registeredAt: new Date(),
      },
    };
  }

  private validateModelProviderRegistration(
    provider: ModelProvider
  ): RegistryOperationResult<ModelProvider> {
    if (this.modelProviders.has(provider.id)) {
      return {
        success: false,
        error: createRegistryError(
          "registry_duplicate_model_provider",
          `Model provider "${provider.id}" is already registered.`
        ),
      };
    }

    if (!provider.capabilities.length) {
      return {
        success: false,
        error: createRegistryError(
          "registry_model_provider_missing_capabilities",
          `Model provider "${provider.id}" must declare at least one capability.`
        ),
      };
    }

    if (provider.metadata !== undefined && !isPlainObject(provider.metadata)) {
      return {
        success: false,
        error: createRegistryError(
          "registry_model_provider_invalid_metadata",
          `Model provider "${provider.id}" metadata must be a plain object.`
        ),
      };
    }

    return {
      success: true,
      item: provider,
    };
  }

  private isCapabilityReferenced(capabilityId: string): boolean {
    return [...this.connectors.values()].some((connector) =>
      connector.capabilities.capabilities.some((capability) => capability.id === capabilityId)
    );
  }
}

export function createAgentOSRegistryBootstrapExample(): AgentOSRegistry {
  const registry = new AgentOSRegistry();
  const capabilities: Capability[] = [
    {
      id: "messaging",
      name: "Messaging",
      description: "Prepare and route messages through mocked local tools.",
      category: CapabilityCategory.Messaging,
      supportedConnectors: ["local-mock-connector"],
    },
    {
      id: "communication",
      name: "Communication",
      description: "Summarize, draft, and present communication output.",
      category: CapabilityCategory.Communication,
      supportedConnectors: ["local-mock-connector"],
    },
    {
      id: "research",
      name: "Research",
      description: "Analyze text and gather local mocked research signals.",
      category: CapabilityCategory.Research,
      supportedConnectors: ["local-mock-connector"],
    },
    {
      id: "analytics",
      name: "Analytics",
      description: "Produce local mocked analysis outputs.",
      category: CapabilityCategory.Analytics,
      supportedConnectors: ["local-mock-connector"],
    },
    {
      id: "payments",
      name: "Payments",
      description: "Prepare mocked invoice and payment workflows.",
      category: CapabilityCategory.Payments,
      supportedConnectors: ["local-mock-connector"],
    },
    {
      id: "business",
      name: "Business",
      description: "Support local mocked business operations.",
      category: CapabilityCategory.Custom,
      supportedConnectors: ["local-mock-connector"],
    },
    {
      id: "general",
      name: "General",
      description: "Fallback local mocked execution capability.",
      category: CapabilityCategory.Custom,
      supportedConnectors: ["local-mock-connector"],
    },
  ];
  const tools = createMockTools();
  const demoChannelResource: Resource = {
    id: "resource-local-demo-channel",
    type: ResourceType.Channel,
    source: "local-mock-connector",
    uri: "local://agentos/demo-channel",
    metadata: {
      provider: "local-mock",
      name: "demo-channel",
    },
  };
  const connector = defineConnector({
    id: "local-mock-connector",
    name: "Local Mock Connector",
    description: "Local connector that exposes mocked AgentOS capabilities for examples.",
    version: "1.0.0",
    capabilities,
    tools,
    resources: [demoChannelResource],
    health() {
      return {
        healthy: true,
        metadata: {
          mode: "local",
        },
      };
    },
  });

  for (const capability of capabilities) {
    registry.registerCapability(capability);
  }

  registry.registerConnector(connector);

  for (const tool of tools) {
    registry.registerTool({
      ...tool,
      connectorId: "local-mock-connector",
    });
  }

  registry.registerResource(demoChannelResource);

  return registry;
}

function createRegistryError(
  code: string,
  message: string,
  metadata?: AgentOSMetadata
): AgentOSError {
  return {
    code,
    message,
    recoverable: true,
    metadata,
  };
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function findDuplicate(values: string[]): string | undefined {
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      return value;
    }

    seen.add(value);
  }

  return undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
