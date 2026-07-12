# Model Provider SDK

The Model Provider SDK defines how reasoning engines can plug into AgentOS.

The public API uses familiar terminology:

```ts
defineModelProvider(...)
```

Internally, the abstraction is intentionally broader than LLMs. A provider can
represent a language model, deterministic reasoning engine, local simulator,
classifier, verifier, or future non-LLM reasoning system.

Providers are discoverable through the registry and can be used by
`ModelAssistedPlanner` through `ModelProviderResolver`.

## Philosophy

AgentOS is task-centric rather than model-centric. Planners may eventually use
model providers, but the provider is not the center of the architecture.

Keeping providers separate from planners means:

- planners remain replaceable
- providers remain provider-agnostic
- tests can use deterministic local providers
- future reasoning engines can use the same interface
- runtime execution does not depend on a specific model vendor

## Define A Provider

```ts
import { defineModelProvider } from "@agentos/sdk";

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

## Request

`ModelGenerationRequest` includes:

- `prompt`
- `systemPrompt`
- `temperature`
- `maxTokens`
- `metadata`

The request is intentionally minimal. Provider-specific options should live in
`metadata` until the abstraction proves it needs more structure.

## Response

`ModelGenerationResponse` includes:

- `text`
- `usage`
- `metadata`
- `finishReason`
- `provider`
- `model`
- `durationMs`

`defineModelProvider()` normalizes provider responses by adding provider id,
finish reason, and duration when missing.

## Built-In Local Providers

AgentOS includes two local providers:

- `MockModelProvider`: deterministic text for tests and examples
- `EchoModelProvider`: returns the prompt exactly

They do not call external APIs.

AgentOS also includes `createOllamaProvider()`, the first native local provider
for locally hosted open models. It uses Ollama's native API while still
implementing the same Model Provider SDK contract.

## HTTP Provider Foundation

AgentOS includes `HTTPModelProviderBase` for future remote providers. It owns
provider-agnostic transport behavior:

- HTTPS enforcement
- optional localhost support
- timeout
- maximum response size
- redirect rejection
- JSON content-type validation
- JSON parsing
- duration measurement
- typed error normalization
- secret redaction

Provider adapters own request and response mapping. The first adapter is
`createOpenAICompatibleProvider()`, which maps AgentOS generation requests to an
OpenAI-compatible chat-completions shape.

```ts
import { HTTPModelProviderBase, createOpenAICompatibleProvider } from "@agentos/sdk";

const transport = new HTTPModelProviderBase({
  baseUrl: "https://api.example.com",
});

const provider = createOpenAICompatibleProvider({
  model: "example-model",
  transport,
});
```

The example at `examples/openai-compatible-provider` uses a deterministic mocked
transport. It does not call a live provider and does not require API keys.

Remote provider transports can use the framework-wide Credential SDK:

```ts
const transport = new HTTPModelProviderBase({
  baseUrl: "https://api.example.com",
  credential: {
    type: "environment",
    name: "MODEL_API_KEY",
  },
});
```

Credentials remain references until request time. See
[Credential SDK](credential-sdk.md).

## Ollama Provider

`createOllamaProvider()` maps AgentOS generation requests to Ollama's native
`/api/generate` endpoint.

```ts
import { createOllamaProvider } from "@agentos/sdk";

const provider = createOllamaProvider({
  model: "llama3.1",
});
```

Defaults:

- `baseUrl`: `http://localhost:11434`
- `allowRemote`: `false`

The provider is local-first. Remote endpoints require `allowRemote: true`, and
remote HTTP URLs are rejected by the shared HTTP transport.

Request mapping:

- `prompt` -> `prompt`
- `systemPrompt` -> `system`
- `temperature` -> `options.temperature`
- `maxTokens` -> `options.num_predict`
- `metadata.contextWindow` -> `options.num_ctx`

The provider also exposes `health()` for checking reachability, configured model
availability, and Ollama version when available.

See [Ollama Provider](ollama-provider.md).

## Live Model Workflow

`examples/live-model-agent` demonstrates the first complete model-assisted
workflow. By default it uses mocked transport. With `pnpm smoke:live-model`, it
can call an OpenAI-compatible endpoint when these variables are configured:

- `MODEL_BASE_URL`
- `MODEL_NAME`
- `MODEL_API_KEY`

Live mode is never part of CI. See [Live Model Testing](live-model-testing.md).

## Provider Capabilities

Providers declare capabilities as extensible strings. AgentOS exports common
capability constants:

- `text-generation`
- `reasoning`
- `long-context`
- `embeddings`
- `multimodal`
- `structured-output`

Custom capability strings are allowed so future reasoning systems can fit
without changing the core type model.

## Provider Registry

Model providers can be registered with the AgentOS Registry:

```ts
import { AgentOSRegistry, MockModelProvider } from "@agentos/sdk";

const registry = new AgentOSRegistry();

registry.registerModelProvider(MockModelProvider);
registry.setDefaultModelProvider("mock");
```

Registry support includes:

- `registerModelProvider()`
- `unregisterModelProvider()`
- `findModelProvider()`
- `listModelProviders()`
- `setDefaultModelProvider()`
- `clearDefaultModelProvider()`
- `defaultModelProvider()`

## Provider Resolver

`ModelProviderResolver` is the lookup boundary for providers:

```ts
import { ModelProviderCapability, ModelProviderResolver } from "@agentos/sdk";

const resolver = new ModelProviderResolver({ registry });

const defaultProvider = resolver.resolve();
const reasoningProvider = resolver.resolve({
  capability: ModelProviderCapability.Reasoning,
});
```

Planners should depend on this resolver boundary rather than querying the
registry directly. This keeps planner implementations independent of registry
storage details and preserves the same separation already used for tool
resolution.

## Model-Assisted Planning

`ModelAssistedPlanner` is the first planner that can request a provider through
`ModelProviderResolver`.

The flow is:

```text
Task
  -> Planner
  -> Provider Request
  -> ModelProviderResolver
  -> Provider Capability Match
  -> Model Generation
  -> Validated Plan
```

The planner asks for provider capabilities instead of vendor brands. It requires
`text-generation` and prefers `reasoning` and `structured-output`.

Provider output is treated as untrusted input:

- provider-generated ids are rejected
- provider-generated task ids are rejected
- provider-generated statuses and timestamps are rejected
- provider-generated tool outputs are rejected
- registry mutations are rejected
- AgentOS creates all plan ids, step ids, timestamps, statuses, and task links
- generated plans pass through `PlanValidator` before execution
- one repair attempt may be made when validation fails

If provider planning fails, `fallback: "rule-based"` delegates to
`RuleBasedPlanner`. `fallback: "fail"` throws a typed planning error.

`RuleBasedPlanner` remains fully independent and deterministic.

Model-assisted planning prompts are versioned assets rather than inline strings.
Planner metadata records the prompt version, prompt size, and whether the
provider used the `structured-output` or standard prompt path. The full prompt
is exposed only when `debugPrompt: true` is passed for local debugging.

See [Plan Validation](plan-validation.md) and [Planner Prompts](planner-prompts.md).

## Current Limitations

- no native OpenAI, Anthropic, or Gemini provider packages yet
- no OAuth, API-key management helper, or secret manager
- no streaming
- no provider-level retries
- Ollama live usage is opt-in and local-first
- OpenAI-compatible live usage is opt-in and configured through environment
  variables

Future provider integrations should build on this contract without making
AgentOS model-centric.
