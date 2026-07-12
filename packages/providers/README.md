# @agentos/providers

Model provider foundations and provider adapters for AgentOS.

Most developers should import providers from `@agentos/sdk`.

## Install

```bash
npm install @agentos/providers
```

## Purpose

This package provides:

- `HTTPModelProviderBase`
- `createOpenAICompatibleProvider()`
- `createOllamaProvider()`

The provider abstraction is intentionally broader than LLMs. Providers are
reasoning engines that planners may use through `ModelProviderResolver`.

## Relationship To @agentos/sdk

`@agentos/sdk` re-exports provider APIs. Use this package directly when building
provider-specific integrations or tests.

## Alpha Status

OpenAI-compatible support is an adapter foundation for `/v1/chat/completions`.
Ollama support is local-first and native to Ollama's `/api/generate` endpoint.
Streaming and embeddings are not implemented yet.
