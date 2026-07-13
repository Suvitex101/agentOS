# @agentosdev/types

Shared TypeScript domain types for AgentOS.

Most developers should import these through `@agentosdev/sdk`.

## Install

```bash
npm install @agentosdev/types@alpha
```

## Purpose

This package defines the shared vocabulary used across AgentOS:

- agents
- missions
- tasks
- plans
- plan steps
- tools
- connectors
- capabilities
- resources
- memory records
- execution traces
- results
- credentials
- security policy types
- model provider types

## Relationship To @agentosdev/sdk

`@agentosdev/sdk` re-exports these types for convenience. Direct installation is
mainly useful for package authors who want type-only dependencies.

## Minimal Import

```ts
import type { Agent, Task, Plan, Result } from "@agentosdev/types";
```

## Alpha Status

Types are stable enough for alpha use, but may evolve before beta.

## Links

- Repository: https://github.com/Suvitex101/agentOS
- Issues: https://github.com/Suvitex101/agentOS/issues
- License: Apache-2.0
