import {
  CapabilityCategory,
  ResourceType,
  type AgentOSError,
  type Capability,
  type ConnectorManifest,
  type RegisteredTool,
  type RegistryOperationResult,
  type RegistrySummary,
  type RegistryValidationIssue,
  type RegistryValidationResult,
  type Resource,
} from "@agentos/types";
import { defineConnector } from "./connector-definition";
import { createMockTools } from "./mock-tools";

export class AgentOSRegistry {
  private readonly capabilities = new Map<string, Capability>();
  private readonly connectors = new Map<string, ConnectorManifest>();
  private readonly tools = new Map<string, RegisteredTool>();
  private readonly resources = new Map<string, Resource>();

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

  summary(): RegistrySummary {
    return {
      capabilities: this.capabilities.size,
      connectors: this.connectors.size,
      tools: this.tools.size,
      resources: this.resources.size,
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

function createRegistryError(code: string, message: string): AgentOSError {
  return {
    code,
    message,
    recoverable: true,
  };
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
