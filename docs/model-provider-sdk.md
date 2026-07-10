# Model Provider SDK

The Model Provider SDK defines how reasoning engines can plug into AgentOS.

The public API uses familiar terminology:

```ts
defineModelProvider(...)
```

Internally, the abstraction is intentionally broader than LLMs. A provider can
represent a language model, deterministic reasoning engine, local simulator,
classifier, verifier, or future non-LLM reasoning system.

This phase does not integrate providers with planners or runtime execution.

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

## Current Limitations

- no OpenAI, Anthropic, Gemini, or Ollama integration
- no API keys
- no authentication
- no streaming
- no planner integration
- no runtime integration

Future provider integrations should build on this contract without making
AgentOS model-centric.
