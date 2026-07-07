import { describe, expect, it } from "vitest";
import {
  createExecutionContext,
  createTestAgent,
  createTestPlanner,
  createTestTask,
} from "../helpers/test-helpers";

describe("RuleBasedPlanner", () => {
  const cases = [
    ["analysis", "Summarize the top community complaints", "analysis"],
    ["messaging", "Send a message to the community", "message"],
    ["payment", "Create a payment invoice", "payment"],
    ["default", "Help me prepare for tomorrow", "default"],
  ] as const;

  it.each(cases)("creates a %s plan", (_name, input, ruleMatched) => {
    const agent = createTestAgent();
    const task = createTestTask(input);
    const planner = createTestPlanner();
    const plan = planner.plan(
      {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        version: agent.version,
        capabilities: [],
        tools: [],
        memoryPolicy: {
          enabled: false,
          scopes: [],
          readableTypes: [],
          writableTypes: [],
        },
        permissions: [],
      },
      task,
      createExecutionContext(agent, task)
    );

    expect(plan.steps).toHaveLength(3);
    expect(plan.metadata?.ruleMatched).toBe(ruleMatched);
  });
});
