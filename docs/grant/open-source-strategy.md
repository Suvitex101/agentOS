# AgentOS Open-Source Strategy

AgentOS is intended to be open infrastructure for task-centric intelligent work.
The current repository already includes the foundational code, examples, tests,
and contributor documentation needed for early open-source collaboration.

## What Is Open Source Today

The repository currently includes:

- TypeScript monorepo foundation
- shared domain types
- local planner implementation
- local execution engine implementation
- in-memory registry
- in-memory memory store
- Tool SDK
- Connector SDK
- local connector bundle
- runtime composition API
- runnable examples
- tests and CI
- architecture, vision, positioning, roadmap, contributing, and onboarding
  documentation

The project does not currently include real external connectors, LLM provider
integrations, persistent infrastructure, hosted services, or production
deployment automation.

## Why These Components Are Open

Agent infrastructure benefits from openness because its value depends on
trustworthy contracts and inspectable behavior.

AgentOS keeps the following open:

- task and plan models, so execution can be understood and audited
- planner and execution contracts, so implementations can be replaced
- registry and tool interfaces, so capabilities can be discovered consistently
- connector contracts, so integrations can be packaged without locking into one
  provider
- memory contracts, so storage strategies can evolve independently
- examples and tests, so contributors can verify behavior locally

This is important for an ecosystem where developers may need to integrate local
payment rails, regional messaging tools, domain-specific workflows, or
organization-specific infrastructure.

## How Developers Extend AgentOS

Developers can extend AgentOS today by:

- defining tools with `defineTool()`
- defining connectors with `defineConnector()`
- packaging connector bundles with capabilities, tools, and resources
- composing agents with `defineAgent()`
- replacing planners that implement the `Planner` contract
- replacing execution engines that implement the `ExecutionEngine` contract
- replacing memory stores that implement the `MemoryStore` contract

Future extension points may include LLM providers, persistent memory adapters,
policy modules, richer connector packages, distributed execution, and
observability integrations.

## Governance Philosophy

The repository currently has contributor documentation, issue templates, pull
request templates, a code of conduct, and CI. It does not yet have a formal
governance model, steering committee, release process, or published maintainer
policy.

The recommended governance approach is incremental:

1. maintain a clear technical roadmap
2. require tests and documentation for meaningful behavior changes
3. discuss major architecture changes before implementation
4. label approachable first issues for new contributors
5. publish release notes once public releases begin
6. define maintainer roles as contributor activity grows

This avoids inventing governance before the contributor base exists while still
setting expectations for responsible open-source development.

## Ecosystem Growth Strategy

Near-term ecosystem growth should focus on:

- high-quality examples
- clear API documentation
- connector bundle patterns
- local-first developer workflows
- focused issue labels
- tests that make contributions safer

Medium-term growth should focus on:

- real connector packages
- provider-agnostic LLM interfaces
- persistent memory adapters
- a documentation site
- a playground or dashboard for inspecting agents and runs

Long-term growth could include a marketplace or plugin ecosystem, but those
should remain future ideas until the core contracts have matured.
