# Package Strategy

AgentOS uses `@agentos/sdk` as the primary public entry point.

Most developers should start with:

```bash
npm install @agentos/sdk
```

The SDK re-exports the stable alpha surface from the modular packages so
developers do not need to understand the monorepo structure before building
their first local agent.

## Package Decisions

| Package               | Decision        | Reason                                                                          |
| --------------------- | --------------- | ------------------------------------------------------------------------------- |
| `@agentos/sdk`        | Publishable now | Primary public entry point for alpha developers.                                |
| `@agentos/core`       | Publishable now | Required runtime, registry, planner, resolver, and authoring APIs used by SDK.  |
| `@agentos/types`      | Publishable now | Shared domain types required by all public packages.                            |
| `@agentos/memory`     | Publishable now | Provides public memory contracts and in-memory implementation used by SDK.      |
| `@agentos/connectors` | Publishable now | Provides current local Filesystem and HTTP connectors exposed through SDK.      |
| `@agentos/providers`  | Publishable now | Provides provider foundation and OpenAI-compatible adapter exposed through SDK. |
| `@agentos/tools`      | Private         | Placeholder package; not enough public behavior to publish honestly.            |
| `@agentos/config`     | Private         | Internal shared TypeScript configuration, not a runtime package.                |
| `@agentos/web`        | Private         | Future dashboard app, not a public npm package.                                 |

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
      "import": "./dist/index.js"
    }
  }
}
```

Internal implementation files are not public API.

## Alpha Stability

The alpha SDK should be coherent and installable, but not permanently stable.
Breaking changes may still happen before a beta release. Release notes should
call out any API changes clearly.

## Future Modular Packages

Advanced users may eventually install modular packages directly, such as
`@agentos/connectors` or `@agentos/providers`. For the first public alpha,
`@agentos/sdk` remains the recommended path.
