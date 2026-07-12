# npm Post-Publish Smoke Test

Use this checklist immediately after manually publishing `0.1.0-alpha.1`.

This process verifies the public npm artifacts from a clean external project.
It does not publish, tag, or modify the repository.

## Prerequisites

- Node.js 20 or newer
- npm available locally
- Published packages available on npm with the `alpha` dist-tag

## Commands

```bash
mkdir -p /tmp/agentos-alpha-smoke
cd /tmp/agentos-alpha-smoke
npm init -y
npm install @agentosdev/sdk@alpha
cat > index.mjs <<'EOF'
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
  id: "smoke-agent",
  name: "Smoke Agent",
  description: "Verifies the published AgentOS SDK package.",
  planner: new RuleBasedPlanner(),
  executionEngine: new SimpleExecutionEngine(),
  registry,
  memoryStore: new InMemoryMemoryStore(),
});

const result = await agent.run("Summarize the AgentOS alpha release.");

if (result.status !== ResultStatus.Completed) {
  throw new Error(`Expected completed result, received ${result.status}`);
}

if (!result.toolCalls.length) {
  throw new Error("Expected at least one tool call from the bootstrap registry.");
}

console.log("AgentOS npm smoke test passed.");
console.log(result.answer);
EOF
node index.mjs
```

## Expected Result

The script should import from `@agentosdev/sdk`, create an agent, run a
deterministic task, and print `AgentOS npm smoke test passed.`

## If It Fails

- Confirm `@agentosdev/sdk@alpha` resolves to `0.1.0-alpha.1`.
- Confirm dependent `@agentosdev/*` packages were published first.
- Confirm package export maps point to `dist/index.js` and `dist/index.d.ts`.
- Confirm no package still contains `workspace:` dependency specifiers.
