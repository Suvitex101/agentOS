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
- `health()`

The returned connector exposes:

- `health()`
- `inspect()`
- `summary()`

Connectors package capabilities, tools, and resources. They do not need to call
external APIs.

## `AgentOSRegistry`

In-memory registry for:

- capabilities
- connectors
- tools
- resources
- connector bundles

Common methods:

- `registerCapability()`
- `registerConnector()`
- `registerTool()`
- `registerResource()`
- `registerConnectorBundle()`
- `unregisterConnectorBundle()`
- `findToolById()`
- `findToolsByCapability()`
- `findConnectorsByCapability()`
- `listCapabilities()`
- `listConnectors()`
- `listTools()`
- `listResources()`
- `summary()`
- `validate()`

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
