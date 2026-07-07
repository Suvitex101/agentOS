# First Contribution Guide

Welcome. This guide is for anyone making a first contribution to AgentOS or to
open source in general.

You do not need to understand the whole system before helping. Start small, run
the examples, and make one focused improvement.

## 1. Clone The Repository

```bash
git clone <repository-url>
cd agentos
```

If you are contributing through GitHub, fork the repository first and clone your
fork.

## 2. Install Dependencies

```bash
pnpm install
```

AgentOS uses pnpm workspaces.

## 3. Run An Example

Start with the basic example:

```bash
pnpm example:basic
```

Then try the custom tool example:

```bash
pnpm example:custom-tool
```

Examples are local and mocked. They do not call external services.

## 4. Understand The Current Runtime

The local runtime is:

```text
Input -> Task -> Planner -> Plan -> Execution Engine -> Tool Resolver -> Registry -> Tool -> Result
```

For a deeper explanation, read [../ARCHITECTURE.md](../ARCHITECTURE.md).

## 5. Write A Small Tool

Tools are defined with `defineTool()`.

```ts
import { defineTool } from "@agentos/sdk";

export const helloTool = defineTool<{ name: string }, string>({
  id: "hello-tool",
  name: "Hello Tool",
  description: "Returns a friendly greeting.",
  capability: "general",
  version: "1.0.0",
  execute({ input }) {
    return {
      success: true,
      output: `Hello, ${input.name}`,
      metadata: {},
      durationMs: 1,
      errors: [],
    };
  },
});
```

Register tools with `AgentOSRegistry`:

```ts
registry.registerTool(helloTool);
```

## 6. Run Tests

```bash
pnpm test
```

You can also run focused test groups:

```bash
pnpm test:unit
pnpm test:integration
pnpm test:examples
```

## 7. Run The Quality Gate

Before opening a pull request, run:

```bash
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:examples
```

If formatting fails, run:

```bash
pnpm format
```

## 8. Create A Branch

Use a clear branch name:

```bash
git checkout -b docs/first-tool-example
```

Other examples:

```text
fix/registry-validation
test/tool-resolver
feature/memory-policy-docs
```

## 9. Open A Pull Request

In your pull request, include:

- what changed
- why it changed
- how you tested it
- any questions or follow-up work

For major ideas, open a feature request before writing a large implementation.

## Good First Contributions

Good first contributions include:

- improving docs
- adding examples
- adding focused tests
- clarifying error messages
- fixing small bugs
- improving TypeScript types without changing behavior

Thank you for helping build AgentOS.
