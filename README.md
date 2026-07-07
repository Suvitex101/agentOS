# AgentOS

AgentOS is an open-source AI agent infrastructure layer for the Global South,
starting with Africa.

It helps developers build agents that can reason over tasks, remember context,
use tools, and operate across real-world workflows such as messaging, payments,
community management, research, and business operations.

AgentOS is task-centric, not LLM-centric. The core flow is:

```text
Mission -> Task -> Planner -> Plan -> Execution Engine -> Tool Resolver -> Registry -> Tool -> Result
```

The current implementation is local and provider-agnostic. It includes a
rule-based planner, local execution engine, in-memory registry, in-memory memory
store, declarative tool authoring API, runnable examples, tests, and CI. It does
not yet include real connectors, external APIs, LLM provider integration,
database-backed memory, or dashboard functionality.

## Start Here

- [Architecture](ARCHITECTURE.md): technical reference for how AgentOS works.
- [Contributing](CONTRIBUTING.md): development workflow and contribution guide.
- [First Contribution](docs/first-contribution.md): step-by-step onboarding for
  new contributors.
- [Roadmap](ROADMAP.md): completed work, near-term plans, and aspirational
  future ideas.
- [Code of Conduct](CODE_OF_CONDUCT.md): community expectations.

## Why AgentOS Exists

Most agent infrastructure is designed around well-resourced markets, stable
connectivity, and workflows that do not always reflect how people and businesses
operate across Africa and the wider Global South.

AgentOS aims to provide practical, extensible infrastructure for developers
building agents that understand local contexts, integrate with regional tools,
and support real operational work.

## Repository Structure

```text
apps/
  web/          Next.js shell for the future dashboard and developer console

packages/
  core/         Planner, execution, registry, tool authoring, and agent helpers
  memory/       Memory contracts and in-memory store
  sdk/          Developer-facing exports
  types/        Shared TypeScript domain and architecture types
  tools/        Placeholder for future tool helpers
  connectors/  Placeholder for future provider connectors
  config/       Shared TypeScript configuration

examples/       Runnable local examples
tests/          Unit, integration, and example verification tests
docs/           Contributor-focused documentation
```

## Quickstart

Install dependencies:

```bash
pnpm install
```

Run the basic example:

```bash
pnpm example:basic
```

Run the custom tool example:

```bash
pnpm example:custom-tool
```

Run the local quality gate:

```bash
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:examples
```

## Build Your First Tool

Tools are local callable capabilities. Define one with `defineTool()`:

```ts
import { defineTool } from "@agentos/sdk";

export const summarizeMessages = defineTool<{ messages: string[] }, string>({
  id: "summarize-messages",
  name: "Summarize Messages",
  description: "Summarizes community conversations.",
  capability: "messaging",
  version: "1.0.0",
  tags: ["community", "summary"],
  execute({ input }) {
    const startedAt = Date.now();

    return {
      success: true,
      output: input.messages.join("\n"),
      metadata: {
        messageCount: input.messages.length,
      },
      durationMs: Date.now() - startedAt,
      errors: [],
    };
  },
});
```

Register tools with `AgentOSRegistry`:

```ts
registry.registerTool(summarizeMessages);
```

See [docs/first-contribution.md](docs/first-contribution.md) for a guided
walkthrough.

## Run An Agent

```ts
import {
  InMemoryMemoryStore,
  RuleBasedPlanner,
  SimpleExecutionEngine,
  createAgentOSRegistryBootstrapExample,
  defineAgent,
} from "@agentos/sdk";

const agent = defineAgent({
  id: "community-manager",
  name: "Community Manager",
  description: "Manages online communities.",
  planner: new RuleBasedPlanner(),
  executionEngine: new SimpleExecutionEngine(),
  registry: createAgentOSRegistryBootstrapExample(),
  memoryStore: new InMemoryMemoryStore(),
});

const result = await agent.run("Summarize the top complaints in our Discord community this week");

console.log(result.answer);
console.log(result.toolCalls);
```

This flow is local and mocked. It does not call Discord or any external API.

## Examples

```bash
pnpm example:basic
pnpm example:community
pnpm example:business
pnpm example:research
pnpm example:memory
pnpm example:custom-tool
```

Examples demonstrate the current runtime, memory behavior, tool resolution, and
tool authoring API.

## Testing

AgentOS uses Vitest for fast local and CI-friendly tests.

```bash
pnpm test
pnpm test:unit
pnpm test:integration
pnpm test:examples
pnpm test:watch
```

Test helpers live in `tests/helpers/`.

## CI

GitHub Actions runs the `CI` workflow on pull requests and pushes to `main`.

CI validates:

- `pnpm install --frozen-lockfile`
- `pnpm format:check`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `pnpm test:examples`

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. For a
gentler walkthrough, start with [docs/first-contribution.md](docs/first-contribution.md).

Good first contributions include documentation improvements, focused tests,
small examples, clearer errors, and small bug fixes.
