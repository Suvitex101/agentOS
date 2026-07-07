import { describe, expect, it } from "vitest";
import {
  AgentOSRegistry,
  ConnectorDefinitionValidationError,
  ConnectorVisibility,
  defineConnector,
  defineMessagingConnector,
  defineTool,
  validateConnectorDefinitionConfig,
} from "@agentos/sdk";

const testTool = defineTool({
  id: "tool-connector-test",
  name: "Connector Test Tool",
  description: "A test tool for connector definitions.",
  capability: "messaging",
  version: "1.0.0",
  execute() {
    return {
      success: true,
      output: "ok",
      durationMs: 0,
      errors: [],
    };
  },
});

describe("defineConnector", () => {
  it("validates required fields and semantic version format", () => {
    const validation = validateConnectorDefinitionConfig({
      id: "",
      name: "",
      version: "1",
      capabilities: [],
      tools: [],
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors.map((error) => error.code)).toEqual([
      "connector_missing_id",
      "connector_missing_name",
      "connector_invalid_version",
      "connector_missing_capabilities",
      "connector_missing_tools",
      "connector_missing_health",
    ]);
  });

  it("throws typed validation errors", () => {
    expect(() =>
      defineConnector({
        id: "broken",
        name: "",
        description: "Broken connector",
        version: "1.0.0",
        capabilities: ["messaging"],
        tools: [testTool],
        health: undefined as never,
      })
    ).toThrow(ConnectorDefinitionValidationError);
  });

  it("creates an immutable connector definition", () => {
    const connector = defineConnector({
      id: "connector-test",
      name: "Connector Test",
      description: "A test connector.",
      version: "1.0.0",
      capabilities: ["messaging"],
      tools: [testTool],
      visibility: ConnectorVisibility.Public,
      health() {
        return {
          healthy: true,
        };
      },
    });

    expect(Object.isFrozen(connector)).toBe(true);
    expect(() => {
      (connector as { name: string }).name = "Changed";
    }).toThrow();
  });

  it("exposes inspect and summary output", () => {
    const connector = defineMessagingConnector({
      id: "connector-summary",
      name: "Summary Connector",
      description: "Summarizes connector details.",
      version: "1.2.3",
      tags: ["summary"],
      tools: [testTool],
      health() {
        return {
          healthy: true,
        };
      },
    });

    expect(connector.inspect()).toMatchObject({
      id: "connector-summary",
      version: "1.2.3",
      capabilityCount: 2,
      toolCount: 1,
    });
    expect(connector.summary()).toMatchObject({
      id: "connector-summary",
      capabilities: ["messaging", "communication"],
      toolCount: 1,
    });
  });

  it("registers with the AgentOS registry without adapters", () => {
    const registry = new AgentOSRegistry();
    const connector = defineMessagingConnector({
      id: "connector-registry",
      name: "Registry Connector",
      description: "Registers directly with AgentOSRegistry.",
      version: "1.0.0",
      tools: [testTool],
      health() {
        return {
          healthy: true,
        };
      },
    });

    for (const capability of connector.capabilities.capabilities) {
      registry.registerCapability(capability);
    }

    const result = registry.registerConnector(connector);

    expect(result.success).toBe(true);
    expect(registry.findConnectorById("connector-registry")).toBe(connector);
    expect(registry.findConnectorsByCapability("messaging")).toHaveLength(1);
  });
});
