# AgentOS Technical Overview

This document summarizes the current technical implementation of AgentOS for
grant review. It reflects the repository as implemented today.

## Architecture

AgentOS is a pnpm/Turborepo monorepo written in TypeScript. The main packages
are:

- `@agentosdev/types`: shared domain and architecture types
- `@agentosdev/core`: planner, execution engine, registry, tool and connector
  authoring helpers, runtime composition, and local connector bundle
- `@agentosdev/memory`: memory store contract and in-memory implementation
- `@agentosdev/sdk`: developer-facing exports
- `@agentosdev/config`: shared TypeScript configuration
- `@agentosdev/tools` and `@agentosdev/connectors`: placeholder packages for future
  package-specific expansion
- `apps/web`: a minimal Next.js shell for future dashboard work

The core execution shape is:

```text
Input -> Task -> Planner -> Plan -> Execution Engine -> Tool Resolver -> Registry -> Tool -> Result
```

The architecture is provider-agnostic. No external model provider or external
API is required for current local examples.

## Planner

Current implementation:

- `RuleBasedPlanner`
- deterministic keyword-based planning
- no LLM calls
- no network calls
- plan validation
- simple complexity estimation

The planner inspects task input and creates ordered plan steps for analysis,
messaging, payment, or default tasks. It implements the shared `Planner`
contract so future planners can be swapped in.

## Execution Engine

Current implementation:

- `SimpleExecutionEngine`
- sequential plan-step execution
- typed trace events
- tool resolution through `ToolResolver`
- local tool invocation
- structured `Result` output

The engine validates that a plan belongs to the task and has ordered steps. It
does not perform production orchestration, distributed execution, retries,
scheduling, or external side effects. Pause, resume, cancel, and retry are typed
placeholder control responses.

## Registry

`AgentOSRegistry` is the in-memory kernel catalog. It manages:

- capabilities
- connectors
- tools
- resources
- connector bundles

The registry supports registration, unregistration, discovery, summaries,
relationship validation, and bundle lifecycle helpers:

- `registerConnectorBundle()`
- `unregisterConnectorBundle()`
- `listConnectorBundles()`
- `findConnectorBundle()`

Connector bundles automatically register the connector, bundled capabilities,
tools, and resources. The implemented `LocalCommunityConnector` demonstrates
this lifecycle with local mocked community resources.

## Memory

Current implementation:

- `MemoryStore` interface
- `InMemoryMemoryStore`
- scoped memory records
- keyword search across content, type, scope, and metadata
- policy-aware writes
- list, read, delete, and clear behavior

Memory is currently in memory only. There is no database, vector search,
embedding generation, or semantic search.

## Tool SDK

The Tool SDK is implemented through `defineTool()` and helper factories:

- `defineMessagingTool()`
- `defineResearchTool()`
- `defineBusinessTool()`

Tool definitions are immutable, typed, inspectable, and compatible with the
registry. Tools return a standard `ToolExecutionResult` with success, output,
metadata, duration, and errors.

Current local mock tools include:

- `PrepareMessageTool`
- `SummarizeMessagesTool`
- `AnalyzeTextTool`
- `CreateInvoiceTool`
- `EchoTool`

## Connector SDK

The Connector SDK is implemented through `defineConnector()` and helper
factories:

- `defineMessagingConnector()`
- `defineResearchConnector()`
- `defineBusinessConnector()`

Connectors package capabilities, tools, resources, metadata, visibility, and a
health function. Connector definitions are immutable, validated, inspectable,
and registry-compatible.

`LocalCommunityConnector` is the first realistic local connector bundle. It is
not a real Discord, Slack, Telegram, or external provider connector. It exists
to validate the connector architecture using local mocked behavior.

## Runtime

`defineAgent()` composes:

- planner
- execution engine
- registry
- memory store
- metadata
- optional capabilities and permissions

`agent.run()` is implemented and performs:

1. input normalization into a `Task`
2. scoped memory search when enabled
3. planning
4. plan validation
5. execution
6. optional memory write
7. structured result return

The runtime remains local and simulated where tools are mocked.

## Testing

AgentOS uses Vitest. The current test structure includes:

- unit tests for tool definition, connector definition, registry, connector
  bundles, planner, memory store, tool resolver, and agent definition
- integration tests for `agent.run()` and connector bundle execution
- example verification tests that import every runnable example

The root scripts include:

- `pnpm test`
- `pnpm test:unit`
- `pnpm test:integration`
- `pnpm test:examples`
- `pnpm test:watch`

## CI

GitHub Actions CI runs on pull requests and pushes to `main`. The workflow:

1. checks out the repository
2. sets up pnpm and Node.js 20
3. installs dependencies with `pnpm install --frozen-lockfile`
4. checks formatting
5. runs typecheck
6. runs lint
7. runs tests
8. builds the monorepo
9. verifies examples

This gives the project a CI-friendly baseline for open-source collaboration.
