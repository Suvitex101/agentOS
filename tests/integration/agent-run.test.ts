import { describe, expect, it } from "vitest";
import {
  ExecutionEventType,
  MemoryScope,
  PlanStatus,
  PlanStepStatus,
  PlanStepType,
  PlannerStrategyType,
  ResultStatus,
  defineTool,
  type Agent,
  type ExecutionContext,
  type Plan,
  type Planner,
  type Task,
} from "@agentosdev/sdk";
import {
  createFailingTool,
  createTestAgent,
  createTestMemory,
  createTestRegistry,
} from "../helpers/test-helpers";

describe("Agent.run integration", () => {
  it("runs task -> planner -> registry -> resolver -> tool -> execution -> result", async () => {
    const agent = createTestAgent();
    const result = await agent.run("Summarize the top community complaints");

    expect(result.status).toBe(ResultStatus.Completed);
    expect(result.plan?.steps).toHaveLength(3);
    expect(result.toolCalls).toHaveLength(3);
    expect(result.trace.map((entry) => entry.event)).toContain(ExecutionEventType.ToolResolved);
    expect(result.metadata?.memoryWriteAttempted).toBe(true);
  });

  it("writes memory and reads relevant scoped memory on the next run", async () => {
    const memory = createTestMemory();
    const agent = createTestAgent({ memoryStore: memory });

    await agent.run("Summarize AgentOS Africa infrastructure");
    const second = await agent.run("Summarize AgentOS Africa infrastructure");

    expect(second.metadata?.memoryReadCount).toBe(1);
    expect(await memory.list({ type: MemoryScope.Agent, id: agent.id })).toHaveLength(2);
  });

  it("does not read or write memory when disabled", async () => {
    const memory = createTestMemory();
    const agent = createTestAgent({ memoryStore: memory });
    const result = await agent.run("Summarize AgentOS", { memory: false });

    expect(result.status).toBe(ResultStatus.Completed);
    expect(result.metadata?.memoryReadCount).toBe(0);
    expect(result.metadata?.memoryWriteAttempted).toBe(false);
    expect(await memory.list()).toHaveLength(0);
  });

  it("returns a failed result when a resolved tool fails", async () => {
    const registry = createTestRegistry();
    registry.registerTool(createFailingTool());
    const agent = createTestAgent({
      registry,
      planner: createStaticPlanner({
        requiredTool: "tool-failing-test",
      }),
    });

    const result = await agent.run("Use the failing tool");

    expect(result.status).toBe(ResultStatus.Failed);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.success).toBe(false);
    expect(result.errors[0]?.code).toBe("test_tool_failed");
  });

  it("returns a failed result when planning throws", async () => {
    const agent = createTestAgent({
      planner: createThrowingPlanner(),
    });

    const result = await agent.run("Planning should fail");

    expect(result.status).toBe(ResultStatus.Failed);
    expect(result.errors[0]?.code).toBe("agent_planning_failed");
    expect(result.toolCalls).toHaveLength(0);
  });

  it("returns a failed result when the planner returns an invalid plan", async () => {
    const agent = createTestAgent({
      planner: createInvalidPlanner(),
    });

    const result = await agent.run("Invalid plan");

    expect(result.status).toBe(ResultStatus.Failed);
    expect(result.errors[0]?.code).toBe("plan_missing_steps");
    expect(result.toolCalls).toHaveLength(0);
  });

  it("can execute a custom registered tool", async () => {
    const registry = createTestRegistry();
    const customTool = defineTool({
      id: "tool-custom-test",
      name: "Custom Test Tool",
      description: "Custom test execution.",
      capability: "general",
      capabilityIds: ["general"],
      execute() {
        return {
          success: true,
          output: "custom-output",
          durationMs: 1,
          errors: [],
        };
      },
    });
    registry.registerTool(customTool);
    const agent = createTestAgent({
      registry,
      planner: createStaticPlanner({
        requiredTool: "tool-custom-test",
      }),
    });

    const result = await agent.run("Use a custom tool");

    expect(result.status).toBe(ResultStatus.Completed);
    expect(result.toolCalls[0]?.toolId).toBe("tool-custom-test");
    expect(result.toolCalls[0]?.output).toBe("custom-output");
  });
});

function createStaticPlanner(input: { requiredTool: string }): Planner {
  return {
    id: "static-planner",
    name: "StaticPlanner",
    strategy: {
      id: "static",
      name: "Static",
      type: PlannerStrategyType.Custom,
    },
    plan(_agent: Agent, task: Task): Plan {
      const createdAt = new Date();

      return {
        id: `plan-${task.id}`,
        taskId: task.id,
        status: PlanStatus.Ready,
        createdAt,
        updatedAt: createdAt,
        steps: [
          {
            id: `plan-${task.id}-step-1`,
            order: 1,
            type: PlanStepType.UseTool,
            description: "Use required test tool",
            requiredTool: input.requiredTool,
            status: PlanStepStatus.Pending,
          },
        ],
      };
    },
    replan(agent: Agent, task: Task, _context: ExecutionContext, previousPlan: Plan) {
      return {
        ...this.plan(agent, task, _context),
        metadata: {
          previousPlanId: previousPlan.id,
        },
      };
    },
    validatePlan(plan: Plan) {
      return {
        valid: plan.steps.length > 0,
        errors:
          plan.steps.length > 0
            ? []
            : [{ code: "plan_missing_steps", message: "Plan must include steps." }],
        warnings: [],
      };
    },
    estimateComplexity() {
      return {
        score: 1,
        level: "low",
      };
    },
  };
}

function createThrowingPlanner(): Planner {
  return {
    ...createStaticPlanner({ requiredTool: "tool-echo" }),
    plan() {
      throw new Error("Planning failed in test.");
    },
  };
}

function createInvalidPlanner(): Planner {
  return {
    ...createStaticPlanner({ requiredTool: "tool-echo" }),
    plan(_agent: Agent, task: Task): Plan {
      const createdAt = new Date();

      return {
        id: `plan-${task.id}`,
        taskId: task.id,
        status: PlanStatus.Ready,
        createdAt,
        updatedAt: createdAt,
        steps: [],
      };
    },
    validatePlan() {
      return {
        valid: false,
        errors: [{ code: "plan_missing_steps", message: "Plan must include steps." }],
        warnings: [],
      };
    },
  };
}
