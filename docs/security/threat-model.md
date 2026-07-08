# Connector Threat Model

This threat model covers current local connectors and future provider
connectors. It is intentionally provider-agnostic.

## Scope

Current AgentOS connector security is metadata and validation only. Runtime
enforcement is not implemented yet. Registration-time policy evaluation is
implemented through `SecurityPolicyEngine`.

Covered components:

- connector definitions
- connector bundles
- tool execution boundaries
- local filesystem connector
- HTTP connector
- future network and cloud connectors

## Threats

### Path Traversal

Risk: a connector reads or writes outside an intended workspace using paths such
as `../secrets.txt`.

Current mitigation in `FilesystemConnector`:

- paths resolve relative to `workspaceRoot`
- absolute paths are rejected
- traversal outside the workspace is rejected
- real paths are checked before read/write
- symlinks are skipped during traversal

Future work:

- formal runtime policy checks for filesystem access
- configurable file size and extension policies

### SSRF

Risk: a future HTTP connector fetches internal metadata services or private
network resources.

Current mitigation in `HttpConnector`:

- only HTTPS GET is supported
- allowed destinations must match configured origins
- localhost and `.localhost` hostnames are rejected
- loopback, link-local, and RFC1918 IP literals are rejected
- DNS results are checked for loopback, link-local, and RFC1918 addresses
- redirects are disabled
- response size and timeout limits are enforced

Future mitigation:

- require explicit network permissions
- restrict allowed hosts or URL patterns
- block local/private address ranges by default
- enforce request timeouts and response size limits

### Secret Leakage

Risk: connectors expose environment variables, credentials, tokens, or provider
secrets in outputs, logs, errors, or traces.

Current model:

- `ConnectorPermission.SecretsAccess`
- `secretsAccess` flag

Future mitigation:

- deny secrets access by default
- redact known secret fields in logs and traces
- separate secret references from secret values

### Unsafe Logging

Risk: connector metadata, tool outputs, or errors include sensitive values.

Future mitigation:

- logging guidelines for connector authors
- redaction utilities
- trace metadata review for sensitive fields

### Command Execution

Risk: a connector executes shell commands or arbitrary scripts.

Current model:

- `ConnectorPermission.ExecuteCommands`

Future mitigation:

- treat command execution as high or critical risk
- require explicit approval
- sandbox execution where possible
- log command metadata without leaking sensitive arguments

### Excessive Permissions

Risk: connectors request broad access they do not need.

Current mitigation:

- security profiles are inspectable
- high and critical risk connectors must declare permissions
- connector bundles are evaluated by `SecurityPolicyEngine` before registration

Future mitigation:

- enforce policy at execution time
- surface warnings in CLI or dashboard
- reject connectors that exceed configured policy

## Security Posture By Connector

### FilesystemConnector

Current risk: `Medium`

Declared permissions:

- `ReadFiles`
- `WriteFiles`

Declared access:

- `filesystemAccess: true`
- `networkAccess: false`
- `secretsAccess: false`

Important limitation: the connector can read and write within its configured
workspace. Developers should choose `workspaceRoot` carefully.

### HttpConnector

Current risk: `Medium`

Declared permissions:

- `NetworkAccess`

Declared access:

- `networkAccess: true`
- `filesystemAccess: false`
- `secretsAccess: false`

Important limitation: the connector only supports GET requests to configured
HTTPS origins. It does not implement authentication, cookies, request bodies, or
state-changing methods.

## Open Questions

- Should security policy enforcement happen at registration time, execution
  time, or both?
- Should connector bundles be signed or checksummed in future public releases?
- How should dashboards display security warnings?
- What approval flow should high-risk connectors use?
- How should secret references be represented without exposing secret values?
