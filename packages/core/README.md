# @agentosdev/core

Core AgentOS runtime and authoring primitives.

Most developers should install `@agentosdev/sdk` instead. Use this package directly
only when composing lower-level AgentOS modules.

## Install

```bash
npm install @agentosdev/core
```

## Purpose

This package contains the framework core:

- `defineAgent()`
- `defineTool()`
- `defineConnector()`
- `defineModelProvider()`
- `AgentOSRegistry`
- `RuleBasedPlanner`
- `ModelAssistedPlanner`
- `SimpleExecutionEngine`
- `ToolResolver`
- `ModelProviderResolver`
- `SecurityPolicyEngine`
- `CredentialResolver`

## Relationship To @agentosdev/sdk

`@agentosdev/sdk` re-exports the public core APIs. Prefer the SDK unless you are
building package-level extensions.

## Alpha Status

`0.1.0-alpha.1` is installable and tested, but APIs remain alpha-stage.
