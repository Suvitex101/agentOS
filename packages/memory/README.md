# @agentos/memory

Provider-agnostic memory contracts and in-memory implementation for AgentOS.

Most developers should import memory utilities from `@agentos/sdk`.

## Install

```bash
npm install @agentos/memory
```

## Purpose

This package provides:

- `MemoryStore` contract
- `InMemoryMemoryStore`
- typed memory write/read/search/list/delete/clear behavior
- scoped memory records

It does not include database storage, vector search, or embedding generation.

## Relationship To @agentos/sdk

`@agentos/sdk` re-exports `InMemoryMemoryStore` and memory types. Use this
package directly when building an alternative memory provider.

## Alpha Status

The current memory layer is local and in-memory only.
