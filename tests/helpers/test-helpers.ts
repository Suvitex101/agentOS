import {
  AgentOSRegistry,
  InMemoryMemoryStore,
  RuleBasedPlanner,
  SimpleExecutionEngine,
  ToolResolver,
  createAgentOSRegistryBootstrapExample,
  createTask,
  defineAgent,
  defineTool,
  type AgentDefinition,
  type CreateTaskInput,
  type Task,
} from "@agentos/sdk";

export function createTestRegistry(): AgentOSRegistry {
  return createAgentOSRegistryBootstrapExample();
}

export function createTestMemory(): InMemoryMemoryStore {
  return new InMemoryMemoryStore();
}

export function createTestPlanner(): RuleBasedPlanner {
  return new RuleBasedPlanner();
}

export function createTestExecutionEngine(): SimpleExecutionEngine {
  return new SimpleExecutionEngine();
}

export function createTestTask(input: string | Partial<CreateTaskInput> = "Summarize AgentOS") {
  return createTask({
    id: "test-task",
    input: typeof input === "string" ? input : (input.input ?? "Summarize AgentOS"),
    source: {
      type: "test",
      name: "vitest",
    },
    ...(typeof input === "string" ? {} : input),
  });
}

export function createTestAgent(input: Partial<Parameters<typeof defineAgent>[0]> = {}) {
  return defineAgent({
    id: "test-agent",
    name: "Test Agent",
    description: "AgentOS test agent.",
    planner: createTestPlanner(),
    executionEngine: createTestExecutionEngine(),
    registry: createTestRegistry(),
    memoryStore: createTestMemory(),
    ...input,
  });
}

export function createTestResolver(registry = createTestRegistry()): ToolResolver {
  return new ToolResolver({ registry });
}

export function createFailingTool() {
  return defineTool({
    id: "tool-failing-test",
    name: "Failing Test Tool",
    description: "Always returns a failed tool result.",
    capability: "general",
    capabilityIds: ["general"],
    execute() {
      return {
        success: false,
        durationMs: 1,
        errors: [
          {
            code: "test_tool_failed",
            message: "Test tool failed.",
            recoverable: true,
          },
        ],
      };
    },
  });
}

export function createExecutionContext(agent: AgentDefinition, task: Task) {
  return {
    agent: {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      version: agent.version,
      capabilities: [...agent.capabilities],
      tools: [],
      memoryPolicy: {
        enabled: true,
        scopes: [],
        readableTypes: [],
        writableTypes: [],
      },
      permissions: [...agent.permissions],
    },
    task,
    memory: [],
    resources: agent.registry.listResources(),
    variables: {},
    environment: {},
  };
}
