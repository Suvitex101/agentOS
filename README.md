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
store, declarative tool and connector authoring APIs, runnable examples, tests,
and CI. It does not yet include real external API calls, LLM provider
integration, database-backed memory, or dashboard functionality.

## Start Here

- [Vision](VISION.md): why AgentOS exists and why it should be open
  infrastructure.
- [Positioning](POSITIONING.md): how AgentOS differs philosophically from other
  AI frameworks.
- [Architecture](ARCHITECTURE.md): technical reference for how AgentOS works.
- [Architecture Diagram](docs/architecture-diagram.md): visual overview of the
  current local flow.
- [API Reference](docs/api-reference.md): starter reference for public SDK
  exports.
- [Connector Security](docs/security/connector-security.md): security metadata,
  permissions, and future policy model for connectors.
- [Examples](examples): runnable local examples.
- [Grant Readiness Docs](docs/grant): supporting material for grant review.
- [Contributing](CONTRIBUTING.md): development workflow and contribution guide.
- [First Contribution](docs/first-contribution.md): step-by-step onboarding for
  new contributors.
- [Roadmap](ROADMAP.md): completed work, near-term plans, and aspirational
  future ideas.
- [Code of Conduct](CODE_OF_CONDUCT.md): community expectations.
- [License](LICENSE): Apache License 2.0.

## Why AgentOS Exists

AgentOS exists because intelligent work infrastructure should be open,
provider-agnostic, and organized around tasks rather than any single model or
provider.

The AI ecosystem is moving quickly, but many systems still couple prompts,
tools, integrations, memory, and execution patterns tightly together. AgentOS
separates those concerns into typed, replaceable components so developers can
build agents that are easier to inspect, extend, test, and port.

Read the deeper documents:

- [VISION.md](VISION.md): why AgentOS deserves to exist as open infrastructure.
- [POSITIONING.md](POSITIONING.md): how AgentOS compares philosophically with
  existing AI frameworks.
- [ARCHITECTURE.md](ARCHITECTURE.md): how the task-centric architecture works.

## Current Limitations

AgentOS is an early local-first foundation:

- runtime execution is local-first
- connectors are currently local or mocked
- no production external provider integrations exist yet
- no persistent database-backed memory exists yet
- the dashboard shell is not production-ready yet

See [ROADMAP.md](ROADMAP.md) and [docs/grant/current-capabilities.md](docs/grant/current-capabilities.md)
for the current implementation boundary.

## Repository Structure

```text
apps/
  web/          Next.js shell for the future dashboard and developer console

packages/
  core/         Planner, execution, registry, tool/connector authoring, and agents
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

Run the research connector example:

```bash
pnpm example:research-connector
```

Run the community connector bundle example:

```bash
pnpm example:community-connector
```

Run the filesystem connector example:

```bash
pnpm example:filesystem
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

## Build Your First Connector

Connectors are local packages of capabilities, tools, and resources. They are
not API wrappers by themselves. A Discord connector, for example, should expose
messaging/community/search capabilities and the tools that implement them. Later
those tools can call real provider APIs, but the connector contract stays
provider-agnostic.

```text
Connector -> Capability -> Tool
```

Define one with `defineConnector()`:

```ts
import { defineConnector } from "@agentos/sdk";
import { summarizeMessages, prepareMessage } from "./tools";

export const discord = defineConnector({
  id: "discord",
  name: "Discord",
  version: "1.0.0",
  description: "Discord community connector.",
  capabilities: ["messaging", "community", "search"],
  tools: [summarizeMessages, prepareMessage],
  resources: [],
  health() {
    return {
      healthy: true,
    };
  },
});
```

Register connectors, capabilities, tools, and resources with `AgentOSRegistry`.
The execution engine resolves tools through the registry; it does not know or
care which connector provided them.

```ts
registry.registerConnector(discord);

for (const capability of discord.capabilities.capabilities) {
  registry.registerCapability(capability);
}

for (const tool of discord.capabilities.tools) {
  registry.registerTool({
    ...tool,
    connectorId: discord.id,
  });
}
```

Connector definitions include validation, `inspect()`, and `summary()` helpers.
Use `defineMessagingConnector()`, `defineResearchConnector()`, or
`defineBusinessConnector()` when a connector fits a common category.

## Connector Bundles

A connector bundle is a complete installable connector package. It includes:

- the connector definition
- capabilities exposed by the connector
- tools provided by the connector
- local resources owned by the connector

Bundles exist so developers can install and remove a connector consistently
without manually registering each capability, tool, and resource.

```ts
import { AgentOSRegistry, LocalCommunityConnector } from "@agentos/sdk";

const registry = new AgentOSRegistry();

registry.registerConnectorBundle(LocalCommunityConnector);

console.log(registry.listCapabilities());
console.log(registry.listTools());

registry.unregisterConnectorBundle(LocalCommunityConnector.id);
```

`LocalCommunityConnector` is the first realistic connector bundle. It represents
a local community platform, not Discord, Slack, Telegram, or any external
service. It exposes messaging, community, and search capabilities using local
mock tools and resources.

### Building Your First Connector Bundle

Start with `defineConnector()`, include stable capabilities, attach local tools,
add representative resources, then let the registry install the full bundle.
Connector authors should keep local examples mocked and move provider-specific
API calls behind tools only when real connector implementation begins.

### Connector Lifecycle

1. Define a connector with `defineConnector()`.
2. Bundle its capabilities, tools, and resources.
3. Register the bundle with `registry.registerConnectorBundle(connector)`.
4. Discover tools through `ToolResolver`.
5. Remove the bundle with `registry.unregisterConnectorBundle(connector.id)`.

Best practices for connector authors:

- keep connector ids stable
- expose provider-agnostic capabilities
- avoid network calls inside local examples
- keep tool ids unique within the registry
- include realistic local resources for testing and demos
- use `inspect()` and `summary()` for debugging and documentation

See `examples/community-connector` for a complete local bundle lifecycle.

## Filesystem Connector

`createFilesystemConnector()` creates a real local connector for safe workspace
file access. It can list, read, write, and search files inside an explicitly
configured `workspaceRoot`.

```ts
import { AgentOSRegistry, createFilesystemConnector } from "@agentos/sdk";

const registry = new AgentOSRegistry();
const filesystemConnector = createFilesystemConnector({
  workspaceRoot: "./workspace",
});

registry.registerConnectorBundle(filesystemConnector);
```

Safety model:

- all tool paths resolve relative to `workspaceRoot`
- absolute paths are rejected
- `../` traversal outside the workspace is rejected
- reads and writes outside the workspace are rejected
- search is limited to text files and skips large files

Current limitations: this connector is local-only, has no authentication model,
does not implement file watching, and is not a remote storage connector.

## Connector Security

Connectors can declare security metadata such as risk level, trust level,
permissions, and access flags. This is inspectable metadata today; runtime
policy enforcement is future work.

Security docs:

- [Connector Security](docs/security/connector-security.md)
- [Connector Author Checklist](docs/security/security-checklist.md)
- [Connector Threat Model](docs/security/threat-model.md)

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
pnpm example:research-connector
pnpm example:community-connector
pnpm example:filesystem
```

Examples demonstrate the current runtime, memory behavior, tool resolution, and
tool/connector authoring APIs.

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

## License

AgentOS is licensed under the [Apache License 2.0](LICENSE).
