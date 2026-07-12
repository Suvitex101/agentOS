import {
  AgentOSRegistry,
  ModelAssistedPlanner,
  ModelProviderCapability,
  ModelProviderResolver,
  RuleBasedPlanner,
  buildPlanningPrompt,
  createTask,
  defineModelProvider,
  type Agent,
  type ExecutionContext,
} from "@agentosdev/sdk";

const structuredProvider = defineModelProvider({
  id: "structured-prompt-provider",
  name: "Structured Prompt Provider",
  version: "1.0.0",
  capabilities: [
    ModelProviderCapability.TextGeneration,
    ModelProviderCapability.Reasoning,
    ModelProviderCapability.StructuredOutput,
  ],
  generate() {
    return {
      text: JSON.stringify({
        steps: [
          {
            description: "Gather relevant source material",
            type: "research",
            requiredCapability: "research",
          },
          {
            description: "Draft a concise response",
            type: "respond",
            requiredCapability: "communication",
          },
        ],
      }),
      model: "structured-prompt-demo",
      finishReason: "stop",
      durationMs: 3,
    };
  },
});

const standardProvider = defineModelProvider({
  id: "standard-prompt-provider",
  name: "Standard Prompt Provider",
  version: "1.0.0",
  capabilities: [ModelProviderCapability.TextGeneration],
  generate() {
    return {
      text: JSON.stringify({
        steps: [
          {
            description: "Understand the task",
            type: "reason",
          },
        ],
      }),
      model: "standard-prompt-demo",
      finishReason: "stop",
      durationMs: 2,
    };
  },
});

const agent: Agent = {
  id: "planner-prompt-example-agent",
  name: "Planner Prompt Example Agent",
  description: "Demonstrates versioned planning prompts.",
  version: "0.1.0",
  capabilities: [{ name: "research" }, { name: "communication" }],
  tools: [],
  memoryPolicy: {
    enabled: false,
    scopes: [],
    readableTypes: [],
    writableTypes: [],
  },
  permissions: [],
};

const task = createTask({
  id: "planner-prompt-example-task",
  input: "Create a short research plan for an open-source grant proposal.",
  source: {
    type: "example",
    name: "planner-prompts",
  },
});

const context: ExecutionContext = {
  agent,
  task,
  memory: [],
  resources: [],
  variables: {},
  environment: {},
};

async function main() {
  const structuredPrompt = buildPlanningPrompt({
    agent,
    task,
    provider: structuredProvider,
    maxSteps: 4,
  });
  const standardPrompt = buildPlanningPrompt({
    agent,
    task,
    provider: standardProvider,
    maxSteps: 4,
  });
  const registry = new AgentOSRegistry();

  registry.registerModelProvider(structuredProvider);
  registry.setDefaultModelProvider(structuredProvider.id);

  const planner = new ModelAssistedPlanner({
    providerResolver: new ModelProviderResolver({ registry }),
    fallbackPlanner: new RuleBasedPlanner(),
  });
  const plan = await planner.plan(agent, task, context, {
    debugPrompt: true,
  });

  console.log("\n=== Planner Prompts ===");
  console.log(`Prompt version: ${structuredPrompt.metadata.promptVersion}`);
  console.log(`Structured provider path: ${structuredPrompt.metadata.providerCapabilityPath}`);
  console.log(`Standard provider path: ${standardPrompt.metadata.providerCapabilityPath}`);
  console.log(`Structured prompt size: ${structuredPrompt.metadata.promptSize}`);
  console.log(`Standard prompt size: ${standardPrompt.metadata.promptSize}`);
  console.log(
    `JSON-only guidance present: ${structuredPrompt.prompt.includes("Return JSON only")}`
  );
  console.log(`Plan prompt version: ${String(plan.metadata?.promptVersion)}`);
  console.log(`Plan provider path: ${String(plan.metadata?.providerCapabilityPath)}`);
  console.log(`Debug prompt included: ${String(typeof plan.metadata?.debugPrompt === "string")}`);
  console.log(
    `Validation succeeded first pass: ${String(plan.metadata?.firstPassValidationSucceeded)}`
  );
  console.log("Steps:");

  for (const step of plan.steps) {
    console.log(`  ${step.order}. ${step.description}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
