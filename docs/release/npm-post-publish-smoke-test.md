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
npm install @agentos/sdk@alpha
cat > index.mjs <<'EOF'
import {
  AgentOSRegistry,
  InMemoryMemoryStore,
  RuleBasedPlanner,
  SimpleExecutionEngine,
  defineAgent,
} from "@agentos/sdk";

const agent = defineAgent({
  id: "smoke-agent",
  name: "Smoke Agent",
  description: "Verifies the published AgentOS SDK package.",
  planner: new RuleBasedPlanner(),
  executionEngine: new SimpleExecutionEngine(),
  registry: new AgentOSRegistry(),
  memoryStore: new InMemoryMemoryStore(),
});

const result = await agent.run("Summarize the AgentOS alpha release.");

if (result.status !== "completed") {
  throw new Error(`Expected completed result, received ${result.status}`);
}

console.log("AgentOS npm smoke test passed.");
console.log(result.answer);
EOF
node index.mjs
```

## Expected Result

The script should import from `@agentos/sdk`, create an agent, run a
deterministic task, and print `AgentOS npm smoke test passed.`

## If It Fails

- Confirm `@agentos/sdk@alpha` resolves to `0.1.0-alpha.1`.
- Confirm dependent `@agentos/*` packages were published first.
- Confirm package export maps point to `dist/index.js` and `dist/index.d.ts`.
- Confirm no package still contains `workspace:` dependency specifiers.
