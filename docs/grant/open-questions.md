# AgentOS Open Questions

This document records important architectural tradeoffs, technical risks,
engineering unknowns, and future research areas. It is intentionally candid.

## Architectural Tradeoffs

### Task-Centric Versus Graph-Centric Runtime

AgentOS currently uses a simple task-to-plan-to-execution flow. This keeps the
system understandable and testable. More complex workflows may eventually need a
graph runtime or state machine.

Open question: should graph execution become a first-class execution engine, or
remain an optional implementation behind the existing contracts?

### Registry Simplicity Versus Package Management

The current in-memory registry is easy to reason about. Future connector and
tool ecosystems may require version constraints, dependency metadata, conflict
resolution, and package provenance.

Open question: how much package-management behavior belongs in core versus in
future tooling?

### Connector Bundles Versus Individual Registration

Bundle registration improves developer ergonomics. Individual registration
keeps components explicit. Both exist today.

Open question: should future connector packages expose only bundle registration,
or should lower-level registration remain equally prominent?

### Deterministic Planning Versus LLM Planning

The current planner is deterministic. This is useful for tests and local
development. Future planners may use LLMs or hybrid strategies.

Open question: how should AgentOS evaluate and compare planner quality across
deterministic and model-based planners?

## Technical Risks

### API Surface Growth

AgentOS has added several concepts quickly: tasks, missions, plans, tools,
connectors, registries, memory, runtime, bundles, traces, and resources.

Risk: the public API could become harder to learn unless documentation and
package boundaries are kept clear.

### Type Duplication

Some domain concepts exist both as broad shared types and as implementation
specific helper types. This is common in early architecture work, but it can
lead to confusion.

Risk: contributors may struggle to identify which interface is canonical.

### Local Mock Behavior

Local mocked tools and connectors are useful for architecture validation, but
they do not prove production connector behavior.

Risk: real provider integration may reveal missing auth, rate limit,
pagination, error handling, or webhook abstractions.

### Memory Semantics

Current memory is simple keyword search over scoped records. It is intentionally
not semantic memory.

Risk: future memory features may need careful API design to avoid coupling
AgentOS to one vector store or embedding provider.

## Engineering Unknowns

- best abstraction for LLM provider integration
- production shape of connector authentication without hard-coding providers
- durable memory adapter contract
- policy and permission enforcement boundaries
- trace format needed for real observability tools
- versioning strategy for tools and connector bundles
- packaging strategy for community-contributed connectors

## Future Research Areas

- task-centric evaluation methods
- planner strategy comparison
- trace-based debugging and observability
- connector portability across providers
- memory scoping and retrieval strategies
- tool resolution algorithms
- lightweight policy enforcement for agent execution

## Questions Before Grant Submission

- Which specific grant outcome should be proposed: LLM provider abstraction,
  connector SDK maturity, first real connector, documentation site, or public
  alpha?
- What measurable milestones should be committed for the grant period?
- What license should the project use before broader public distribution?
- Should the application emphasize Global South developer infrastructure,
  general AI infrastructure, or both?
