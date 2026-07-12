import {
  AgentOSRegistry,
  ModelAssistedPlanner,
  ModelProviderCapability,
  ModelProviderResolver,
  RuleBasedPlanner,
  createTask,
  defineModelProvider,
  type Agent,
  type ExecutionContext,
} from "@agentosdev/sdk";

const validProvider = defineModelProvider({
  id: "local-structured-planner",
  name: "Local Structured Planner Provider",
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
            description: "Gather relevant information",
            type: "research",
            requiredCapability: "research",
          },
          {
            description: "Analyze content",
            type: "transform",
            requiredCapability: "analytics",
          },
          {
            description: "Produce summary or findings",
            type: "respond",
            requiredCapability: "communication",
          },
        ],
      }),
      model: "local-structured-demo",
      finishReason: "stop",
      durationMs: 2,
    };
  },
});

const invalidProvider = defineModelProvider({
  id: "local-invalid-planner",
  name: "Local Invalid Planner Provider",
  version: "1.0.0",
  capabilities: [ModelProviderCapability.TextGeneration],
  generate() {
    return {
      text: "not-json",
    };
  },
});

async function main() {
  const agent: Agent = {
    id: "model-assisted-example-agent",
    name: "Model Assisted Example Agent",
    description: "Demonstrates provider-backed planning without external APIs.",
    version: "0.1.0",
    capabilities: [{ name: "research" }, { name: "analytics" }, { name: "communication" }],
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
    id: "model-assisted-example-task",
    input: "Summarize the top community complaints and recommend next actions.",
    source: {
      type: "example",
      name: "model-assisted-planner",
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
  const providerRegistry = new AgentOSRegistry();

  providerRegistry.registerModelProvider(validProvider);
  providerRegistry.registerModelProvider(invalidProvider);
  providerRegistry.setDefaultModelProvider(validProvider.id);

  const providerResolver = new ModelProviderResolver({
    registry: providerRegistry,
  });
  const modelPlanner = new ModelAssistedPlanner({
    providerResolver,
    fallbackPlanner: new RuleBasedPlanner(),
  });
  const successfulPlan = await modelPlanner.plan(agent, task, context, {
    provider: {
      requiredCapabilities: [ModelProviderCapability.TextGeneration],
      preferredCapabilities: [ModelProviderCapability.Reasoning],
    },
  });
  const fallbackPlan = await modelPlanner.plan(agent, task, context, {
    provider: {
      providerId: invalidProvider.id,
    },
    fallback: "rule-based",
  });

  let failModeError = "none";

  try {
    await modelPlanner.plan(agent, task, context, {
      provider: {
        providerId: invalidProvider.id,
      },
      fallback: "fail",
    });
  } catch (error) {
    failModeError =
      error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
  }

  const ruleBasedPlan = new RuleBasedPlanner().plan(agent, task, context);

  console.log("\n=== Model Assisted Planner ===");
  console.log(`Provider-backed plan steps: ${successfulPlan.steps.length}`);
  console.log(`Provider resolved: ${successfulPlan.metadata?.providerId}`);
  console.log(`Fallback used: ${String(fallbackPlan.metadata?.fallbackUsed)}`);
  console.log(`Fallback reason: ${String(fallbackPlan.metadata?.fallbackReason)}`);
  console.log(`Fail mode error: ${failModeError}`);
  console.log(`RuleBasedPlanner still works: ${ruleBasedPlan.steps.length} steps`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
