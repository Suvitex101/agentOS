# AgentOS Roadmap

This roadmap distinguishes what exists today from what is planned or
aspirational. It is intentionally practical so contributors can understand where
to help.

## Completed

- Monorepo foundation with TypeScript, pnpm workspaces, Turborepo, Next.js,
  TailwindCSS, ESLint, and Prettier.
- Shared domain model for agents, tasks, plans, tools, connectors, memory,
  context, traces, results, missions, capabilities, and resources.
- Architecture contracts for planners, execution engines, registries,
  connectors, resources, and events.
- `RuleBasedPlanner` for deterministic local planning.
- `SimpleExecutionEngine` for local sequential plan execution.
- `AgentOSRegistry` as the in-memory kernel catalog.
- `MemoryStore` contract and `InMemoryMemoryStore`.
- `defineAgent()` composition API.
- `agent.run()` end-to-end local runtime.
- `ToolResolver` and local mock tool execution.
- Declarative `defineTool()` authoring API.
- Runnable examples.
- Vitest quality infrastructure.
- GitHub Actions CI.

## Next

- Connector SDK for defining provider integrations consistently.
- First local/mock connector implementation before real providers.
- LLM provider abstraction that keeps models optional and replaceable.
- Playground for experimenting with agents, tools, tasks, plans, and traces.
- Dashboard shell for inspecting agents, registry contents, memory, and runs.
- Documentation site for guides, architecture, API references, and examples.
- Public alpha focused on local development and contributor feedback.

## Future Ideas

These are aspirational and not committed implementation promises.

- Marketplace for community tools, connectors, planners, and templates.
- Distributed execution across workers or environments.
- Multi-agent collaboration primitives.
- Plugin ecosystem for third-party extensions.
- Persistent memory adapters.
- Vector search adapters.
- Production-grade observability and policy controls.
- Regional connector packs for messaging, payments, community management, and
  business workflows.

## How To Influence The Roadmap

Open a feature request for new ideas. For major architectural proposals,
describe:

- the problem
- the users affected
- the proposed shape
- alternatives considered
- tradeoffs
- how it fits AgentOS' task-centric architecture

Large changes should be discussed before implementation.
