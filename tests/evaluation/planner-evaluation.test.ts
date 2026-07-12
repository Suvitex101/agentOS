import { describe, expect, it } from "vitest";
import {
  AgentOSRegistry,
  ModelAssistedPlanner,
  ModelProviderResolver,
  RuleBasedPlanner,
  createTask,
  defineModelProvider,
  type Agent,
  type ExecutionContext,
  type ModelProvider,
} from "@agentosdev/sdk";
import { plannerEvaluationFixtures } from "./fixtures/planner-fixtures";

describe("planner evaluation fixtures", () => {
  it.each(plannerEvaluationFixtures)(
    "evaluates $id deterministically",
    async ({
      id,
      task: taskInput,
      agentCapabilities,
      providerCapabilities,
      providerResponse,
      repairResponse,
      maxSteps,
      expected,
    }) => {
      const provider = createEvaluationProvider({
        id: `${id}-provider`,
        capabilities: providerCapabilities,
        response: providerResponse,
        repairResponse,
      });
      const registry = new AgentOSRegistry();

      registry.registerModelProvider(provider);

      const planner = new ModelAssistedPlanner({
        providerResolver: new ModelProviderResolver({ registry }),
        fallbackPlanner: new RuleBasedPlanner(),
        options: {
          fallback: "rule-based",
          maxSteps,
        },
      });
      const task = createTask({
        id: `${id}-task`,
        input: taskInput,
        source: {
          type: "evaluation",
          name: id,
        },
      });
      const agent: Agent = {
        id: `${id}-agent`,
        name: `${id} Agent`,
        description: "Deterministic planner evaluation agent.",
        version: "0.1.0-alpha.1",
        capabilities: agentCapabilities,
        tools: [
          {
            id: "filesystem-read-file",
            name: "Filesystem Read File",
            description: "Evaluation fixture tool reference.",
            capability: "storage",
            inputSchema: {},
            outputSchema: {},
            permissionLevel: "read",
            category: "storage",
            execute() {
              return {
                success: true,
                durationMs: 0,
                errors: [],
              };
            },
          },
          {
            id: "filesystem-write-file",
            name: "Filesystem Write File",
            description: "Evaluation fixture tool reference.",
            capability: "storage",
            inputSchema: {},
            outputSchema: {},
            permissionLevel: "write",
            category: "storage",
            execute() {
              return {
                success: true,
                durationMs: 0,
                errors: [],
              };
            },
          },
        ],
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
      const validation = await planner.validatePlan(plan);
      const [minimumSteps, maximumSteps] = expected.stepCountRange;

      expect(validation.valid).toBe(expected.validationPassed);
      expect(plan.metadata?.fallbackUsed).toBe(expected.fallbackUsed);
      expect(plan.metadata?.repairAttempted).toBe(expected.repairAttempted);
      expect(plan.steps.length).toBeGreaterThanOrEqual(minimumSteps);
      expect(plan.steps.length).toBeLessThanOrEqual(maximumSteps);
      expect(plan.steps.every((step) => !("registryMutation" in step))).toBe(true);
      expect(plan.steps.every((step) => !("memoryMutation" in step))).toBe(true);

      if (expected.fallbackUsed) {
        expect(plan.metadata?.fallbackReason).toBeTruthy();
      } else {
        expect(plan.metadata?.schemaVersion).toBe("v1");
        expect(plan.metadata?.providerCapabilityPath).toBe(expected.providerCapabilityPath);
      }

      if (expected.requiredCapability) {
        expect(
          plan.steps.some(
            (step) => step.metadata?.requiredCapability === expected.requiredCapability
          )
        ).toBe(true);
      }
    }
  );
});

function createEvaluationProvider(input: {
  id: string;
  capabilities: string[];
  response: unknown;
  repairResponse?: unknown;
}): ModelProvider {
  let calls = 0;

  return defineModelProvider({
    id: input.id,
    name: `Evaluation Provider ${input.id}`,
    version: "1.0.0",
    capabilities: input.capabilities,
    generate() {
      calls += 1;

      return {
        text: serializeProviderResponse(
          calls > 1 && input.repairResponse !== undefined ? input.repairResponse : input.response
        ),
        model: "evaluation-model",
        finishReason: "stop",
        durationMs: 1,
      };
    },
  });
}

function serializeProviderResponse(response: unknown): string {
  return typeof response === "string" ? response : JSON.stringify(response);
}
