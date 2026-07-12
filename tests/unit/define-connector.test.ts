import { describe, expect, it } from "vitest";
import {
  AgentOSRegistry,
  ConnectorDefinitionValidationError,
  ConnectorPermission,
  ConnectorRiskLevel,
  ConnectorTrustLevel,
  ConnectorVisibility,
  defineConnector,
  defineMessagingConnector,
  defineTool,
  validateConnectorDefinitionConfig,
} from "@agentosdev/sdk";

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

  it("exposes connector security metadata through inspect and summary", () => {
    const connector = defineConnector({
      id: "connector-secure",
      name: "Secure Connector",
      description: "Connector with explicit security metadata.",
      version: "1.0.0",
      capabilities: ["storage"],
      tools: [testTool],
      security: {
        riskLevel: ConnectorRiskLevel.Medium,
        trustLevel: ConnectorTrustLevel.Local,
        permissions: [ConnectorPermission.ReadFiles],
        requiresUserApproval: false,
        networkAccess: false,
        filesystemAccess: true,
        secretsAccess: false,
      },
      health() {
        return {
          healthy: true,
        };
      },
    });

    expect(connector.inspect()).toMatchObject({
      riskLevel: ConnectorRiskLevel.Medium,
      trustLevel: ConnectorTrustLevel.Local,
      permissions: [ConnectorPermission.ReadFiles],
      securityProfile: {
        filesystemAccess: true,
        networkAccess: false,
      },
    });
    expect(connector.summary()).toMatchObject({
      riskLevel: ConnectorRiskLevel.Medium,
    });
  });

  it("validates invalid security metadata", () => {
    const validation = validateConnectorDefinitionConfig({
      id: "connector-risky",
      name: "Risky Connector",
      description: "Invalid security metadata.",
      version: "1.0.0",
      capabilities: ["search"],
      tools: [testTool],
      security: {
        riskLevel: ConnectorRiskLevel.High,
        trustLevel: ConnectorTrustLevel.Unknown,
        permissions: [],
        requiresUserApproval: true,
        networkAccess: true,
        filesystemAccess: false,
        secretsAccess: false,
      },
      health() {
        return {
          healthy: true,
        };
      },
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors.map((error) => error.code)).toEqual([
      "connector_security_missing_permissions",
      "connector_security_network_permission_required",
    ]);
  });

  it("requires explicit access flags for declared connector permissions", () => {
    const validation = validateConnectorDefinitionConfig({
      id: "connector-permissions",
      name: "Permission Connector",
      description: "Invalid permission flags.",
      version: "1.0.0",
      capabilities: ["storage"],
      tools: [testTool],
      security: {
        riskLevel: ConnectorRiskLevel.Medium,
        permissions: [
          ConnectorPermission.ReadFiles,
          ConnectorPermission.NetworkAccess,
          ConnectorPermission.SecretsAccess,
        ],
        requiresUserApproval: true,
        networkAccess: false,
        filesystemAccess: false,
        secretsAccess: false,
      },
      health() {
        return {
          healthy: true,
        };
      },
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors.map((error) => error.code)).toEqual([
      "connector_security_network_access_required",
      "connector_security_filesystem_access_required",
      "connector_security_secrets_access_required",
    ]);
  });

  it("rejects duplicate security permissions", () => {
    const validation = validateConnectorDefinitionConfig({
      id: "connector-duplicate-security",
      name: "Duplicate Security Connector",
      description: "Invalid duplicate security permissions.",
      version: "1.0.0",
      capabilities: ["storage"],
      tools: [testTool],
      security: {
        riskLevel: ConnectorRiskLevel.Medium,
        permissions: [ConnectorPermission.ReadFiles, ConnectorPermission.ReadFiles],
        requiresUserApproval: false,
        networkAccess: false,
        filesystemAccess: true,
        secretsAccess: false,
      },
      health() {
        return {
          healthy: true,
        };
      },
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors.map((error) => error.code)).toEqual([
      "connector_security_duplicate_permission",
    ]);
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
