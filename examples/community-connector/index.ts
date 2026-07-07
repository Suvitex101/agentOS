import {
  AgentOSRegistry,
  LocalCommunityConnector,
  MemoryScope,
  MemoryType,
  ToolResolver,
  createTask,
  type Agent,
  type ExecutionContext,
} from "@agentos/sdk";

const registry = new AgentOSRegistry();
const registration = registry.registerConnectorBundle(LocalCommunityConnector);

if (!registration.success) {
  throw new Error(registration.error?.message ?? "Failed to register connector bundle.");
}

const task = createTask({
  input: "Summarize community complaints and recommend next actions.",
  source: {
    type: "example",
    name: "community-connector",
  },
});

const agent: Agent = {
  id: "community-connector-agent",
  name: "Community Connector Agent",
  description: "Demonstrates connector bundle registration and local tool execution.",
  version: "0.1.0",
  capabilities: [{ name: "community" }],
  tools: registry.listTools(),
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
  resources: registry.listResources(),
  variables: {},
  environment: {},
};

async function main() {
  const connector = registry.findConnectorBundle(LocalCommunityConnector.id)?.connector;
  const resolver = new ToolResolver({ registry });
  const resolution = resolver.resolve({
    capability: "community",
    toolId: "tool-summarize-messages",
    task,
  });

  if (!connector) {
    throw new Error("Expected LocalCommunityConnector to be registered.");
  }

  if (!resolution.tool) {
    throw new Error("Expected bundled community tool to resolve.");
  }

  const result = await resolution.tool.execute(
    {
      taskInput: task.input,
      messages: [
        "The onboarding channel is hard to follow.",
        "Members want clearer event reminders.",
      ],
    },
    context
  );

  const summaryBeforeRemoval = registry.summary();
  const removal = registry.unregisterConnectorBundle(LocalCommunityConnector.id);

  if (!removal.success) {
    throw new Error(removal.error?.message ?? "Failed to unregister connector bundle.");
  }

  console.log("\n=== Community Connector Bundle ===");
  console.log(`Connector: ${connector.name}`);
  console.log(`Capabilities before removal: ${summaryBeforeRemoval.capabilities}`);
  console.log(`Tools before removal: ${summaryBeforeRemoval.tools}`);
  console.log(`Resources before removal: ${summaryBeforeRemoval.resources}`);
  console.log(`Resolved tool: ${resolution.tool.name}`);
  console.log(`Tool output: ${JSON.stringify(result.output)}`);
  console.log(`Connectors after removal: ${registry.summary().connectors}`);
  console.log(`Tools after removal: ${registry.summary().tools}`);
  console.log(`Resources after removal: ${registry.summary().resources}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
