import {
  CapabilityCategory,
  ConnectorAuthType,
  ResourceType,
  ToolCategory,
  ToolPermissionLevel,
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
  const messagingCapability: Capability = {
    id: "capability-messaging",
    name: "Messaging",
    description: "Read, search, and post messages across provider-backed channels.",
    category: CapabilityCategory.Messaging,
    supportedConnectors: ["connector-discord"],
  };

  const searchMessagesTool: RegisteredTool<{ query: string }, { messages: string[] }> = {
    id: "tool-discord-search-messages",
    name: "searchMessages",
    description: "Mocked Discord message search tool.",
    category: ToolCategory.Communication,
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
    },
    outputSchema: {
      type: "object",
      properties: {
        messages: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    permissionLevel: ToolPermissionLevel.Read,
    capabilityIds: [messagingCapability.id],
    connectorId: "connector-discord",
    execute: () => ({ messages: [] }),
  };

  const postMessageTool: RegisteredTool<
    { channelId: string; content: string },
    { messageId: string }
  > = {
    id: "tool-discord-post-message",
    name: "postMessage",
    description: "Mocked Discord message posting tool.",
    category: ToolCategory.Communication,
    inputSchema: {
      type: "object",
      properties: {
        channelId: { type: "string" },
        content: { type: "string" },
      },
      required: ["channelId", "content"],
    },
    outputSchema: {
      type: "object",
      properties: {
        messageId: { type: "string" },
      },
    },
    permissionLevel: ToolPermissionLevel.Write,
    capabilityIds: [messagingCapability.id],
    connectorId: "connector-discord",
    execute: () => ({ messageId: "mock-message-id" }),
  };

  registry.registerCapability(messagingCapability);
  registry.registerConnector({
    id: "connector-discord",
    name: "Discord",
    provider: {
      id: "provider-discord",
      name: "discord",
      displayName: "Discord",
    },
    version: {
      current: "0.1.0",
    },
    capabilities: {
      capabilities: [messagingCapability],
      tools: [searchMessagesTool, postMessageTool],
    },
    authType: ConnectorAuthType.OAuth2,
  });
  registry.registerTool(searchMessagesTool);
  registry.registerTool(postMessageTool);
  registry.registerResource({
    id: "resource-discord-builders-channel",
    type: ResourceType.Channel,
    source: "connector-discord",
    uri: "discord://guilds/agentos/channels/builders",
    metadata: {
      provider: "discord",
      name: "builders",
    },
  });

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
