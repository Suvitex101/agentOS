# @agentos/types

Shared TypeScript domain types for AgentOS.

Most developers should import these through `@agentos/sdk`.

## Install

```bash
npm install @agentos/types
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

## Relationship To @agentos/sdk

`@agentos/sdk` re-exports these types for convenience. Direct installation is
mainly useful for package authors who want type-only dependencies.

## Alpha Status

Types are stable enough for alpha use, but may evolve before beta.
