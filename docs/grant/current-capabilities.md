# AgentOS Current Capabilities

This document separates what is implemented from what is in progress or planned.
It is intentionally conservative.

## Implemented

### Repository Foundation

- TypeScript monorepo
- pnpm workspaces
- Turborepo
- shared TypeScript configuration
- ESLint
- Prettier
- Vitest
- GitHub Actions CI
- minimal Next.js app shell in `apps/web`

### Domain Model

Implemented shared types for:

- agents
- tasks
- plans and plan steps
- tools
- connectors
- memory records and policies
- execution context
- results
- execution traces
- missions
- capabilities
- resources
- planner contracts
- execution engine contracts
- registry contracts

### Planner

- `RuleBasedPlanner`
- deterministic keyword planning
- plan validation
- simple complexity estimation
- replanning metadata linkage

### Execution

- `SimpleExecutionEngine`
- sequential local execution
- tool resolution through `ToolResolver`
- local tool invocation
- structured `Result`
- typed execution trace
- typed placeholder control methods for pause, resume, cancel, and retry

### Registry

- in-memory `AgentOSRegistry`
- capability registration and discovery
- connector registration and discovery
- tool registration and discovery
- resource registration and discovery
- registry summary
- registry validation
- connector bundle registration and unregistration

### Memory

- `MemoryStore` contract
- `InMemoryMemoryStore`
- scoped memory records
- keyword search
- list, read, write, delete, and clear operations
- basic memory policy enforcement for writes

### Tool SDK

- `defineTool()`
- tool validation
- immutable tool definitions
- `inspect()`
- `summary()`
- helper factories for messaging, research, and business tools

### Connector SDK

- `defineConnector()`
- connector validation
- immutable connector definitions
- `inspect()`
- `summary()`
- helper factories for messaging, research, and business connectors
- `LocalCommunityConnector` as a local mocked connector bundle

### Runtime

- `defineAgent()`
- immutable agent definitions
- `inspect()`
- `summary()`
- `agent.run()` local end-to-end flow
- scoped memory read/write around execution

### Examples

Runnable examples exist for:

- basic agent
- community manager
- business assistant
- research assistant
- memory demo
- custom tool
- research connector
- community connector bundle

### Tests

- unit tests
- integration tests
- example verification tests
- CI integration

## In Progress

These areas have partial foundations but are not complete production features:

- connector architecture: SDK and local bundle exist, but no real provider
  connectors exist yet
- dashboard: `apps/web` exists as a minimal Next.js shell, but no dashboard
  functionality exists
- memory: in-memory implementation exists, but no persistent adapter exists
- runtime: local `agent.run()` exists, but production orchestration does not
- execution controls: pause, resume, cancel, and retry are typed placeholders

## Planned

Planned work includes:

- LLM provider abstraction
- real connector packages
- persistent memory adapters
- vector or semantic memory search
- documentation site
- playground or dashboard
- public alpha
- marketplace or plugin ecosystem
- distributed execution
- multi-agent collaboration
- production observability and policy controls

These are roadmap items and should not be described as implemented.
