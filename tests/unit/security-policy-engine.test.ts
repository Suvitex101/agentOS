import { describe, expect, it } from "vitest";
import {
  AgentOSRegistry,
  ConnectorPermission,
  ConnectorRiskLevel,
  ConnectorTrustLevel,
  SecurityPolicyDecisionType,
  SecurityPolicyEngine,
  createFilesystemConnector,
  defineConnector,
  defineTool,
  type ConnectorDefinition,
  type ConnectorSecurityProfile,
} from "@agentosdev/sdk";

function createPolicyTool(id: string) {
  return defineTool({
    id: `tool-${id}`,
    name: `Tool ${id}`,
    description: "Policy test tool.",
    capability: "storage",
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
}

function createPolicyConnector(
  id: string,
  security: ConnectorSecurityProfile
): ConnectorDefinition {
  return defineConnector({
    id,
    name: `Connector ${id}`,
    description: "Policy test connector.",
    version: "1.0.0",
    capabilities: ["storage"],
    tools: [createPolicyTool(id)],
    security,
    health() {
      return {
        healthy: true,
      };
    },
  });
}

describe("SecurityPolicyEngine", () => {
  it("allows a connector that satisfies the default policy", () => {
    const connector = createFilesystemConnector({
      workspaceRoot: "/tmp/agentos-policy-test",
    });
    const engine = new SecurityPolicyEngine();
    const decision = engine.evaluateConnector(connector);

    expect(decision.decision).toBe(SecurityPolicyDecisionType.Allow);
    expect(decision.reasons).toEqual([]);
    expect(decision.matchedRules).toContain("default_allow");
  });

  it("denies connectors above the configured maximum risk level", () => {
    const connector = createPolicyConnector("high-risk", {
      riskLevel: ConnectorRiskLevel.High,
      trustLevel: ConnectorTrustLevel.Community,
      permissions: [ConnectorPermission.ReadFiles],
      requiresUserApproval: false,
      networkAccess: false,
      filesystemAccess: true,
      secretsAccess: false,
    });
    const decision = SecurityPolicyEngine.strictPolicy().evaluateConnector(connector);

    expect(decision.decision).toBe(SecurityPolicyDecisionType.Deny);
    expect(decision.matchedRules).toContain("maximum_risk_level");
    expect(decision.reasons[0]).toContain("exceeds maximum allowed risk");
  });

  it("denies connectors with explicitly denied permissions", () => {
    const connector = createPolicyConnector("network-risk", {
      riskLevel: ConnectorRiskLevel.Medium,
      trustLevel: ConnectorTrustLevel.Community,
      permissions: [ConnectorPermission.NetworkAccess],
      requiresUserApproval: false,
      networkAccess: true,
      filesystemAccess: false,
      secretsAccess: false,
    });
    const decision = SecurityPolicyEngine.enterprisePolicy().evaluateConnector(connector);

    expect(decision.decision).toBe(SecurityPolicyDecisionType.Deny);
    expect(decision.matchedRules).toContain("denied_permissions");
  });

  it("requires approval for configured risk thresholds", () => {
    const connector = createPolicyConnector("research-risk", {
      riskLevel: ConnectorRiskLevel.High,
      trustLevel: ConnectorTrustLevel.Community,
      permissions: [ConnectorPermission.ReadFiles],
      requiresUserApproval: false,
      networkAccess: false,
      filesystemAccess: true,
      secretsAccess: false,
    });
    const decision = SecurityPolicyEngine.researchPolicy().evaluateConnector(connector);

    expect(decision.decision).toBe(SecurityPolicyDecisionType.RequiresApproval);
    expect(decision.matchedRules).toContain("approval_risk_level");
  });

  it("returns inspectable decisions with warnings for missing security profiles", () => {
    const connector = defineConnector({
      id: "missing-security",
      name: "Missing Security",
      description: "Connector without security metadata.",
      version: "1.0.0",
      capabilities: ["storage"],
      tools: [createPolicyTool("missing-security")],
      health() {
        return {
          healthy: true,
        };
      },
    });
    const decision = new SecurityPolicyEngine().evaluateConnector(connector);

    expect(decision.decision).toBe(SecurityPolicyDecisionType.Allow);
    expect(decision.warnings).toContain("Connector does not declare a security profile.");
    expect(decision.matchedRules).toContain("security_profile_missing");
    expect(decision.metadata).toMatchObject({
      connectorId: "missing-security",
    });
  });
});

describe("AgentOSRegistry security policy integration", () => {
  it("registers the FilesystemConnector under the default policy", () => {
    const registry = new AgentOSRegistry();
    const connector = createFilesystemConnector({
      workspaceRoot: "/tmp/agentos-policy-test",
    });
    const result = registry.registerConnectorBundle(connector);

    expect(result.success).toBe(true);
    expect(registry.findConnectorById("filesystem")).toBeDefined();
  });

  it("rejects denied connector bundles without partial registration", () => {
    const registry = new AgentOSRegistry({
      securityPolicyEngine: SecurityPolicyEngine.strictPolicy(),
    });
    const connector = createFilesystemConnector({
      workspaceRoot: "/tmp/agentos-policy-test",
    });
    const result = registry.registerConnectorBundle(connector);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("registry_connector_denied_by_policy");
    expect(registry.findConnectorById("filesystem")).toBeUndefined();
    expect(registry.listTools()).toHaveLength(0);
    expect(registry.listResources()).toHaveLength(0);
  });

  it("rejects approval-required connector bundles until an approval flow exists", () => {
    const registry = new AgentOSRegistry({
      securityPolicyEngine: SecurityPolicyEngine.researchPolicy(),
    });
    const connector = createPolicyConnector("approval-needed", {
      riskLevel: ConnectorRiskLevel.High,
      trustLevel: ConnectorTrustLevel.Community,
      permissions: [ConnectorPermission.ReadFiles],
      requiresUserApproval: false,
      networkAccess: false,
      filesystemAccess: true,
      secretsAccess: false,
    });
    const result = registry.registerConnectorBundle(connector);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("registry_connector_requires_approval");
    expect(result.error?.metadata?.securityDecision).toMatchObject({
      decision: SecurityPolicyDecisionType.RequiresApproval,
    });
    expect(registry.findConnectorById("approval-needed")).toBeUndefined();
  });
});
