# Package Strategy

AgentOS uses `@agentosdev/sdk` as the primary public entry point.

Most developers should start with:

```bash
npm install @agentosdev/sdk
```

The SDK re-exports the stable alpha surface from the modular packages so
developers do not need to understand the monorepo structure before building
their first local agent.

## Package Decisions

| Package                  | Decision        | Reason                                                                                            |
| ------------------------ | --------------- | ------------------------------------------------------------------------------------------------- |
| `@agentosdev/sdk`        | Publishable now | Primary public entry point for alpha developers.                                                  |
| `@agentosdev/core`       | Publishable now | Required runtime, registry, planner, resolver, and authoring APIs used by SDK.                    |
| `@agentosdev/types`      | Publishable now | Shared domain types required by all public packages.                                              |
| `@agentosdev/memory`     | Publishable now | Provides public memory contracts and in-memory implementation used by SDK.                        |
| `@agentosdev/connectors` | Publishable now | Provides Filesystem, HTTP, and GitHub connectors exposed through SDK.                             |
| `@agentosdev/providers`  | Publishable now | Provides provider foundation, OpenAI-compatible adapter, and Ollama provider exposed through SDK. |
| `@agentosdev/tools`      | Private         | Placeholder package; not enough public behavior to publish honestly.                              |
| `@agentosdev/config`     | Private         | Internal shared TypeScript configuration, not a runtime package.                                  |
| `@agentosdev/web`        | Private         | Future dashboard app, not a public npm package.                                                   |

## Versioning

The alpha package version is:

```text
0.1.0-alpha.1
```

Publishable packages use aligned versions. Internal workspace dependencies use:

```json
"workspace:^"
```

## Entry Points

Publishable packages expose only their root public entry point:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  }
}
```

Internal implementation files are not public API.

Each publishable package includes a package-level README and Apache-2.0 license
metadata. The root repository license remains the source of truth.

## Alpha Stability

The alpha SDK should be coherent and installable, but not permanently stable.
Breaking changes may still happen before a beta release. Release notes should
call out any API changes clearly.

## Future Modular Packages

Advanced users may eventually install modular packages directly, such as
`@agentosdev/connectors` or `@agentosdev/providers`. For the first public alpha,
`@agentosdev/sdk` remains the recommended path.
