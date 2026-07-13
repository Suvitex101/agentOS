# @agentosdev/providers

Model provider foundations and provider adapters for AgentOS.

Most developers should import providers from `@agentosdev/sdk`.

## Install

```bash
npm install @agentosdev/providers@alpha
```

## Purpose

This package provides:

- `HTTPModelProviderBase`
- `createOpenAICompatibleProvider()`
- `createOllamaProvider()`

The provider abstraction is intentionally broader than LLMs. Providers are
reasoning engines that planners may use through `ModelProviderResolver`.

## Relationship To @agentosdev/sdk

`@agentosdev/sdk` re-exports provider APIs. Use this package directly when building
provider-specific integrations or tests.

## Minimal Import

```ts
import { createOllamaProvider, createOpenAICompatibleProvider } from "@agentosdev/providers";
```

## Alpha Status

OpenAI-compatible support is an adapter foundation for `/v1/chat/completions`.
Ollama support is local-first and native to Ollama's `/api/generate` endpoint.
Streaming and embeddings are not implemented yet.

## Links

- Repository: https://github.com/Suvitex101/agentOS
- Issues: https://github.com/Suvitex101/agentOS/issues
- License: Apache-2.0
