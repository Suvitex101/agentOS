# Connector Security

AgentOS connectors are the boundary between the agent runtime and external or
local systems. Phase 23 introduces connector security metadata so those
boundaries are explicit, inspectable, and reusable.

This phase does not enforce runtime security policy yet. It defines the model
future enforcement will use.

## Philosophy

Connector security should be:

- **explicit:** connectors declare their risk, trust, and permissions
- **provider-agnostic:** the same model should apply to filesystem, HTTP,
  messaging, payments, and future connectors
- **least privilege:** connectors should request only the permissions they need
- **inspectable:** developers and future dashboards should be able to inspect a
  connector before using it
- **composable:** registry, runtime, policy, and UI layers should be able to
  reuse the same metadata

## Security Profile

Connectors can expose a `security` profile:

```ts
security: {
  riskLevel: ConnectorRiskLevel.Medium,
  trustLevel: ConnectorTrustLevel.Local,
  permissions: [
    ConnectorPermission.ReadFiles,
    ConnectorPermission.WriteFiles,
  ],
  requiresUserApproval: false,
  networkAccess: false,
  filesystemAccess: true,
  secretsAccess: false,
}
```

The profile is metadata today. It is returned by `connector.inspect()` and
stored on the connector manifest.

The [Security Policy Engine](policy-engine.md) can evaluate this profile before
connector bundle registration.

## Permissions

Current generic connector permissions:

- `ReadFiles`
- `WriteFiles`
- `NetworkAccess`
- `ExternalAPI`
- `EnvironmentVariables`
- `ExecuteCommands`
- `SecretsAccess`

These are intentionally broad. Provider-specific connectors can add details in
metadata later without changing the core model.

## Risk And Trust

Risk levels:

- `Low`
- `Medium`
- `High`
- `Critical`

Trust levels:

- `Unknown`
- `Local`
- `Remote`
- `Community`
- `Verified`
- `Official`

Risk describes potential impact. Trust describes provenance or review status.
They are related but not the same.

## Validation

Connector validation currently checks:

- high or critical risk connectors must declare permissions
- network permissions require `networkAccess: true`
- `networkAccess: true` requires a network permission
- file permissions require `filesystemAccess: true`
- `filesystemAccess: true` requires a file permission
- secrets permission requires `secretsAccess: true`
- `secretsAccess: true` requires `SecretsAccess`
- duplicate security permissions are rejected

This is validation only. Runtime policy enforcement is future work.

## Policy Evaluation

Phase 24 introduces `SecurityPolicyEngine`, which evaluates connector security
profiles and returns:

- `Allow`
- `Deny`
- `RequiresApproval`

The AgentOS Registry delegates connector bundle admission to this engine. Denied
or approval-required bundles are not partially registered.

## Future Enforcement

Future phases may use `ConnectorSecurityPolicy` to:

- block connectors above a configured risk level
- require user approval before registration or execution
- deny specific permissions
- restrict network access
- restrict filesystem access
- restrict secrets access
- surface security warnings in a dashboard or CLI

Runtime enforcement should be added carefully and tested against real connector
threat models.
