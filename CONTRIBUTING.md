# Contributing to AgentOS

Welcome, and thank you for your interest in AgentOS.

AgentOS is an open-source AI agent infrastructure layer for the Global South,
starting with Africa. We are building it carefully, in small phases, so
contributors can understand the system and help shape it.

## Project Philosophy

AgentOS is task-centric, not LLM-centric.

Many AI frameworks start with:

```text
User -> LLM -> Tools
```

AgentOS starts with the work:

```text
Mission -> Task -> Planner -> Plan -> Execution Engine -> Tools -> Result
```

The LLM is only one possible dependency. Planners, tools, connectors, memory
stores, and execution engines should remain provider-agnostic and replaceable.

## Repository Structure

```text
apps/
  web/          Next.js shell for the future dashboard and developer console

packages/
  core/         Planner, execution, registry, tool authoring, and agent helpers
  memory/       Memory contracts and in-memory store
  sdk/          Developer-facing exports
  types/        Shared TypeScript domain and architecture types
  tools/        Placeholder for future tool helpers
  connectors/  Placeholder for future provider connectors
  config/       Shared TypeScript configuration

examples/       Runnable local examples
tests/          Unit, integration, and example verification tests
docs/           Contributor-focused documentation
```

## Development Workflow

1. Fork or clone the repository.
2. Install dependencies with `pnpm install`.
3. Create a branch for your work.
4. Make a focused change.
5. Run the local quality gate.
6. Open a pull request with context and verification notes.

## Branch Names

Use short, descriptive names. Examples:

```text
feature/tool-validation
fix/memory-scope-search
docs/architecture-runtime
test/registry-duplicates
```

No heavy convention is required. Clarity matters most.

## Commit Messages

Use simple, readable commit messages:

```text
Add registry validation tests
Fix planner payment rule ordering
Document tool authoring API
```

If a commit changes behavior, include enough context in the body for reviewers
to understand why.

## Running Examples

```bash
pnpm example:basic
pnpm example:community
pnpm example:business
pnpm example:research
pnpm example:memory
pnpm example:custom-tool
```

Examples are local and mocked. They do not call Discord, Gmail, WhatsApp,
Paystack, LLMs, databases, or external services.

## Running Tests

```bash
pnpm test
pnpm test:unit
pnpm test:integration
pnpm test:examples
pnpm test:watch
```

Before opening a pull request, run:

```bash
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:examples
```

## Coding Standards

- Keep TypeScript strongly typed.
- Prefer clear interfaces over clever abstractions.
- Avoid unnecessary dependencies.
- Keep runtime components provider-agnostic.
- Do not add external API calls unless a phase explicitly asks for them.
- Keep examples and docs accurate when public APIs change.
- Add or update tests when behavior changes.

## Pull Request Process

When opening a pull request:

- Explain what changed.
- Explain why it changed.
- Link related issues or discussions if available.
- Include the commands you ran locally.
- Keep the PR focused and reviewable.

Small, well-scoped PRs are easier to review and merge.

## Review Expectations

Review should be kind, direct, and grounded in the code.

Maintainers may ask for:

- clearer naming
- smaller scope
- stronger tests
- more accurate docs
- better alignment with the task-centric architecture

Disagreement is normal. Assume good intent and work toward the best outcome for
contributors and users.

## Proposing New Features

For small improvements, open an issue or pull request with context.

For major architectural changes, please open a feature request first. Include:

- the problem
- the proposed API or behavior
- alternatives considered
- risks or tradeoffs
- how it fits the AgentOS roadmap

Major changes should be discussed before implementation.

## Reporting Bugs

Use the bug report template and include:

- what happened
- what you expected
- steps to reproduce
- environment details
- logs or command output

Reproducible reports help maintainers fix issues faster.

## First Contribution

If this is your first open-source contribution, start with
[docs/first-contribution.md](docs/first-contribution.md). It walks through
installing AgentOS, running examples, writing a local tool, running tests, and
submitting a pull request.
