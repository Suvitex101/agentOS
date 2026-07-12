import {
  AgentOSRegistry,
  CapabilityCategory,
  MemoryScope,
  MemoryType,
  ToolCategory,
  ToolPermissionLevel,
  ToolVisibility,
  createTask,
  defineTool,
  type Agent,
  type ExecutionContext,
} from "@agentosdev/sdk";

const sentimentTool = defineTool<{ text: string }, { sentiment: string; confidence: number }>({
  id: "tool-sentiment-demo",
  name: "Sentiment Demo Tool",
  description: "Detects simple positive or negative tone in local text.",
  capability: "sentiment",
  category: ToolCategory.Research,
  version: "1.0.0",
  author: {
    name: "AgentOS Examples",
  },
  tags: ["sentiment", "local", "demo"],
  visibility: ToolVisibility.Public,
  permissionLevel: ToolPermissionLevel.Read,
  examples: [
    {
      title: "Positive community feedback",
      input: {
        text: "Members love the new onboarding flow.",
      },
      output: {
        sentiment: "positive",
        confidence: 0.82,
      },
    },
  ],
  execute({ input }) {
    const startedAt = Date.now();
    const text = input.text.toLowerCase();
    const positive = ["love", "great", "helpful", "excellent"].some((word) => text.includes(word));

    return {
      success: true,
      output: {
        sentiment: positive ? "positive" : "needs_review",
        confidence: positive ? 0.82 : 0.61,
      },
      metadata: {
        local: true,
      },
      durationMs: Date.now() - startedAt,
      errors: [],
    };
  },
});

const registry = new AgentOSRegistry();
registry.registerCapability({
  id: "sentiment",
  name: "Sentiment",
  description: "Local text sentiment analysis.",
  category: CapabilityCategory.Research,
  supportedConnectors: [],
});
registry.registerTool(sentimentTool);

const task = createTask({
  input: "Members love the new onboarding flow.",
  source: {
    type: "example",
    name: "custom-tool",
  },
});

const agent: Agent = {
  id: "custom-tool-agent",
  name: "Custom Tool Agent",
  description: "Demonstrates developer-authored local tools.",
  version: "0.1.0",
  capabilities: [{ name: "sentiment" }],
  tools: [sentimentTool],
  memoryPolicy: {
    enabled: false,
    scopes: [MemoryScope.Task],
    readableTypes: [MemoryType.Summary],
    writableTypes: [MemoryType.Summary],
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

async function main() {
  const result = await sentimentTool.execute(
    {
      text: String(task.input),
    },
    context
  );

  console.log("\n=== Custom Tool ===");
  console.log(`Tool: ${sentimentTool.name}`);
  console.log(`Capability: ${sentimentTool.capability}`);
  console.log(`Version: ${sentimentTool.version}`);
  console.log(`Registered tools: ${registry.summary().tools}`);
  console.log(`Inspection signature: ${sentimentTool.inspect().executionSignature}`);
  console.log(`Summary: ${JSON.stringify(sentimentTool.summary())}`);
  console.log(`Output: ${JSON.stringify(result.output)}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
