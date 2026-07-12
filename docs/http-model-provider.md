# HTTP Model Provider Foundation

AgentOS includes a reusable HTTP transport foundation for future remote model
providers.

This is not a live OpenAI, Anthropic, Gemini, or Ollama integration. It is the
secure provider-agnostic layer that vendor adapters can build on later.

## Architecture

```text
ModelAssistedPlanner
  -> ModelProviderResolver
  -> Model Provider
  -> HTTPModelProviderBase
  -> Provider Adapter
  -> ModelGenerationResponse
```

The base transport owns HTTP behavior. Adapters own provider-specific request
and response mapping.

## `HTTPModelProviderBase`

`HTTPModelProviderBase` handles shared remote-provider transport concerns:

- HTTPS enforcement for remote hosts
- optional localhost support for local development
- request timeout
- maximum response size
- redirect rejection
- JSON content-type validation
- JSON parsing
- duration measurement
- typed error normalization
- secret redaction for common sensitive headers and token patterns

Configuration:

```ts
const transport = new HTTPModelProviderBase({
  baseUrl: "https://api.example.com",
  timeoutMs: 5000,
  maxResponseBytes: 1024 * 1024,
  defaultHeaders: {},
  allowLocalhost: false,
  userAgent: "AgentOS/0.1",
  credential: {
    type: "environment",
    name: "MODEL_API_KEY",
  },
});
```

`fetchImplementation` can be supplied for deterministic tests and examples. It
is used by the test suite and should not be treated as a global runtime hook.

## Adapter Contract

Adapters implement:

- `buildRequest(request)`
- `parseResponse(response)`
- `normalizeFinishReason(reason)`
- `normalizeUsage(usage)`

The adapter does not own transport safety. It only maps AgentOS generation
requests to provider request bodies and maps provider responses back to
`ModelGenerationResponse`.

## OpenAI-Compatible Adapter

`createOpenAICompatibleProvider()` creates a model provider backed by the HTTP
base and an OpenAI-compatible chat-completions adapter.

```ts
import { HTTPModelProviderBase, createOpenAICompatibleProvider } from "@agentosdev/sdk";

const transport = new HTTPModelProviderBase({
  baseUrl: "https://api.example.com",
});

const provider = createOpenAICompatibleProvider({
  id: "openai-compatible",
  name: "OpenAI-Compatible Provider",
  model: "example-model",
  transport,
});
```

The current adapter maps to `/v1/chat/completions` and expects a response with a
`choices[0].message.content` string.

## Credentials

`HTTPModelProviderBase` accepts a `CredentialReference` and `CredentialResolver`.
The credential is resolved only at request time and is applied as an
authorization header by default.

```ts
import { CredentialResolver, CredentialType, HTTPModelProviderBase } from "@agentosdev/sdk";

const transport = new HTTPModelProviderBase({
  baseUrl: "https://api.example.com",
  credential: {
    type: CredentialType.Environment,
    name: "MODEL_API_KEY",
  },
  credentialResolver: new CredentialResolver(),
});
```

The public transport config exposes only a redacted credential reference. The
resolved secret is not stored in provider metadata or summaries.

## Security Model

The transport is intentionally conservative:

- remote URLs must use HTTPS
- localhost HTTP is disabled unless `allowLocalhost: true`
- redirects are rejected
- response bodies are capped by `maxResponseBytes`
- non-JSON responses are rejected
- malformed JSON is rejected
- common secrets are redacted from errors and metadata

This layer does not implement authentication helpers, API-key management,
streaming, retries, or vendor-specific policy. Those should be added only when
the concrete provider requirements are clear.

## Current Limitations

- no OAuth or API-key management helper
- no streaming
- no retries
- no request batching
- no vendor-specific providers
- no live network examples

See `examples/openai-compatible-provider` for a deterministic mocked transport
that demonstrates the architecture without external calls.
