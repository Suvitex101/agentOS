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
and CI. It now includes a read-first GitHub connector as the first external
platform connector. It does not yet include a broad production connector
ecosystem, database-backed memory, or dashboard functionality.

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
- [Model Provider SDK](docs/model-provider-sdk.md): provider abstraction for
  future reasoning engines.
- [HTTP Model Provider Foundation](docs/http-model-provider.md): secure
  transport base and OpenAI-compatible adapter foundation.
- [Ollama Provider](docs/ollama-provider.md): native local provider for
  Ollama-hosted open models.
- [Credential SDK](docs/credential-sdk.md): framework-wide credential
  references, resolution, and redaction.
- [GitHub Connector](docs/github-connector.md): first production-grade external
  connector using the Connector SDK and Credential SDK.
- [Live Model Testing](docs/live-model-testing.md): opt-in OpenAI-compatible
  workflow smoke testing.
- [Plan Validation](docs/plan-validation.md): versioned validation and repair
  for model-generated plans.
- [Planner Prompts](docs/planner-prompts.md): versioned prompt assets for
  model-assisted planning.
- [Release Package Strategy](docs/release/package-strategy.md): alpha package
  decisions and publishability audit.
- [Public API Surface](docs/release/public-api-surface.md): intended
  `@agentosdev/sdk` alpha exports.
- [Changelog](CHANGELOG.md): release history and alpha candidate notes.
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
- most connectors are currently local or mocked
- GitHub is the first read-first external connector; broader provider coverage
  is still future work
- no persistent database-backed memory exists yet
- the dashboard shell is not production-ready yet

See [ROADMAP.md](ROADMAP.md) and [docs/grant/current-capabilities.md](docs/grant/current-capabilities.md)
for the current implementation boundary.

## Repository Structure

```text
.github/
  workflows/       GitHub Actions CI

apps/
  web/             Next.js dashboard shell for future product work

packages/
  sdk/             Primary public SDK entry point
  core/            Agent runtime, planners, registry, resolvers, and authoring APIs
  types/           Shared domain, architecture, security, and provider types
  memory/          Memory contracts and in-memory memory store
  connectors/     Filesystem, HTTP, and GitHub connector implementations
  providers/      Model provider foundation, OpenAI-compatible adapter, and Ollama provider
  config/          Shared TypeScript configuration
  tools/           Private placeholder for future tool helpers

examples/          Runnable examples for agents, tools, connectors, providers, and memory
tests/             Unit, integration, evaluation, and example verification tests
docs/              Architecture, security, release, grant, and contributor documentation
scripts/           Release, package, and boundary validation scripts
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

Run the HTTP connector example:

```bash
pnpm example:http
```

Run the GitHub connector example:

```bash
pnpm example:github
```

Run the model provider example:

```bash
pnpm example:model-provider
```

Run the provider registry example:

```bash
pnpm example:provider-registry
```

Run the model-assisted planner example:

```bash
pnpm example:model-assisted-planner
```

Run the OpenAI-compatible provider foundation example:

```bash
pnpm example:openai-compatible-provider
```

Run the Ollama provider example in deterministic mode:

```bash
pnpm example:ollama-provider
```

Run the credential SDK example:

```bash
pnpm example:credential-sdk
```

Run the live-model workflow in deterministic mode:

```bash
pnpm example:live-model-agent
```

Run the plan validation example:

```bash
pnpm example:plan-validation
```

Run the opt-in live smoke test:

```bash
MODEL_BASE_URL="https://your-openai-compatible-endpoint" \
MODEL_NAME="your-model" \
MODEL_API_KEY="your-token" \
pnpm smoke:live-model
```

If live configuration is missing, the smoke test skips gracefully.

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
import { defineTool } from "@agentosdev/sdk";

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
import { defineConnector } from "@agentosdev/sdk";
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
import { AgentOSRegistry, LocalCommunityConnector } from "@agentosdev/sdk";

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
import { AgentOSRegistry, createFilesystemConnector } from "@agentosdev/sdk";

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
enforcement is future work.

`SecurityPolicyEngine` evaluates connector bundles before registry registration
and returns `Allow`, `Deny`, or `RequiresApproval`. Denied or approval-required
bundles are not partially registered.

Security docs:

- [Connector Security](docs/security/connector-security.md)
- [Policy Engine](docs/security/policy-engine.md)
- [Connector Author Checklist](docs/security/security-checklist.md)
- [Connector Threat Model](docs/security/threat-model.md)

## HTTP Connector

`createHttpConnector()` creates a secure network connector for controlled HTTPS
GET requests. It exposes network access through `HttpGetTool`, not through the
execution engine.

```ts
import { AgentOSRegistry, createHttpConnector } from "@agentosdev/sdk";

const registry = new AgentOSRegistry();
const httpConnector = createHttpConnector({
  allowlist: ["https://example.com", "https://api.github.com"],
  timeoutMs: 5000,
  maxResponseBytes: 1024 * 1024,
});

registry.registerConnectorBundle(httpConnector);
```

Safety model:

- only HTTPS GET is supported
- hosts must match the configured allowlist
- redirects are disabled
- localhost, loopback, link-local, and private IP targets are rejected
- allowlisted hostnames that resolve to private IP targets are rejected
- credentials embedded in URLs are rejected
- timeouts and maximum response size are enforced
- sensitive request headers such as `authorization` and `cookie` are rejected
- sensitive response headers such as `set-cookie` are redacted

Current limitations: no authentication, cookies, sessions, request bodies,
state-changing methods, WebSockets, streaming API, or provider-specific clients.

## GitHub Connector

`createGitHubConnector()` creates a read-first GitHub REST connector using the
Connector SDK and Credential SDK. It exposes repository, source-code, issues,
and search capabilities through tools.

```ts
import { AgentOSRegistry, CredentialType, createGitHubConnector } from "@agentosdev/sdk";

const registry = new AgentOSRegistry();
const githubConnector = createGitHubConnector({
  credential: {
    type: CredentialType.Environment,
    name: "GITHUB_TOKEN",
  },
});

registry.registerConnectorBundle(githubConnector);
```

Supported read tools:

- `GetRepositoryTool`
- `ListRepositoriesTool`
- `ReadFileTool`
- `SearchCodeTool`
- `ListIssuesTool`
- `GetIssueTool`

`CreateIssueTool` is optional and only included when `enableWrites: true`.
Write-enabled connectors are marked high risk and require explicit approval by
policy. See [docs/github-connector.md](docs/github-connector.md).

## Model Provider SDK

`defineModelProvider()` defines provider abstractions for future reasoning
engines. The API uses familiar model-provider terminology, but the architecture
keeps providers separate from planners so AgentOS does not become model-centric.

```ts
import { defineModelProvider } from "@agentosdev/sdk";

const provider = defineModelProvider({
  id: "mock",
  name: "Mock Provider",
  version: "1.0.0",
  generate(request) {
    return {
      text: `Response for: ${request.prompt}`,
      usage: {},
      metadata: {},
    };
  },
});
```

AgentOS currently includes `MockModelProvider`, `EchoModelProvider`, and an HTTP
provider foundation for future remote adapters. `createOpenAICompatibleProvider()`
maps AgentOS generation requests to an OpenAI-compatible chat-completions shape,
but examples use mocked transport only. No live model provider API calls or
API-key helpers are implemented yet.

AgentOS also includes `createOllamaProvider()` for native local Ollama
generation. It defaults to `http://localhost:11434`, keeps remote endpoints
disabled unless `allowRemote: true`, and can be used by `ModelAssistedPlanner`
through the registry and `ModelProviderResolver`.

See [docs/model-provider-sdk.md](docs/model-provider-sdk.md).

## Ollama Provider

`createOllamaProvider()` maps AgentOS generation requests to Ollama's native
`/api/generate` endpoint.

```ts
import { AgentOSRegistry, createOllamaProvider } from "@agentosdev/sdk";

const registry = new AgentOSRegistry();
const provider = createOllamaProvider({
  model: "llama3.1",
});

registry.registerModelProvider(provider);
registry.setDefaultModelProvider(provider.id);
```

Run the deterministic example:

```bash
pnpm example:ollama-provider
```

Run the opt-in live smoke test:

```bash
OLLAMA_MODEL=llama3.1 pnpm smoke:ollama
```

See [docs/ollama-provider.md](docs/ollama-provider.md).

## HTTP Model Provider Foundation

`HTTPModelProviderBase` centralizes secure transport behavior for future remote
model providers: HTTPS enforcement, optional localhost support, timeouts,
response size limits, redirect rejection, JSON validation, typed errors, and
secret redaction.

Adapters handle provider-specific request and response mapping. The first
adapter is `createOpenAICompatibleProvider()`.

See [docs/http-model-provider.md](docs/http-model-provider.md) and
`examples/openai-compatible-provider`.

## Credential SDK

AgentOS components can reference credentials without embedding secret values in
definitions, metadata, traces, logs, or source code.

```ts
import { CredentialResolver, CredentialType } from "@agentosdev/sdk";

const resolver = new CredentialResolver();
const result = resolver.resolve({
  type: CredentialType.Environment,
  name: "MODEL_API_KEY",
});
```

Static credentials are supported for development and testing only. Future
connectors, providers, databases, and cloud services should use the same
reference-and-resolver model.

See [docs/credential-sdk.md](docs/credential-sdk.md).

## Live Model Workflow

`examples/live-model-agent` demonstrates a complete workflow:

```text
agent.run()
  -> ModelAssistedPlanner
  -> ModelProviderResolver
  -> HTTPModelProviderBase
  -> CredentialResolver
  -> Execution Engine
  -> ToolResolver
  -> FilesystemConnector
  -> Memory
  -> Result
```

The default mode is deterministic and safe for CI. Live mode is opt-in through
`pnpm smoke:live-model` and requires `MODEL_BASE_URL`, `MODEL_NAME`, and
`MODEL_API_KEY`.

See [docs/live-model-testing.md](docs/live-model-testing.md).

## Plan Validation

Model-generated plans are treated as untrusted input. `PlanValidator` validates
structure, schema version, size limits, safe identifiers, structured inputs, and
security-sensitive fields before execution.

`ModelAssistedPlanner` can make one repair request when validation fails. The
repaired output is validated again, then accepted, sent to fallback, or failed.

See [docs/plan-validation.md](docs/plan-validation.md).

## Planner Prompts

`ModelAssistedPlanner` builds provider prompts through versioned prompt assets
instead of inline strings. Prompt metadata records the prompt version, prompt
size, provider capability path, and validation metrics without storing the full
prompt by default.

See [docs/planner-prompts.md](docs/planner-prompts.md).

## Provider Registry

Model providers are first-class discoverable objects in the AgentOS registry.
Register providers with `registerModelProvider()` and resolve them through
`ModelProviderResolver`.

```ts
import { AgentOSRegistry, MockModelProvider, ModelProviderResolver } from "@agentosdev/sdk";

const registry = new AgentOSRegistry();

registry.registerModelProvider(MockModelProvider);
registry.setDefaultModelProvider("mock");

const resolver = new ModelProviderResolver({ registry });
const provider = resolver.resolve().provider;
```

Planners should use a resolver boundary instead of querying registry internals
directly. Planner integration is future work.

## Model-Assisted Planner

`ModelAssistedPlanner` lets planners request a reasoning provider through
`ModelProviderResolver` without knowing registry internals, provider brands, API
keys, or network details.

The planner asks for capabilities such as `text-generation`, prefers reasoning
and structured output, calls a local provider, then treats the provider response
as untrusted JSON. AgentOS creates ids, timestamps, task ids, statuses, and plan
metadata itself.

```ts
import { ModelAssistedPlanner, ModelProviderResolver, RuleBasedPlanner } from "@agentosdev/sdk";

const planner = new ModelAssistedPlanner({
  providerResolver: new ModelProviderResolver({ registry }),
  fallbackPlanner: new RuleBasedPlanner(),
  options: {
    fallback: "rule-based",
  },
});
```

Current examples use only deterministic local providers. No external model
provider integrations exist yet.

## Run An Agent

```ts
import {
  InMemoryMemoryStore,
  RuleBasedPlanner,
  SimpleExecutionEngine,
  createAgentOSRegistryBootstrapExample,
  defineAgent,
} from "@agentosdev/sdk";

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
pnpm example:http
pnpm example:model-provider
pnpm example:provider-registry
pnpm example:model-assisted-planner
pnpm example:openai-compatible-provider
pnpm example:credential-sdk
pnpm example:live-model-agent
pnpm example:plan-validation
pnpm example:planner-prompts
```

Examples demonstrate the current runtime, memory behavior, tool resolution,
tool/connector authoring APIs, provider discovery, model-assisted planning, and
the mocked HTTP model provider foundation, credential resolution, and plan
validation and planner prompt assets.

## Testing

AgentOS uses Vitest for fast local and CI-friendly tests.

```bash
pnpm test
pnpm test:unit
pnpm test:integration
pnpm test:examples
pnpm test:evaluation
pnpm test:watch
```

Test helpers live in `tests/helpers/`.

`pnpm test:evaluation` runs deterministic planner evaluation fixtures. It
checks prompt paths, validation outcomes, repair/fallback behavior, schema
metadata, and basic plan characteristics. It does not perform subjective
natural-language scoring.

## Release Readiness

Release checks are safe and do not publish packages.

```bash
pnpm release:package-boundaries
pnpm pack:packages
pnpm test:package-install
pnpm release:check
```

`pnpm test:package-install` builds the publishable packages, packs local
tarballs, installs them into a temporary project outside the monorepo, imports
from `@agentosdev/sdk`, and runs a deterministic agent workflow.

See [docs/release/package-strategy.md](docs/release/package-strategy.md),
[docs/release/public-api-surface.md](docs/release/public-api-surface.md), and
[docs/release/release-checklist.md](docs/release/release-checklist.md).

## CI

GitHub Actions runs the `CI` workflow on pull requests and pushes to `main`.

CI validates:

- `pnpm install --frozen-lockfile`
- `pnpm format:check`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:evaluation`
- `pnpm build`
- `pnpm test:package-install`
- `pnpm test:examples`

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. For a
gentler walkthrough, start with [docs/first-contribution.md](docs/first-contribution.md).

Good first contributions include documentation improvements, focused tests,
small examples, clearer errors, and small bug fixes.

## License

AgentOS is licensed under the [Apache License 2.0](LICENSE).
