# AgentOS Grant Demo Script

This is a 3-5 minute demo script for Sentient Foundation grant review or public
GitHub walkthroughs. It is intentionally grounded in the current repository.

## 0:00-0:45 — What AgentOS Is

"AgentOS is an open-source TypeScript infrastructure layer for building
task-centric AI agents. The goal is not to make another LLM-first framework.
AgentOS starts from the work: a task becomes a plan, the plan is executed
through registered capabilities and tools, and the system returns a structured
result with trace data.

The current implementation is local and provider-agnostic. It includes a
rule-based planner, local execution engine, in-memory registry, in-memory memory
store, Tool SDK, Connector SDK, local connector bundle, runnable examples,
tests, and CI."

## 0:45-1:20 — Why It Exists

"Many agent systems are organized around a model call. AgentOS is organized
around a task. This makes planners, tools, connectors, memory, and execution
engines replaceable. Models can still be used later, but they are implementation
details behind planner or tool contracts.

This matters for developers who need portable infrastructure, especially when
working across local workflows, regional tools, messaging-first operations, or
business processes that do not fit one provider's assumptions."

## 1:20-2:00 — Architecture Overview

Show:

```bash
open docs/architecture-diagram.md
```

Or walk through:

```text
Developer -> defineAgent() -> Agent Runtime -> Task -> Planner -> Plan -> Registry -> Tool Resolver -> Connector Bundle -> Tool Execution -> Memory -> Result
```

"The registry is the kernel catalog. It knows about capabilities, connectors,
tools, resources, and connector bundles. The execution engine asks the tool
resolver for a tool instead of directly depending on a provider."

## 2:00-2:45 — Run agent.run()

Run:

```bash
pnpm example:basic
```

Explain:

"This creates an agent, turns a string input into a task, generates a plan using
the rule-based planner, resolves local tools through the registry, executes
those tools, writes memory when enabled, and returns a structured result."

Optional follow-up:

```bash
pnpm example:memory
```

"This shows scoped memory reads and writes using the in-memory memory store."

## 2:45-3:25 — Run LocalCommunityConnector

Run:

```bash
pnpm example:community-connector
```

Explain:

"This demonstrates connector bundle registration. The bundle registers the
connector, capabilities, tools, and resources in one call. It then resolves and
executes a bundled local tool, removes the bundle, and verifies cleanup.

This is not a real Discord, Slack, or Telegram connector. It is a realistic
local mock connector bundle that validates the Connector SDK architecture."

## 3:25-4:15 — Show Tests And CI

Run locally:

```bash
pnpm test
pnpm test:examples
```

Mention CI:

"The GitHub Actions CI runs install, format check, typecheck, lint, tests,
build, and example verification on pull requests and pushes to main."

## 4:15-5:00 — Current Maturity

"AgentOS is not production-ready yet. It does not currently include real
external connectors, LLM provider integration, persistent database-backed
memory, vector memory, distributed execution, or a production dashboard.

What exists today is the open-source architecture foundation: typed contracts,
local runtime, registry, memory, Tool SDK, Connector SDK, connector bundles,
tests, examples, CI, and documentation. The next milestones should build on
this foundation without making any single model provider the center of the
architecture."
