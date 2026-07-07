import { createExampleAgent, printRun } from "../shared";

const task = "Analyze this grant opportunity and produce a short research plan.";

async function main() {
  const agent = createExampleAgent({
    id: "research-assistant",
    name: "Research Assistant",
    description: "Demonstrates simulated research and grant planning workflows.",
    metadata: {
      useCase: "research",
    },
  });

  const result = await agent.run(task);

  printRun({
    title: "Research Assistant",
    agent,
    task,
    result,
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
