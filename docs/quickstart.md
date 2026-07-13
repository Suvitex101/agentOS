# AgentOS Quickstart

This guide gets you from an empty directory to a running AgentOS agent in about
ten minutes.

AgentOS is published on npm as an alpha release. The recommended public entry
point is `@agentosdev/sdk`.

## 1. Create A Project

```bash
mkdir agentos-hello
cd agentos-hello
npm init -y
```

## 2. Install AgentOS

```bash
npm install @agentosdev/sdk@alpha
```

Equivalent commands:

```bash
pnpm add @agentosdev/sdk@alpha
yarn add @agentosdev/sdk@alpha
```

## 3. Enable ESM

AgentOS packages are ESM. Add `"type": "module"` to your `package.json`:

```json
{
  "type": "module"
}
```

## 4. Create A Minimal Agent

Create `index.mjs`:

```js
import {
  InMemoryMemoryStore,
  ResultStatus,
  RuleBasedPlanner,
  SimpleExecutionEngine,
  createAgentOSRegistryBootstrapExample,
  defineAgent,
} from "@agentosdev/sdk";

const registry = createAgentOSRegistryBootstrapExample();

const agent = defineAgent({
  id: "quickstart-agent",
  name: "Quickstart Agent",
  description: "A deterministic local AgentOS agent.",
  planner: new RuleBasedPlanner(),
  executionEngine: new SimpleExecutionEngine(),
  registry,
  memoryStore: new InMemoryMemoryStore(),
});

const result = await agent.run("Summarize why AgentOS is task-centric.");

if (result.status !== ResultStatus.Completed) {
  throw new Error(`Task failed with status: ${result.status}`);
}

console.log(result.answer);
console.log(`Trace events: ${result.trace.length}`);
console.log(`Tool calls: ${result.toolCalls.length}`);
```

## 5. Run It

```bash
node index.mjs
```

The example uses the deterministic rule-based planner, local execution engine,
in-memory memory store, and bootstrap registry. It does not require API keys,
external services, Ollama, GitHub, or live model access.

## 6. Add A Simple Custom Tool

```js
import { ToolPermissionLevel, defineTool } from "@agentosdev/sdk";

const sentimentTool = defineTool({
  id: "sentiment-tool",
  name: "Sentiment Tool",
  description: "Returns a simple deterministic sentiment label.",
  version: "1.0.0",
  capability: "analysis",
  permissions: [ToolPermissionLevel.None],
  execute() {
    return {
      success: true,
      output: { sentiment: "neutral" },
      metadata: { source: "quickstart" },
      durationMs: 0,
      errors: [],
    };
  },
});

registry.registerTool(sentimentTool);
```

## 7. Explore Connectors And Providers

- Connectors: [connectors package README](../packages/connectors/README.md)
- Providers: [providers package README](../packages/providers/README.md)
- API reference: [docs/api-reference.md](api-reference.md)

AgentOS `0.1.0-alpha.1` is an alpha release. APIs are usable for exploration
and contribution, but may change before beta.
