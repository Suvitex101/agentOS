import { createExampleAgent, printRun } from "../shared";

const task = "Summarize what AgentOS can do today.";

async function main() {
  const agent = createExampleAgent({
    id: "basic-agent",
    name: "Basic Agent",
    description: "Demonstrates the smallest runnable AgentOS setup.",
  });

  const result = await agent.run(task);

  printRun({
    title: "Basic Agent",
    agent,
    task,
    result,
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
