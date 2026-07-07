import { createExampleAgent, printRun } from "../shared";

const task =
  "Prepare an invoice/payment workflow for a customer order and draft a follow-up message.";

async function main() {
  const agent = createExampleAgent({
    id: "business-assistant",
    name: "Business Assistant",
    description: "Demonstrates simulated small business workflow planning.",
    metadata: {
      useCase: "business-operations",
    },
  });

  const result = await agent.run(task);

  printRun({
    title: "Business Assistant",
    agent,
    task,
    result,
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
