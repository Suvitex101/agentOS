import {
  AgentOSRegistry,
  MemoryScope,
  MemoryType,
  ResourceType,
  ToolResolver,
  createTask,
  defineResearchConnector,
  defineResearchTool,
  type Agent,
  type ExecutionContext,
} from "@agentos/sdk";

const grantPlanTool = defineResearchTool<{ text: string }, { plan: string; priorities: string[] }>({
  id: "tool-grant-research-plan",
  name: "Grant Research Plan",
  description: "Creates a local mocked research plan for a grant opportunity.",
  version: "1.0.0",
  tags: ["grant", "research", "local"],
  execute({ input }) {
    const startedAt = Date.now();

    return {
      success: true,
      output: {
        plan: `Review eligibility, impact goals, and required evidence for: ${input.text}`,
        priorities: ["Eligibility", "Community impact", "Evidence checklist"],
      },
      metadata: {
        mocked: true,
      },
      durationMs: Date.now() - startedAt,
      errors: [],
    };
  },
});

const researchConnector = defineResearchConnector({
  id: "local-research",
  name: "Local Research Connector",
  description: "Local connector for grant and research workflows.",
  version: "1.0.0",
  tools: [grantPlanTool],
  resources: [
    {
      id: "resource-local-grant-note",
      type: ResourceType.Document,
      source: "local-research",
      uri: "local://research/grant-note",
      metadata: {
        title: "Grant note",
      },
    },
  ],
  tags: ["research", "grant", "local"],
  health() {
    return {
      healthy: true,
      metadata: {
        mode: "local",
      },
    };
  },
});

const registry = new AgentOSRegistry();

for (const capability of researchConnector.capabilities.capabilities) {
  registry.registerCapability(capability);
}

registry.registerConnector(researchConnector);
registry.registerTool({
  ...grantPlanTool,
  connectorId: researchConnector.id,
});

for (const resource of researchConnector.resources) {
  registry.registerResource(resource);
}

const task = createTask({
  input: "Analyze this grant opportunity and produce a short research plan.",
  source: {
    type: "example",
    name: "research-connector",
  },
});

const agent: Agent = {
  id: "research-connector-agent",
  name: "Research Connector Agent",
  description: "Demonstrates a developer-authored local connector.",
  version: "0.1.0",
  capabilities: [{ name: "research" }],
  tools: [grantPlanTool],
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
  const resolver = new ToolResolver({ registry });
  const resolution = resolver.resolve({
    capability: "research",
    toolId: "tool-grant-research-plan",
    task,
  });

  if (!resolution.tool) {
    throw new Error("Expected research tool to resolve.");
  }

  const result = await resolution.tool.execute(
    {
      text: String(task.input),
    },
    context
  );

  console.log("\n=== Research Connector ===");
  console.log(`Connector: ${researchConnector.name}`);
  console.log(`Health: ${researchConnector.inspect().health.status}`);
  console.log(`Capabilities: ${researchConnector.summary().capabilities.join(", ")}`);
  console.log(`Registered tools: ${registry.summary().tools}`);
  console.log(`Resolved tool: ${resolution.tool.name}`);
  console.log(`Tool output: ${JSON.stringify(result.output)}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
