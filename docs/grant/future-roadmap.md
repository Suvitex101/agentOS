# AgentOS Future Roadmap

This roadmap is grant-oriented and realistic. It summarizes likely future work
based on the current repository state. It does not imply that these items are
already implemented.

## Next 3 Months

Primary objective: make the local developer experience and architecture easier
to evaluate and extend.

Likely work:

- stabilize connector bundle APIs
- move connector-oriented examples and exports into clearer package boundaries
- improve API documentation for tools, connectors, registry, runtime, and memory
- add more local mocked connector bundles for realistic workflows
- refine `ToolResolver` behavior and matching rules
- improve error messages and validation results
- add more integration tests around connector bundle lifecycle and `agent.run()`
- prepare grant/application-facing project brief and demo scripts

## Next 6 Months

Primary objective: introduce replaceable provider abstractions while preserving
provider-agnostic architecture.

Likely work:

- LLM provider abstraction for planners and tools
- first real connector package design, still with careful separation between
  connector contracts and provider APIs
- persistent memory adapter interface and at least one local durable adapter
- documentation site or expanded API reference
- playground or lightweight dashboard for inspecting tasks, plans, registry
  contents, traces, and results
- stronger contributor issue labeling and onboarding paths
- release process for early public versions

## Next 12 Months

Primary objective: move from local MVP foundation toward a usable alpha
ecosystem.

Likely work:

- public alpha focused on local development and contributor feedback
- real connector packages for selected messaging, community, business, or
  research workflows
- policy and permission model refinement
- observability and trace inspection improvements
- memory adapter ecosystem, including possible vector search adapters
- production-oriented execution engine research
- early multi-agent or workflow composition experiments
- governance model appropriate to contributor growth

## Deliberately Out Of Scope For Now

The project should avoid premature work on:

- marketplace infrastructure before connector/tool APIs stabilize
- distributed execution before local execution contracts mature
- enterprise features before production runtime requirements are clearer
- broad connector coverage before one or two connector designs are excellent
