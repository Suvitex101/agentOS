# AgentOS Executive Summary

AgentOS is an open-source TypeScript infrastructure layer for building
task-centric AI agents. It is designed as an operating layer for intelligent
work rather than an LLM-first application framework.

The current architecture is:

```text
Task -> Planner -> Plan -> Execution Engine -> Registry -> Capability -> Tool -> Result
```

Models are treated as replaceable implementation details. A planner may use an
LLM in the future, but the core AgentOS model does not require an LLM to be the
center of the system.

## What AgentOS Is

AgentOS provides a foundation for developers to compose agents from independent
components:

- typed task, plan, tool, connector, memory, trace, and result models
- a deterministic local `RuleBasedPlanner`
- a local `SimpleExecutionEngine`
- an in-memory `AgentOSRegistry`
- an in-memory memory store
- a declarative Tool SDK through `defineTool()`
- a declarative Connector SDK through `defineConnector()`
- connector bundle registration through `registerConnectorBundle()`
- runnable examples
- unit, integration, and example verification tests
- GitHub Actions CI

The project is still early. It does not yet include real external connectors,
LLM provider integration, persistent memory, vector search, distributed
execution, production orchestration, or a dashboard.

## Why It Exists

Many AI systems begin from model interaction:

```text
User -> Model -> Tools
```

That is useful for many applications, but it can make infrastructure tightly
coupled to specific providers, integration patterns, and execution assumptions.
AgentOS begins from the work:

```text
User -> Task -> Planner -> Execution -> Tool -> Result
```

This makes task state, planning, tool selection, execution traces, memory, and
results explicit. The design is intended to help developers build systems that
are easier to inspect, test, extend, and port across providers.

## Current Maturity

AgentOS is at a local MVP foundation stage. The repository has a functioning
monorepo, implemented local runtime flow, mocked tools, connector bundle
support, examples, tests, CI, and contributor documentation.

Current implementation is intentionally local. The project has prioritized
domain contracts, developer ergonomics, and testability before adding external
providers or production runtime complexity.

## Open-Source Philosophy

AgentOS is open source because infrastructure for intelligent work should be
transparent and extensible. Developers should be able to understand how tasks
become plans, how tools are resolved, how connectors expose capabilities, how
memory is scoped, and how results are produced.

The project is especially motivated by developers building for practical
workflows in the Global South, starting with Africa, where agent infrastructure
must adapt to local messaging, payments, business operations, research, and
community management contexts.

## Long-Term Vision

The long-term vision is not to promise artificial general intelligence. It is to
provide dependable open infrastructure for building intelligent systems that can
reason over tasks, use tools, remember context, and produce observable results.

Future work includes LLM provider abstractions, real connector packages,
persistent memory adapters, documentation improvements, a playground/dashboard,
and eventually a public alpha. These are roadmap items, not current behavior.
