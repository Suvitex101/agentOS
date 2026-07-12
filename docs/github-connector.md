# GitHub Connector

The GitHub Connector is AgentOS' first production-grade external connector. It
uses the existing Connector SDK, Credential SDK, Registry, Tool Resolver, and
tool execution flow.

It is read-first by default. Write operations are optional and require explicit
configuration.

## Authentication

Use a GitHub Personal Access Token through the Credential SDK:

```ts
import { CredentialType, createGitHubConnector } from "@agentosdev/sdk";

const github = createGitHubConnector({
  credential: {
    type: CredentialType.Environment,
    name: "GITHUB_TOKEN",
  },
});
```

The connector resolves credentials at request time and sends:

```text
Authorization: Bearer <token>
```

Resolved tokens are not stored in connector definitions, metadata, summaries,
inspection output, traces, or errors.

For tests and examples, static credentials are supported by the Credential SDK,
but they are development-only and should not be used in production.

## Capabilities

The connector exposes:

- `repository`
- `source-code`
- `issues`
- `search`

## Supported Tools

Read tools enabled by default:

- `GetRepositoryTool`
- `ListRepositoriesTool`
- `ReadFileTool`
- `SearchCodeTool`
- `ListIssuesTool`
- `GetIssueTool`

Optional write tool:

- `CreateIssueTool`

`CreateIssueTool` is only bundled when `enableWrites: true`. Write-enabled
connectors are marked high risk and `requiresUserApproval: true`, so the default
registry policy rejects them until an approval workflow exists.

## Registration

```ts
import { AgentOSRegistry, CredentialType, createGitHubConnector } from "@agentosdev/sdk";

const registry = new AgentOSRegistry();
const github = createGitHubConnector({
  credential: {
    type: CredentialType.Environment,
    name: "GITHUB_TOKEN",
  },
});

const registration = registry.registerConnectorBundle(github);
```

Bundle registration adds the connector, capabilities, tools, and API resource to
the registry as one unit.

## Safety Model

The connector implements:

- request timeout
- response size limit
- redirect rejection
- typed HTTP errors
- GitHub rate-limit detection
- one retry for safe GET requests on retryable responses
- secret redaction in inspectable objects and tool results

It does not expose the credential in tool outputs or metadata.

## Rate Limits

GitHub rate-limit headers are captured in safe metadata:

- `x-ratelimit-limit`
- `x-ratelimit-remaining`
- `x-ratelimit-reset`

If GitHub returns a rate-limited response, tools return a typed
`github_rate_limited` error.

## Example

Run the deterministic mocked example:

```bash
pnpm example:github
```

The example registers the connector, resolves bundled tools through
`ToolResolver`, and executes mocked GitHub REST calls without requiring network
access or a token.

## Current Limitations

- no OAuth flow
- no GitHub App installation flow
- no pagination helpers beyond `perPage` and `page`
- no GraphQL API support
- no webhook support
- no live API calls in CI
- write support is limited to optional issue creation and is policy-gated
