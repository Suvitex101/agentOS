# Ollama Provider

The Ollama Provider is AgentOS' first native local AI provider.

It uses the existing Model Provider SDK and maps AgentOS generation requests to
Ollama's native `/api/generate` endpoint. It does not introduce a new provider
architecture.

## Installation

Install Ollama from the official project site, then pull a model locally:

```bash
ollama pull llama3.1
```

Start Ollama if it is not already running:

```bash
ollama serve
```

By default Ollama listens on:

```text
http://localhost:11434
```

## Configuration

```ts
import { createOllamaProvider } from "@agentosdev/sdk";

const provider = createOllamaProvider({
  model: "llama3.1",
});
```

Supported options:

- `baseUrl`
- `model`
- `timeoutMs`
- `maxResponseBytes`
- `allowRemote`
- `capabilities`
- `tags`
- `metadata`
- `credential`
- `credentialResolver`
- `fetchImplementation`

Defaults:

- `baseUrl`: `http://localhost:11434`
- `allowRemote`: `false`

Remote endpoints require `allowRemote: true`. Localhost is the normal and
recommended mode.

## Request Mapping

AgentOS sends:

- `prompt` -> Ollama `prompt`
- `systemPrompt` -> Ollama `system`
- `temperature` -> Ollama `options.temperature`
- `maxTokens` -> Ollama `options.num_predict`
- `metadata.contextWindow` -> Ollama `options.num_ctx`

All requests set:

```json
{
  "stream": false
}
```

Streaming is not implemented yet.

## Response Mapping

Ollama responses are normalized into `ModelGenerationResponse`:

- `response` -> `text`
- `model` -> `model`
- `done_reason` -> `finishReason`
- `prompt_eval_count` -> `usage.inputTokens`
- `eval_count` -> `usage.outputTokens`
- prompt/eval counts -> `usage.totalTokens`
- duration fields -> `metadata`

## Health Check

The provider exposes:

```ts
const health = await provider.health();
```

Health checks:

- whether Ollama is reachable
- whether the configured model appears in `/api/tags`
- provider version from `/api/version` when available

Health checks return typed results and do not throw for ordinary unavailability.

## Running The Example

Deterministic mode, used for CI and local verification:

```bash
pnpm example:ollama-provider
```

Live local smoke test:

```bash
OLLAMA_MODEL=llama3.1 pnpm smoke:ollama
```

If Ollama is not installed, not reachable, or the model is missing, the live
smoke test exits gracefully with a clear message.

## Security Model

The provider is local-first:

- localhost HTTP is allowed
- remote endpoints are disabled by default
- remote endpoints must use HTTPS
- redirects are rejected
- response size limits are enforced
- request timeouts are enforced
- response content type must be JSON
- malformed JSON is rejected

Credentials are optional and use the existing Credential SDK. Resolved
credentials are not stored in provider definitions or metadata.

## Limitations

- no streaming
- no embeddings endpoint
- no chat endpoint support yet
- no model pull/install management
- no automatic model selection
- no live dependency in CI
