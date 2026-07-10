# AgentOS API Reference

This is a starter reference for the main public exports from `@agentos/sdk`.
It reflects the current implementation.

## `defineAgent(config)`

Creates an immutable agent definition from replaceable components.

Required core inputs:

- `id`
- `name`
- `description`
- `planner`
- `executionEngine`
- `registry`
- `memoryStore`

The returned agent exposes:

- `run(input, options?)`
- `inspect()`
- `summary()`

Current behavior: `agent.run()` normalizes input into a task, reads memory when
enabled, plans, validates, executes, optionally writes memory, and returns a
structured result.

## `defineTool(config)`

Creates an immutable local tool definition.

Important fields:

- `id`
- `name`
- `description`
- `capability`
- `version`
- `execute(context)`

The returned tool exposes:

- `execute(input, executionContext)`
- `inspect()`
- `summary()`

Tools return `ToolExecutionResult`.

## `defineConnector(config)`

Creates an immutable connector definition.

Important fields:

- `id`
- `name`
- `description`
- `version`
- `capabilities`
- `tools`
- `resources`
- `security`
- `health()`

The returned connector exposes:

- `health()`
- `inspect()`
- `summary()`

Connectors package capabilities, tools, and resources. They do not need to call
external APIs.

`security` is optional metadata today. It can declare connector risk level,
trust level, permissions, and access flags such as `networkAccess`,
`filesystemAccess`, and `secretsAccess`.

## `defineModelProvider(config)`

Creates an immutable model provider definition.

Important fields:

- `id`
- `name`
- `description`
- `version`
- `author`
- `tags`
- `metadata`
- `capabilities`
- `generate(request)`

The returned provider exposes:

- `generate(request)`
- `inspect()`
- `summary()`

Request shape:

- `prompt`
- `systemPrompt`
- `temperature`
- `maxTokens`
- `metadata`

Response shape:

- `text`
- `usage`
- `metadata`
- `finishReason`
- `provider`
- `model`
- `durationMs`

Built-in local providers:

- `MockModelProvider`
- `EchoModelProvider`

Provider capabilities are extensible strings. Common exported capability
constants include:

- `ModelProviderCapability.TextGeneration`
- `ModelProviderCapability.Reasoning`
- `ModelProviderCapability.LongContext`
- `ModelProviderCapability.Embeddings`
- `ModelProviderCapability.Multimodal`
- `ModelProviderCapability.StructuredOutput`

Current behavior: provider definitions are local abstractions. They are
discoverable through the registry, but they are not integrated with planners or
runtime execution yet.

## `AgentOSRegistry`

In-memory registry for:

- capabilities
- connectors
- tools
- resources
- connector bundles
- model providers

Common methods:

- `registerCapability()`
- `registerConnector()`
- `registerTool()`
- `registerResource()`
- `registerConnectorBundle()`
- `unregisterConnectorBundle()`
- `registerModelProvider()`
- `unregisterModelProvider()`
- `findModelProvider()`
- `listModelProviders()`
- `setDefaultModelProvider()`
- `clearDefaultModelProvider()`
- `defaultModelProvider()`
- `findToolById()`
- `findToolsByCapability()`
- `findConnectorsByCapability()`
- `listCapabilities()`
- `listConnectors()`
- `listTools()`
- `listResources()`
- `summary()`
- `validate()`

The registry can receive a `SecurityPolicyEngine` and delegates connector bundle
admission to it before registration.

## `ModelProviderResolver`

Resolves model providers from an `AgentOSRegistry`.

Resolution inputs can include:

- explicit provider id
- capability
- default provider

The resolver exists so planners and future orchestration code do not depend on
registry implementation details directly.

## `SecurityPolicyEngine`

Pure evaluator for connector security profiles.

Methods:

- `evaluateConnector(connector)`
- `evaluateSecurityProfile(security, metadata?)`

Decisions:

- `Allow`
- `Deny`
- `RequiresApproval`

Helper policies:

- `SecurityPolicyEngine.strictPolicy()`
- `SecurityPolicyEngine.developerPolicy()`
- `SecurityPolicyEngine.enterprisePolicy()`
- `SecurityPolicyEngine.researchPolicy()`

## `RuleBasedPlanner`

Deterministic local planner.

Methods:

- `plan(agent, task, context, options?)`
- `replan(agent, task, context, previousPlan, options?)`
- `validatePlan(plan)`
- `estimateComplexity(task)`

Current behavior: creates simple plans based on task keywords such as
summarize, analyze, message, email, payment, and invoice.

## `SimpleExecutionEngine`

Local sequential execution engine.

Methods:

- `executePlan(agent, task, plan, context, options?)`
- `executeStep(agent, task, plan, step, context, options?)`
- `pause(executionId)`
- `resume(executionId)`
- `cancel(executionId)`
- `retry(executionId)`

Current behavior: executes plan steps sequentially using `ToolResolver` and
registered local tools. Control methods are typed placeholders.

## `InMemoryMemoryStore`

In-memory implementation of the `MemoryStore` contract.

Methods:

- `write(record)`
- `read(id)`
- `search(query)`
- `list(scope?)`
- `delete(id)`
- `clear(scope?)`

Current behavior: scoped keyword search over local memory records. No
persistence, embeddings, or vector search.

## `ToolResolver`

Resolves registered tools from an `AgentOSRegistry`.

Resolution inputs can include:

- explicit tool id
- capability
- plan step type
- plan step description

The execution engine uses the resolver instead of depending directly on
concrete tools.

## `LocalCommunityConnector`

Local mocked connector bundle.

Represents a local community platform and bundles:

- messaging capability
- community capability
- search capability
- local mocked tools
- local mocked community resources

Register it with:

```ts
import { AgentOSRegistry, LocalCommunityConnector } from "@agentos/sdk";

const registry = new AgentOSRegistry();

registry.registerConnectorBundle(LocalCommunityConnector);
```

This is not a real Discord, Slack, Telegram, or external provider connector.

## `createFilesystemConnector(options)`

Creates a safe local filesystem connector using the connector bundle
architecture.

Required options:

- `workspaceRoot`: directory that all filesystem tool paths are confined to

Optional options:

- `id`
- `name`
- `description`
- `version`

The connector exposes:

- storage capability
- search capability
- `ListFilesTool`
- `ReadFileTool`
- `WriteFileTool`
- `SearchFilesTool`

Example:

```ts
import { AgentOSRegistry, createFilesystemConnector } from "@agentos/sdk";

const registry = new AgentOSRegistry();
const filesystemConnector = createFilesystemConnector({
  workspaceRoot: "./workspace",
});

registry.registerConnectorBundle(filesystemConnector);
```

Safety model:

- paths are resolved relative to `workspaceRoot`
- absolute paths are denied
- traversal outside `workspaceRoot` is denied
- writes outside `workspaceRoot` are denied
- search skips non-text files and large files

This is a real local connector. It does not call external APIs and does not
provide authentication, file watching, or remote storage behavior.

## `createHttpConnector(options)`

Creates a secure HTTP connector for controlled HTTPS GET requests.

Required options:

- `allowlist`: HTTPS origins the connector may access

Optional options:

- `timeoutMs`
- `maxResponseBytes`
- `id`
- `name`
- `description`
- `version`
- `fetchImplementation`

The connector exposes:

- network capability
- retrieval capability
- `HttpGetTool`

Example:

```ts
import { AgentOSRegistry, createHttpConnector } from "@agentos/sdk";

const registry = new AgentOSRegistry();
const httpConnector = createHttpConnector({
  allowlist: ["https://example.com"],
});

registry.registerConnectorBundle(httpConnector);
```

Safety behavior:

- only HTTPS URLs are allowed
- only GET is supported
- redirects are rejected
- localhost, loopback, link-local, and private IP targets are rejected
- allowlisted hostnames that resolve to private IP targets are rejected
- credentials embedded in URLs are rejected
- responses above `maxResponseBytes` fail safely
- requests exceeding `timeoutMs` fail safely
- sensitive request headers are rejected
- sensitive response headers are redacted

Current limitations: no authentication, OAuth, cookies, sessions, POST, PUT,
DELETE, WebSockets, streaming, or provider-specific clients.
