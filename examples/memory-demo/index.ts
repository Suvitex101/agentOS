import { InMemoryMemoryStore, MemoryScope } from "@agentosdev/sdk";
import { createExampleAgent, printRun } from "../shared";

const firstTask = "Summarize AgentOS as an open-source AI agent infrastructure project for Africa.";
const secondTask = "Summarize AgentOS Africa infrastructure";
const memoryDisabledTask = "Summarize AgentOS without reading or writing memory.";

async function main() {
  const memoryStore = new InMemoryMemoryStore();
  const agent = createExampleAgent({
    id: "memory-demo-agent",
    name: "Memory Demo Agent",
    description: "Shows scoped memory reads and writes during simulated agent runs.",
    memoryStore,
  });
  const agentScope = {
    type: MemoryScope.Agent,
    id: agent.id,
  };

  const firstResult = await agent.run(firstTask);
  const secondResult = await agent.run(secondTask);
  const memoryDisabledResult = await agent.run(memoryDisabledTask, {
    memory: false,
  });
  const records = await memoryStore.list(agentScope);

  printRun({
    title: "Memory Demo: First Run",
    agent,
    task: firstTask,
    result: firstResult,
  });

  printRun({
    title: "Memory Demo: Related Run",
    agent,
    task: secondTask,
    result: secondResult,
  });

  printRun({
    title: "Memory Demo: Memory Disabled",
    agent,
    task: memoryDisabledTask,
    result: memoryDisabledResult,
  });

  console.log(`\nMemory records in agent scope: ${records.length}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
