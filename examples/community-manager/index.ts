import { createExampleAgent, printRun } from "../shared";

const task =
  "Summarize the top complaints in our Discord community this week and recommend next actions.";

async function main() {
  const agent = createExampleAgent({
    id: "community-manager",
    name: "Community Manager",
    description: "Supports community teams with simulated planning and execution.",
    metadata: {
      useCase: "community-management",
    },
  });

  const result = await agent.run(task);

  printRun({
    title: "Community Manager",
    agent,
    task,
    result,
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
