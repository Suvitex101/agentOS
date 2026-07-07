import { describe, expect, it } from "vitest";
import {
  AgentOSRegistry,
  LocalCommunityConnector,
  ResourceType,
  defineConnector,
} from "@agentos/sdk";

describe("connector bundles", () => {
  it("registers a connector bundle and discovers its contents", () => {
    const registry = new AgentOSRegistry();
    const result = registry.registerConnectorBundle(LocalCommunityConnector);

    expect(result.success).toBe(true);
    expect(registry.findConnectorById(LocalCommunityConnector.id)?.name).toBe(
      "Local Community Connector"
    );
    expect(registry.findCapabilityById("community")?.name).toBe("Community");
    expect(registry.findToolsByCapability("community")).toHaveLength(3);
    expect(registry.listResources()).toHaveLength(5);
    expect(registry.listConnectorBundles()).toHaveLength(1);
    expect(registry.findConnectorBundle(LocalCommunityConnector.id)?.toolIds).toEqual([
      "tool-prepare-message",
      "tool-summarize-messages",
      "tool-analyze-text",
    ]);
  });

  it("prevents duplicate connector bundles", () => {
    const registry = new AgentOSRegistry();

    expect(registry.registerConnectorBundle(LocalCommunityConnector).success).toBe(true);

    const duplicate = registry.registerConnectorBundle(LocalCommunityConnector);

    expect(duplicate.success).toBe(false);
    expect(duplicate.error?.code).toBe("registry_duplicate_connector_bundle");
  });

  it("prevents bundled resource ids that already exist in the registry", () => {
    const connector = defineConnector({
      id: "bad-local-community",
      name: "Bad Local Community",
      description: "Connector with an existing resource id.",
      version: "1.0.0",
      capabilities: ["community"],
      tools: [LocalCommunityConnector.capabilities.tools[0]!],
      resources: [
        {
          id: "existing-resource",
          type: ResourceType.Channel,
          source: "bad-local-community",
          uri: "local://community/one",
        },
      ],
      health() {
        return {
          healthy: true,
        };
      },
    });
    const registry = new AgentOSRegistry();

    registry.registerResource({
      id: "existing-resource",
      type: ResourceType.Channel,
      source: "manual",
      uri: "local://manual/resource",
    });

    const result = registry.registerConnectorBundle(connector);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("registry_duplicate_bundled_resource");
  });

  it("unregisters a bundle and cleans up owned entries", () => {
    const registry = new AgentOSRegistry();

    registry.registerConnectorBundle(LocalCommunityConnector);

    const result = registry.unregisterConnectorBundle(LocalCommunityConnector.id);

    expect(result.success).toBe(true);
    expect(registry.findConnectorById(LocalCommunityConnector.id)).toBeUndefined();
    expect(registry.findToolById("tool-summarize-messages")).toBeUndefined();
    expect(registry.findResourceById("local-community-main")).toBeUndefined();
    expect(registry.findConnectorBundle(LocalCommunityConnector.id)).toBeUndefined();
    expect(registry.summary()).toMatchObject({
      connectors: 0,
      tools: 0,
      resources: 0,
    });
  });
});
