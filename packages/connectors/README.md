# @agentos/connectors

Connector implementations for AgentOS.

Most developers should import connectors from `@agentos/sdk`.

## Install

```bash
npm install @agentos/connectors
```

## Purpose

This package currently provides:

- `createFilesystemConnector()`
- `createHttpConnector()`
- `createGitHubConnector()`

Connectors are packaged as bundles that register capabilities, tools, and
resources with `AgentOSRegistry`.

## Relationship To @agentos/sdk

`@agentos/sdk` re-exports the public connector factories. Use this package
directly when building or testing connector-specific integrations.

## Alpha Status

Filesystem is local, HTTP is safe GET-only, and GitHub is read-first with
optional policy-gated issue creation. Broader provider coverage is future work.
