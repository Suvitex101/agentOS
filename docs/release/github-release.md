# AgentOS v0.1.0-alpha.1

First public alpha release for AgentOS.

AgentOS is an open-source, task-centric infrastructure layer for building
intelligent agents. It is designed around tasks, plans, registries, tools,
connectors, memory, and provider-agnostic reasoning engines rather than around
one model vendor.

This is an alpha release. It is intended for experimentation, contribution,
architecture review, and early integration feedback rather than production
deployment.

## Highlights

- Task-centric agent runtime: `Input -> Task -> Planner -> Plan -> Execution -> Result`
- `defineAgent()` composition API with local `agent.run()`
- `RuleBasedPlanner` and `ModelAssistedPlanner`
- `SimpleExecutionEngine` with typed traces and tool calls
- In-memory `AgentOSRegistry`
- In-memory memory store
- Declarative Tool SDK
- Declarative Connector SDK
- Filesystem connector
- Safe GET-only HTTP connector
- Read-first GitHub connector
- Model Provider SDK
- OpenAI-compatible provider adapter foundation for `/v1/chat/completions`
- Native local Ollama provider
- Credential SDK with redaction helpers
- Connector Security Policy Engine
- Plan validation and one-attempt repair pipeline
- Versioned planner prompt assets
- Runnable examples, Vitest tests, package install verification, and CI

## Installation

After publication:

```bash
npm install @agentos/sdk@alpha
```

## Minimal Example

```ts
import {
  AgentOSRegistry,
  InMemoryMemoryStore,
  RuleBasedPlanner,
  SimpleExecutionEngine,
  defineAgent,
} from "@agentos/sdk";

const agent = defineAgent({
  id: "community-manager",
  name: "Community Manager",
  description: "Manages online communities.",
  planner: new RuleBasedPlanner(),
  executionEngine: new SimpleExecutionEngine(),
  registry: new AgentOSRegistry(),
  memoryStore: new InMemoryMemoryStore(),
});

const result = await agent.run("Summarize the top complaints in our community this week");

console.log(result.answer);
```

## Examples

```bash
pnpm example:basic
pnpm example:filesystem
pnpm example:github
pnpm example:ollama-provider
```

Live smoke tests are opt-in:

```bash
pnpm smoke:live-model
OLLAMA_MODEL=llama3.1 pnpm smoke:ollama
```

## Known Limitations

- Alpha APIs may change before beta.
- Runtime is local-first and not a distributed production orchestrator.
- Memory is in-memory only; no database-backed memory provider yet.
- Connectors are limited to Filesystem, HTTP GET, GitHub, and local mock bundles.
- Provider support is limited to mock/echo providers, OpenAI-compatible adapter
  foundation, and native Ollama.
- No streaming, embeddings, OAuth flows, cloud deployment runtime, or production
  dashboard yet.

## Security Guidance

- Do not commit credentials or API tokens.
- Use the Credential SDK for provider and connector secrets.
- Configure connector security profiles and policies before enabling external
  or write-capable connectors.
- Keep filesystem connector workspaces scoped to dedicated project directories.
- Treat HTTP and GitHub connector usage as external network access, even when
  examples are deterministic in CI.

## Roadmap

Near-term work should focus on:

- package publication and post-release smoke tests
- connector/provider hardening based on contributor feedback
- improved planner evaluation fixtures
- clearer documentation for building custom tools/connectors/providers
- beta API surface tightening

## Contributing

- [Contributing guide](../../CONTRIBUTING.md)
- [First contribution guide](../first-contribution.md)
- [Architecture](../../ARCHITECTURE.md)
- [Roadmap](../../ROADMAP.md)
