import { describe, expect, it } from "vitest";
import {
  AgentDefinitionValidationError,
  defineAgent,
  validateAgentDefinitionConfig,
} from "@agentos/sdk";
import {
  createTestAgent,
  createTestExecutionEngine,
  createTestMemory,
  createTestPlanner,
  createTestRegistry,
} from "../helpers/test-helpers";

describe("defineAgent", () => {
  it("validates required composition dependencies", () => {
    const validation = validateAgentDefinitionConfig({});

    expect(validation.valid).toBe(false);
    expect(validation.errors.map((error) => error.code)).toEqual([
      "agent_missing_id",
      "agent_missing_name",
      "agent_missing_planner",
      "agent_missing_execution_engine",
      "agent_missing_registry",
      "agent_missing_memory_store",
    ]);
  });

  it("throws typed validation errors", () => {
    expect(() =>
      defineAgent({
        id: "",
        name: "",
        description: "Broken agent",
        planner: createTestPlanner(),
        executionEngine: createTestExecutionEngine(),
        registry: createTestRegistry(),
        memoryStore: createTestMemory(),
      })
    ).toThrow(AgentDefinitionValidationError);
  });

  it("creates an immutable composed agent", () => {
    const agent = createTestAgent({
      capabilities: [{ name: "research" }],
    });

    expect(Object.isFrozen(agent)).toBe(true);
    expect(agent.planner.name).toBe("RuleBasedPlanner");
    expect(agent.executionEngine.name).toBe("SimpleExecutionEngine");
  });

  it("exposes inspect and summary output", () => {
    const agent = createTestAgent();

    expect(agent.inspect()).toMatchObject({
      id: "test-agent",
      planner: {
        name: "RuleBasedPlanner",
      },
      executionEngine: {
        name: "SimpleExecutionEngine",
      },
    });
    expect(agent.summary()).toMatchObject({
      id: "test-agent",
      name: "Test Agent",
    });
  });
});
