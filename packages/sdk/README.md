# @agentosdev/sdk

Primary public SDK entry point for AgentOS.

## Install

```bash
npm install @agentosdev/sdk
```

## Purpose

Use this package when building with AgentOS. It re-exports the alpha public API
from the modular packages so developers can start without learning the monorepo
layout.

## Includes

- agent composition with `defineAgent()`
- task helpers
- planners and execution engine
- registry and resolvers
- memory store
- Tool SDK and Connector SDK
- Filesystem, HTTP, GitHub, and local community connectors
- Model Provider SDK, OpenAI-compatible adapter foundation, and Ollama provider
- Credential SDK and security policy utilities

## Alpha Status

`0.1.0-alpha.1` is intended for early developer feedback and local
experimentation. APIs may change before beta.
