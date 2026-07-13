# @agentosdev/connectors

Connector implementations for AgentOS.

Most developers should import connectors from `@agentosdev/sdk`.

## Install

```bash
npm install @agentosdev/connectors@alpha
```

## Purpose

This package currently provides:

- `createFilesystemConnector()`
- `createHttpConnector()`
- `createGitHubConnector()`

Connectors are packaged as bundles that register capabilities, tools, and
resources with `AgentOSRegistry`.

## Relationship To @agentosdev/sdk

`@agentosdev/sdk` re-exports the public connector factories. Use this package
directly when building or testing connector-specific integrations.

## Minimal Import

```ts
import { createFilesystemConnector, createGitHubConnector } from "@agentosdev/connectors";
```

## Alpha Status

Filesystem is local, HTTP is safe GET-only, and GitHub is read-first with
optional policy-gated issue creation. Broader provider coverage is future work.

## Links

- Repository: https://github.com/Suvitex101/agentOS
- Issues: https://github.com/Suvitex101/agentOS/issues
- License: Apache-2.0
