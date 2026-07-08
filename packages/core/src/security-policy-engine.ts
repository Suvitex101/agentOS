import {
  ConnectorPermission,
  ConnectorRiskLevel,
  SecurityPolicyDecisionType,
  type ConnectorManifest,
  type ConnectorSecurityProfile,
  type SecurityPolicyConfig,
  type SecurityPolicyDecision,
} from "@agentos/types";

const RISK_ORDER: Record<ConnectorRiskLevel, number> = {
  [ConnectorRiskLevel.Low]: 1,
  [ConnectorRiskLevel.Medium]: 2,
  [ConnectorRiskLevel.High]: 3,
  [ConnectorRiskLevel.Critical]: 4,
};

const DEFAULT_SECURITY_POLICY_CONFIG: Required<
  Pick<
    SecurityPolicyConfig,
    | "maximumRiskLevel"
    | "allowFilesystemConnectors"
    | "allowNetworkConnectors"
    | "allowSecretsAccess"
  >
> = Object.freeze({
  maximumRiskLevel: ConnectorRiskLevel.Critical,
  allowFilesystemConnectors: true,
  allowNetworkConnectors: true,
  allowSecretsAccess: true,
});

export class SecurityPolicyEngine {
  readonly config: Readonly<SecurityPolicyConfig>;

  constructor(config: SecurityPolicyConfig = {}) {
    this.config = freezePolicyConfig({
      ...DEFAULT_SECURITY_POLICY_CONFIG,
      ...config,
    });
  }

  evaluateConnector(connector: ConnectorManifest): SecurityPolicyDecision {
    return this.evaluateSecurityProfile(connector.security, {
      connectorId: connector.id,
      connectorName: connector.name,
    });
  }

  evaluateSecurityProfile(
    security: ConnectorSecurityProfile | undefined,
    metadata: Record<string, unknown> = {}
  ): SecurityPolicyDecision {
    const denyReasons: string[] = [];
    const approvalReasons: string[] = [];
    const warnings: string[] = [];
    const matchedRules: string[] = [];

    if (!security) {
      warnings.push("Connector does not declare a security profile.");
      matchedRules.push("security_profile_missing");

      return createDecision(SecurityPolicyDecisionType.Allow, [], warnings, matchedRules, metadata);
    }

    const maximumRiskLevel = this.config.maximumRiskLevel ?? ConnectorRiskLevel.Critical;

    if (isRiskAbove(security.riskLevel, maximumRiskLevel)) {
      denyReasons.push(
        `Connector risk "${security.riskLevel}" exceeds maximum allowed risk "${maximumRiskLevel}".`
      );
      matchedRules.push("maximum_risk_level");
    }

    const deniedPermissions = this.config.deniedPermissions ?? [];
    const deniedPermissionMatches = security.permissions.filter((permission) =>
      deniedPermissions.includes(permission)
    );

    if (deniedPermissionMatches.length > 0) {
      denyReasons.push(
        `Connector declares denied permissions: ${deniedPermissionMatches.join(", ")}.`
      );
      matchedRules.push("denied_permissions");
    }

    const allowedPermissions = this.config.allowedPermissions;

    if (allowedPermissions) {
      const disallowedPermissions = security.permissions.filter(
        (permission) => !allowedPermissions.includes(permission)
      );

      if (disallowedPermissions.length > 0) {
        denyReasons.push(
          `Connector declares permissions outside the allowed set: ${disallowedPermissions.join(
            ", "
          )}.`
        );
        matchedRules.push("allowed_permissions");
      }
    }

    if (this.config.allowFilesystemConnectors === false && security.filesystemAccess) {
      denyReasons.push("Filesystem connector access is disabled by policy.");
      matchedRules.push("filesystem_access_disabled");
    }

    if (this.config.allowNetworkConnectors === false && security.networkAccess) {
      denyReasons.push("Network connector access is disabled by policy.");
      matchedRules.push("network_access_disabled");
    }

    if (this.config.allowSecretsAccess === false && security.secretsAccess) {
      denyReasons.push("Secrets access is disabled by policy.");
      matchedRules.push("secrets_access_disabled");
    }

    if (
      this.config.requireApprovalAboveRiskLevel &&
      isRiskAbove(security.riskLevel, this.config.requireApprovalAboveRiskLevel)
    ) {
      approvalReasons.push(
        `Connector risk "${security.riskLevel}" requires approval above "${this.config.requireApprovalAboveRiskLevel}".`
      );
      matchedRules.push("approval_risk_level");
    }

    const approvalPermissions = this.config.requireApprovalForPermissions ?? [];
    const approvalPermissionMatches = security.permissions.filter((permission) =>
      approvalPermissions.includes(permission)
    );

    if (approvalPermissionMatches.length > 0) {
      approvalReasons.push(
        `Connector permissions require approval: ${approvalPermissionMatches.join(", ")}.`
      );
      matchedRules.push("approval_permissions");
    }

    if (security.requiresUserApproval) {
      approvalReasons.push("Connector security profile requires user approval.");
      matchedRules.push("connector_requires_user_approval");
    }

    if (denyReasons.length > 0) {
      return createDecision(
        SecurityPolicyDecisionType.Deny,
        denyReasons,
        warnings,
        matchedRules,
        metadata
      );
    }

    if (approvalReasons.length > 0) {
      return createDecision(
        SecurityPolicyDecisionType.RequiresApproval,
        approvalReasons,
        warnings,
        matchedRules,
        metadata
      );
    }

    matchedRules.push("default_allow");

    return createDecision(SecurityPolicyDecisionType.Allow, [], warnings, matchedRules, metadata);
  }

  static strictPolicy(): SecurityPolicyEngine {
    return new SecurityPolicyEngine({
      maximumRiskLevel: ConnectorRiskLevel.Low,
      allowFilesystemConnectors: false,
      allowNetworkConnectors: false,
      allowSecretsAccess: false,
    });
  }

  static developerPolicy(): SecurityPolicyEngine {
    return new SecurityPolicyEngine({
      maximumRiskLevel: ConnectorRiskLevel.Medium,
      allowFilesystemConnectors: true,
      allowNetworkConnectors: false,
      allowSecretsAccess: false,
    });
  }

  static enterprisePolicy(): SecurityPolicyEngine {
    return new SecurityPolicyEngine({
      maximumRiskLevel: ConnectorRiskLevel.High,
      allowFilesystemConnectors: true,
      allowNetworkConnectors: false,
      allowSecretsAccess: false,
      deniedPermissions: [
        ConnectorPermission.NetworkAccess,
        ConnectorPermission.ExternalAPI,
        ConnectorPermission.SecretsAccess,
        ConnectorPermission.ExecuteCommands,
      ],
    });
  }

  static researchPolicy(): SecurityPolicyEngine {
    return new SecurityPolicyEngine({
      maximumRiskLevel: ConnectorRiskLevel.High,
      allowFilesystemConnectors: true,
      allowNetworkConnectors: false,
      allowSecretsAccess: false,
      requireApprovalAboveRiskLevel: ConnectorRiskLevel.Medium,
    });
  }
}

function freezePolicyConfig(config: SecurityPolicyConfig): Readonly<SecurityPolicyConfig> {
  return Object.freeze({
    ...config,
    allowedPermissions: config.allowedPermissions
      ? (Object.freeze([...config.allowedPermissions]) as ConnectorPermission[])
      : undefined,
    deniedPermissions: config.deniedPermissions
      ? (Object.freeze([...config.deniedPermissions]) as ConnectorPermission[])
      : undefined,
    requireApprovalForPermissions: config.requireApprovalForPermissions
      ? (Object.freeze([...config.requireApprovalForPermissions]) as ConnectorPermission[])
      : undefined,
  });
}

function createDecision(
  decision: SecurityPolicyDecisionType,
  reasons: string[],
  warnings: string[],
  matchedRules: string[],
  metadata: Record<string, unknown>
): SecurityPolicyDecision {
  return Object.freeze({
    decision,
    reasons: Object.freeze([...reasons]) as string[],
    warnings: Object.freeze([...warnings]) as string[],
    matchedRules: Object.freeze([...matchedRules]) as string[],
    metadata,
  });
}

function isRiskAbove(riskLevel: ConnectorRiskLevel, maximumRiskLevel: ConnectorRiskLevel): boolean {
  return RISK_ORDER[riskLevel] > RISK_ORDER[maximumRiskLevel];
}
