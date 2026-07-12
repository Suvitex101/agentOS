import { describe, expect, it } from "vitest";
import {
  AgentOSRegistry,
  ExecutionEventType,
  ModelAssistedPlanner,
  ModelProviderCapability,
  ModelProviderResolver,
  ResultStatus,
  SimpleExecutionEngine,
  ToolResolver,
  createTask,
  defineModelProvider,
  type Agent,
  type ExecutionContext,
} from "@agentosdev/sdk";
import { createTestRegistry } from "../helpers/test-helpers";

describe("ModelAssistedPlanner integration", () => {
  it("plans through a local provider and executes the validated plan", async () => {
    const registry = createTestRegistry();
    const providerRegistry = new AgentOSRegistry();
    const provider = defineModelProvider({
      id: "integration-provider",
      name: "Integration Provider",
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
          model: "integration-model",
        };
      },
    });

    providerRegistry.registerModelProvider(provider);

    const planner = new ModelAssistedPlanner({
      providerResolver: new ModelProviderResolver({ registry: providerRegistry }),
      options: {
        fallback: "fail",
      },
    });
    const engine = new SimpleExecutionEngine();
    const task = createTask({
      id: "integration-model-task",
      input: "Summarize the top community complaints",
      source: {
        type: "test",
      },
    });
    const agent: Agent = {
      id: "integration-agent",
      name: "Integration Agent",
      description: "Runs model-assisted planner integration.",
      version: "0.1.0",
      capabilities: [{ name: "research" }, { name: "analytics" }, { name: "communication" }],
      tools: registry.listTools(),
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
      resources: registry.listResources(),
      variables: {},
      environment: {},
    };
    const plan = await planner.plan(agent, task, context);
    const result = await engine.executePlan(agent, task, plan, context, {
      toolResolver: new ToolResolver({ registry }),
    });

    expect(plan.metadata?.providerId).toBe("integration-provider");
    expect(result.status).toBe(ResultStatus.Completed);
    expect(result.plan?.steps).toHaveLength(3);
    expect(result.toolCalls).toHaveLength(3);
    expect(result.trace.map((entry) => entry.event)).toContain(ExecutionEventType.ToolResolved);
  });
});
