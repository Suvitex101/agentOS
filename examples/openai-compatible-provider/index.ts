import {
  AgentOSRegistry,
  HTTPModelProviderBase,
  ModelAssistedPlanner,
  ModelProviderCapability,
  ModelProviderResolver,
  createOpenAICompatibleProvider,
  createTask,
  type Agent,
  type ExecutionContext,
  type HTTPModelProviderFetch,
} from "@agentosdev/sdk";

const mockedFetch: HTTPModelProviderFetch = async () =>
  new Response(
    JSON.stringify({
      id: "chatcmpl-agentos-demo",
      model: "openai-compatible-demo-model",
      choices: [
        {
          message: {
            content: JSON.stringify({
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
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 24,
        completion_tokens: 32,
        total_tokens: 56,
      },
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    }
  );

async function main() {
  const registry = new AgentOSRegistry();
  const transport = new HTTPModelProviderBase({
    baseUrl: "https://api.example.test",
    timeoutMs: 5000,
    maxResponseBytes: 1024 * 1024,
    defaultHeaders: {
      authorization: "Bearer sk-example-not-real",
    },
    fetchImplementation: mockedFetch,
  });
  const provider = createOpenAICompatibleProvider({
    id: "openai-compatible-demo",
    name: "OpenAI-Compatible Demo Provider",
    model: "openai-compatible-demo-model",
    transport,
  });

  registry.registerModelProvider(provider);
  registry.setDefaultModelProvider(provider.id);

  const planner = new ModelAssistedPlanner({
    providerResolver: new ModelProviderResolver({ registry }),
    options: {
      fallback: "fail",
      provider: {
        requiredCapabilities: [ModelProviderCapability.TextGeneration],
        preferredCapabilities: [ModelProviderCapability.Reasoning],
      },
    },
  });
  const task = createTask({
    input: "Create a short research plan for a community grant proposal.",
    source: {
      type: "example",
      name: "openai-compatible-provider",
    },
  });
  const agent: Agent = {
    id: "openai-compatible-example-agent",
    name: "OpenAI-Compatible Example Agent",
    description: "Demonstrates the HTTP model provider foundation with mocked transport.",
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
  const context: ExecutionContext = {
    agent,
    task,
    memory: [],
    resources: [],
    variables: {},
    environment: {},
  };
  const plan = await planner.plan(agent, task, context);
  const defaultProvider = registry.defaultModelProvider();

  console.log("\n=== OpenAI-Compatible Provider Foundation ===");
  console.log(`Registered providers: ${registry.listModelProviders().length}`);
  console.log(`Default provider: ${defaultProvider?.id}`);
  console.log(`Planner: ${String(plan.metadata?.plannerName)}`);
  console.log(`Provider: ${String(plan.metadata?.providerId)}`);
  console.log(`Generated steps: ${plan.steps.length}`);

  for (const step of plan.steps) {
    console.log(`- ${step.order}. ${step.description}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
