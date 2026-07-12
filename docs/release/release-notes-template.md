# Release Notes Template

## Summary

Briefly describe the release and its intended audience.

## Highlights

- Highlight 1
- Highlight 2
- Highlight 3

## Installation

```bash
npm install @agentosdev/sdk
```

## Minimal Example

```ts
import {
  AgentOSRegistry,
  InMemoryMemoryStore,
  RuleBasedPlanner,
  SimpleExecutionEngine,
  defineAgent,
} from "@agentosdev/sdk";

const agent = defineAgent({
  id: "example-agent",
  name: "Example Agent",
  description: "Runs a deterministic AgentOS task.",
  planner: new RuleBasedPlanner(),
  executionEngine: new SimpleExecutionEngine(),
  registry: new AgentOSRegistry(),
  memoryStore: new InMemoryMemoryStore(),
});
```

## Known Limitations

- Local-first runtime.
- Connectors are alpha-stage.
- No production external provider integrations.
- No persistent database-backed memory.
- Dashboard is not production-ready.

## Upgrade Notes

Document breaking changes or migration notes here.

## Contributors

Thank contributors here.
