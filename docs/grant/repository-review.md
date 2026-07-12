# AgentOS Repository Review

This review is based on the current repository. It is intended to help prepare
for grant submission and future engineering prioritization.

## Strengths

### Clear Architectural Direction

The repository consistently presents AgentOS as task-centric rather than
LLM-centric. The core concepts are visible in code and documentation: task,
planner, plan, execution engine, registry, capability, tool, connector, memory,
trace, and result.

### Strong TypeScript Foundation

The shared `@agentosdev/types` package gives the project a clear vocabulary. This
is useful for contributors and for future provider implementations.

### Local End-To-End Runtime Exists

`agent.run()` works locally through task normalization, memory read, planning,
plan validation, execution, memory write, and result return. This is a real
developer experience milestone, even though execution remains local and mocked.

### Tool And Connector Authoring APIs

`defineTool()` and `defineConnector()` provide concise declarative APIs. They
include validation, immutability, inspection, summaries, and registry
compatibility.

### Registry As Kernel Catalog

The in-memory registry provides a useful central discovery mechanism for
capabilities, connectors, tools, resources, and connector bundles.

### Testing And CI

Vitest coverage includes unit, integration, and example verification tests.
GitHub Actions runs format, typecheck, lint, tests, build, and example
verification.

### Contributor Documentation

The repository includes README, architecture, vision, positioning, roadmap,
contributing guide, code of conduct, issue templates, pull request template, and
first contribution guide.

## Weaknesses

### Package Boundaries Need Tightening

Much of the active implementation lives in `packages/core`. Placeholder
packages such as `packages/tools` and `packages/connectors` exist, but they do
not yet carry meaningful functionality.

### No License File Visible

The repository describes itself as open source, but a license file was not
visible in the reviewed file list. This should be resolved before grant
submission or public launch.

### Connector SDK And Connector Bundle Concepts Are Close

`defineConnector()` and `registerConnectorBundle()` are both useful, but the
relationship between a connector definition and a connector bundle should be
documented and possibly formalized in types.

### Runtime Is Still Local And Mocked

This is expected for the current phase, but reviewers should understand that
there are no real connectors, no external APIs, no LLM provider integration, and
no persistent storage yet.

### Dashboard Is Only A Shell

The Next.js app exists for future dashboard work, but it does not currently add
product functionality.

## Technical Debt

- `packages/core` is carrying many responsibilities.
- Some concepts may need clearer canonical naming as the API matures.
- The registry bundle validation is useful but could become more formal and
  public.
- Execution control methods are placeholders.
- Tool resolution is intentionally simple and may need a more explicit strategy
  model.
- Memory search is keyword-based and should not be presented as semantic memory.
- Examples are useful but could eventually be grouped with narrative guides.

## Architectural Inconsistencies Or Confusing Areas

### Connector Definition Versus Connector Manifest

The code distinguishes connector authoring definitions from lower-level
manifest-like types. This is workable, but new contributors may need guidance on
which layer to use.

### Capabilities As Strings And Objects

Connector helpers can accept string capability ids and normalize them into
capability objects. This improves ergonomics, but it may obscure where canonical
capability definitions should live.

### Manual Registration And Bundle Registration

Both registration paths are valid. Documentation should clarify when to use
manual registration versus bundle registration.

## Documentation Gaps

- API reference for public SDK exports
- license and release policy
- package boundary explanation
- examples-to-concepts guide
- connector bundle authoring guide
- memory provider authoring guide
- planner authoring guide
- trace/event reference

## Opportunities To Simplify

- Move mature connector-related code from `core` into `connectors` once package
  boundaries are clearer.
- Provide a single recommended path for most users: bundle registration.
- Add public validation helpers before registration.
- Keep placeholder packages minimal until they have clear ownership.
- Avoid adding new runtime concepts before the current ones are documented.

## High-Priority Improvements

1. Add an open-source license.
2. Create API reference documentation for `@agentosdev/sdk`.
3. Clarify connector definition versus connector bundle in docs and types.
4. Define the LLM provider abstraction without making LLMs central.
5. Move toward at least one durable memory adapter or explicit adapter contract.

## Recommended Engineering Priorities After Grant Submission

1. License, release, and governance basics.
2. API documentation and public SDK reference.
3. Package boundary cleanup for `core`, `connectors`, and `tools`.
4. First provider-agnostic LLM planner interface.
5. First real connector design document before implementation.
6. Persistent memory adapter design.
7. Playground/dashboard for inspecting tasks, plans, traces, registry contents,
   and results.
