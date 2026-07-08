# Security Policy Engine

The Security Policy Engine evaluates connector security profiles before a
connector bundle is registered with the AgentOS Registry.

This phase is evaluation only. It does not add runtime sandboxing,
authentication, network controls, or secret management.

## Philosophy

Connector security should be explicit and reusable. The Registry should remain
focused on catalog registration, while security decisions live in a dedicated
policy engine that can later be reused by a CLI, dashboard, installer, or
runtime.

The engine is:

- provider-agnostic
- deterministic
- side-effect free
- inspectable
- independent of connector implementation details

## Evaluation Flow

```text
Connector Bundle
  -> Connector Security Profile
  -> SecurityPolicyEngine
  -> SecurityPolicyDecision
  -> Registry Registration
```

The registry asks the policy engine whether a connector bundle should be
accepted before registering any connector, capability, tool, or resource.

## Decisions

The engine returns one of three decisions:

- `Allow`: the connector may be registered.
- `Deny`: the connector violates policy and must not be registered.
- `RequiresApproval`: the connector may be acceptable, but requires an approval
  flow before registration.

Because AgentOS does not yet implement an approval flow, the Registry currently
blocks `RequiresApproval` connectors with a typed error. This avoids pretending
approval happened.

Every decision includes:

- `reasons`
- `warnings`
- `matchedRules`
- optional `metadata`

These fields are intended for debugging, tests, CLIs, dashboards, and future
review flows.

## Policy Configuration

`SecurityPolicyConfig` supports:

- `maximumRiskLevel`
- `allowedPermissions`
- `deniedPermissions`
- `allowFilesystemConnectors`
- `allowNetworkConnectors`
- `allowSecretsAccess`
- `requireApprovalAboveRiskLevel`
- `requireApprovalForPermissions`

Configuration is immutable once passed to `SecurityPolicyEngine`.

## Example Policies

### Strict Policy

Low-risk only. Filesystem, network, and secrets access are disabled.

```ts
const policy = SecurityPolicyEngine.strictPolicy();
```

### Developer Policy

Allows local filesystem connectors up to medium risk. Network and secrets access
are disabled.

```ts
const policy = SecurityPolicyEngine.developerPolicy();
```

### Enterprise Policy

Allows local filesystem work, denies network, external API, secrets, and command
execution permissions.

```ts
const policy = SecurityPolicyEngine.enterprisePolicy();
```

### Research Policy

Allows high-risk connectors only when they go through approval. Network and
secrets access remain disabled.

```ts
const policy = SecurityPolicyEngine.researchPolicy();
```

## Registry Integration

```ts
import { AgentOSRegistry, SecurityPolicyEngine, createFilesystemConnector } from "@agentos/sdk";

const registry = new AgentOSRegistry({
  securityPolicyEngine: SecurityPolicyEngine.developerPolicy(),
});

const connector = createFilesystemConnector({
  workspaceRoot: "./workspace",
});

const result = registry.registerConnectorBundle(connector);
```

If policy evaluation returns `Deny`, the registry returns
`registry_connector_denied_by_policy`.

If policy evaluation returns `RequiresApproval`, the registry returns
`registry_connector_requires_approval`.

In both cases, nothing is partially registered.

## Future Runtime Enforcement

Future phases may add enforcement at execution time:

- checking tool calls against connector policy
- requiring human approval before sensitive tool execution
- restricting filesystem access beyond connector-local checks
- restricting network destinations
- redacting secret values from traces and logs
- surfacing connector risk in a dashboard or CLI

Those features should build on the same policy decision model rather than
introducing separate security concepts.
