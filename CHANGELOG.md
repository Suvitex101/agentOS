# Changelog

All notable changes to AgentOS will be documented in this file.

This project is not production-ready yet. Alpha releases are intended for early
developer feedback, architectural review, and deterministic local experimentation.

## Unreleased

- Prepared release-readiness checks for package integrity and external consumer
  installation.
- Added deterministic planner evaluation fixtures for model-assisted planning.

## 0.1.0-alpha.1

Initial public alpha candidate.

Implemented areas:

- pnpm/Turborepo TypeScript monorepo foundation
- task-centric AgentOS domain model
- `RuleBasedPlanner`
- `SimpleExecutionEngine`
- in-memory `AgentOSRegistry`
- in-memory memory store
- `defineAgent()` composition API and local `agent.run()`
- declarative Tool SDK
- declarative Connector SDK
- local connector bundle lifecycle
- `FilesystemConnector`
- secure GET-only `HttpConnector`
- connector security metadata and security policy evaluation
- Model Provider SDK
- model provider registry and resolver
- HTTP model provider foundation
- OpenAI-compatible provider adapter foundation
- Credential SDK and redaction helpers
- `ModelAssistedPlanner`
- live-model workflow example with opt-in configuration
- plan validation and one-attempt repair pipeline
- versioned planner prompt assets
- runnable examples
- Vitest unit, integration, example, and evaluation tests
- GitHub Actions CI
- open-source documentation, grant-readiness docs, and release docs

Known limitations:

- no npm packages have been published yet
- no production external provider integration is included
- no OAuth or authentication flows are included
- no persistent database-backed memory is included
- dashboard is not production-ready
- connector/runtime safety is still local-first and alpha-stage
