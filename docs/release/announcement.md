# AgentOS 0.1.0-alpha.1 Announcement Drafts

These drafts are for public alpha announcement copy. Keep links updated after
the GitHub release exists.

## GitHub / Long Form

AgentOS `0.1.0-alpha.1` is ready as the first public alpha candidate.

AgentOS is an open-source, task-centric infrastructure layer for building
intelligent agents. Instead of centering the framework around a model call, the
architecture is organized around:

```text
Task -> Planner -> Plan -> Execution Engine -> Registry -> Tool -> Result
```

This alpha includes the core runtime architecture, Tool SDK, Connector SDK,
Model Provider SDK, Credential SDK, Security Policy Engine, Filesystem
Connector, read-first GitHub Connector, OpenAI-compatible provider foundation,
and native local Ollama provider.

It is still alpha software. The runtime is local-first, APIs may evolve, memory
is in-memory only, and connector/provider coverage is intentionally limited.

The goal of this release is to invite developers to review the architecture,
try the examples, and help shape an open infrastructure layer for intelligent
work.

Start here:

- README
- Architecture docs
- First contribution guide
- Examples

## X / Twitter

AgentOS `0.1.0-alpha.1` is ready as a public alpha candidate.

It is an open-source, task-centric infrastructure layer for intelligent agents:

Task -> Planner -> Plan -> Execution -> Tools -> Result

Includes Tool SDK, Connector SDK, Model Provider SDK, local Ollama support,
GitHub connector, tests, examples, and docs.

Alpha, local-first, and open for contributors.

## Discord

AgentOS `0.1.0-alpha.1` is ready for public alpha review.

AgentOS is an open-source infrastructure layer for building task-centric agents.
The alpha includes the core runtime, registry, planners, execution engine, Tool
SDK, Connector SDK, Model Provider SDK, Credential SDK, Filesystem/GitHub
connectors, OpenAI-compatible provider foundation, and native Ollama support.

It is not production-stable yet. APIs may change, memory is still in-memory,
and connector/provider coverage is intentionally limited.

Good first ways to help:

- run the examples
- review the architecture docs
- build a small tool
- file issues for confusing docs or APIs
- suggest connector/provider improvements

## LinkedIn

We are preparing AgentOS `0.1.0-alpha.1`, the first public alpha candidate for
an open-source, task-centric infrastructure layer for intelligent agents.

AgentOS is designed around tasks, plans, tools, connectors, memory, and
provider-agnostic reasoning engines. The goal is to make intelligent workflows
more inspectable, extensible, and portable.

This alpha includes:

- core task-centric runtime
- planners and execution engine
- Tool SDK and Connector SDK
- Model Provider SDK
- Credential SDK and security policy evaluation
- Filesystem and GitHub connectors
- OpenAI-compatible provider foundation
- native Ollama provider for local open models
- examples, tests, CI, and release tooling

It is honestly alpha: local-first, evolving APIs, limited providers/connectors,
and no production dashboard yet.

We are looking for developers and infrastructure engineers who want to review
the architecture, try the examples, and help shape the next phase.
