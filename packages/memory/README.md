# @agentosdev/memory

Provider-agnostic memory contracts and in-memory implementation for AgentOS.

Most developers should import memory utilities from `@agentosdev/sdk`.

## Install

```bash
npm install @agentosdev/memory@alpha
```

## Purpose

This package provides:

- `MemoryStore` contract
- `InMemoryMemoryStore`
- typed memory write/read/search/list/delete/clear behavior
- scoped memory records

It does not include database storage, vector search, or embedding generation.

## Relationship To @agentosdev/sdk

`@agentosdev/sdk` re-exports `InMemoryMemoryStore` and memory types. Use this
package directly when building an alternative memory provider.

## Minimal Import

```ts
import { InMemoryMemoryStore } from "@agentosdev/memory";
```

## Alpha Status

The current memory layer is local and in-memory only.

## Links

- Repository: https://github.com/Suvitex101/agentOS
- Issues: https://github.com/Suvitex101/agentOS/issues
- License: Apache-2.0
