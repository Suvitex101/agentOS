import { describe, expect, it } from "vitest";
import {
  AgentOSRegistry,
  ModelAssistedPlanner,
  ModelProviderCapability,
  ModelProviderResolver,
  RuleBasedPlanner,
  defineModelProvider,
  type ModelProvider,
} from "@agentosdev/sdk";
import { createExecutionContext, createTestAgent, createTestTask } from "../helpers/test-helpers";

function createProvider(
  input: {
    id?: string;
    capabilities?: string[];
    text?: string;
    repairText?: string;
    throwError?: boolean;
  } = {}
): ModelProvider {
  let calls = 0;

  return defineModelProvider({
    id: input.id ?? "structured-provider",
    name: "Structured Provider",
    version: "1.0.0",
    capabilities: input.capabilities ?? [
      ModelProviderCapability.TextGeneration,
      ModelProviderCapability.Reasoning,
      ModelProviderCapability.StructuredOutput,
    ],
    generate() {
      calls += 1;

      if (input.throwError) {
        throw new Error("provider failed");
      }

      if (calls > 1 && input.repairText !== undefined) {
        return {
          text: input.repairText,
          model: "deterministic-test-model",
          finishReason: "stop",
          durationMs: 4,
        };
      }

      return {
        text:
          input.text ??
          JSON.stringify({
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
        model: "deterministic-test-model",
        finishReason: "stop",
        durationMs: 4,
        metadata: {
          calls,
        },
      };
    },
  });
}

function createPlanner(provider: ModelProvider, options = {}) {
  const registry = new AgentOSRegistry();

  registry.registerModelProvider(provider);

  return new ModelAssistedPlanner({
    providerResolver: new ModelProviderResolver({ registry }),
    fallbackPlanner: new RuleBasedPlanner(),
    options,
  });
}

describe("ModelAssistedPlanner", () => {
  it("creates a structured plan from a provider resolved by capability", async () => {
    const agentDefinition = createTestAgent();
    const task = createTestTask("Summarize the top complaints");
    const planner = createPlanner(createProvider());
    const plan = await planner.plan(
      agentDefinition,
      task,
      createExecutionContext(agentDefinition, task)
    );

    expect(plan.id).toBe("plan-test-task-model");
    expect(plan.taskId).toBe("test-task");
    expect(plan.steps).toHaveLength(3);
    expect(plan.steps[0]).toMatchObject({
      id: "plan-test-task-model-step-1",
      order: 1,
      description: "Gather relevant information",
    });
    expect(plan.createdAt).toBeInstanceOf(Date);
    expect(plan.metadata).toMatchObject({
      schemaVersion: "v1",
      plannerName: "ModelAssistedPlanner",
      plannerStrategy: "hybrid",
      providerId: "structured-provider",
      providerName: "Structured Provider",
      providerModel: "deterministic-test-model",
      providerDurationMs: 4,
      finishReason: "stop",
      fallbackUsed: false,
      repairAttempted: false,
      repairSucceeded: false,
      promptVersion: "v1",
      providerCapabilityPath: "structured-output",
      responseParsingStatus: "parsed",
    });
    expect(plan.metadata?.rawProviderResponse).toBeUndefined();
    expect(plan.metadata?.debugPrompt).toBeUndefined();
  });

  it("resolves a specific provider id", async () => {
    const agentDefinition = createTestAgent();
    const task = createTestTask("Plan research");
    const planner = createPlanner(createProvider({ id: "preferred-provider" }));
    const plan = await planner.plan(
      agentDefinition,
      task,
      createExecutionContext(agentDefinition, task),
      {
        provider: {
          providerId: "preferred-provider",
        },
      }
    );

    expect(plan.metadata?.providerId).toBe("preferred-provider");
  });

  it("can expose the generated prompt only in debug mode", async () => {
    const agentDefinition = createTestAgent();
    const task = createTestTask("Plan with prompt debug");
    const planner = createPlanner(createProvider());
    const plan = await planner.plan(
      agentDefinition,
      task,
      createExecutionContext(agentDefinition, task),
      {
        debugPrompt: true,
      }
    );

    expect(plan.metadata?.debugPrompt).toContain("Return JSON only");
    expect(plan.metadata?.promptSize).toEqual(expect.any(Number));
  });

  it("resolves the default provider when allowed", async () => {
    const agentDefinition = createTestAgent();
    const task = createTestTask("Plan research");
    const registry = new AgentOSRegistry();
    const provider = createProvider({ id: "default-provider" });

    registry.registerModelProvider(provider);
    registry.setDefaultModelProvider("default-provider");

    const planner = new ModelAssistedPlanner({
      providerResolver: new ModelProviderResolver({ registry }),
      fallbackPlanner: new RuleBasedPlanner(),
      options: {
        provider: {
          preferredCapabilities: [],
        },
      },
    });
    const plan = await planner.plan(
      agentDefinition,
      task,
      createExecutionContext(agentDefinition, task)
    );

    expect(plan.metadata?.providerId).toBe("default-provider");
  });

  it("rejects providers without required text-generation capability in fail mode", async () => {
    const agentDefinition = createTestAgent();
    const task = createTestTask("Plan research");
    const planner = createPlanner(
      createProvider({
        id: "no-text",
        capabilities: [ModelProviderCapability.Reasoning],
      }),
      {
        fallback: "fail",
      }
    );

    await expect(
      planner.plan(agentDefinition, task, createExecutionContext(agentDefinition, task), {
        provider: {
          providerId: "no-text",
        },
      })
    ).rejects.toMatchObject({
      code: "model_planner_provider_capability_mismatch",
    });
  });

  it("returns a typed error when a requested provider id is missing", async () => {
    const agentDefinition = createTestAgent();
    const task = createTestTask("Plan research");
    const planner = createPlanner(createProvider(), {
      fallback: "fail",
    });

    await expect(
      planner.plan(agentDefinition, task, createExecutionContext(agentDefinition, task), {
        provider: {
          providerId: "missing-provider",
        },
      })
    ).rejects.toMatchObject({
      code: "model_planner_provider_not_found",
    });
  });

  it("validates model-assisted planner numeric options", async () => {
    const agentDefinition = createTestAgent();
    const task = createTestTask("Plan research");
    const planner = createPlanner(createProvider(), {
      fallback: "fail",
    });

    await expect(
      planner.plan(agentDefinition, task, createExecutionContext(agentDefinition, task), {
        temperature: 3,
      })
    ).rejects.toMatchObject({
      code: "model_planner_invalid_options",
    });
  });

  it("uses rule-based fallback for invalid JSON", async () => {
    const agentDefinition = createTestAgent();
    const task = createTestTask("Summarize complaints");
    const planner = createPlanner(
      createProvider({
        text: "not json",
      })
    );
    const plan = await planner.plan(
      agentDefinition,
      task,
      createExecutionContext(agentDefinition, task)
    );

    expect(plan.metadata?.fallbackUsed).toBe(true);
    expect(plan.metadata?.fallbackReason).toBe("model_planner_repair_failed");
    expect(plan.metadata?.ruleMatched).toBe("analysis");
  });

  it("fails for invalid JSON when fallback is disabled", async () => {
    const agentDefinition = createTestAgent();
    const task = createTestTask("Summarize complaints");
    const planner = createPlanner(
      createProvider({
        text: "not json",
      }),
      {
        fallback: "fail",
      }
    );

    await expect(
      planner.plan(agentDefinition, task, createExecutionContext(agentDefinition, task))
    ).rejects.toMatchObject({
      code: "model_planner_repair_failed",
    });
  });

  it("repairs an invalid provider response once", async () => {
    const agentDefinition = createTestAgent();
    const task = createTestTask("Plan research");
    const planner = createPlanner(
      createProvider({
        text: "not json",
        repairText: JSON.stringify({
          steps: [
            {
              description: "Gather repaired information",
              type: "research",
              requiredCapability: "research",
            },
          ],
        }),
      }),
      {
        fallback: "fail",
      }
    );
    const plan = await planner.plan(
      agentDefinition,
      task,
      createExecutionContext(agentDefinition, task)
    );

    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]?.description).toBe("Gather repaired information");
    expect(plan.metadata).toMatchObject({
      repairAttempted: true,
      repairSucceeded: true,
    });
  });

  it("does not repair recursively", async () => {
    const agentDefinition = createTestAgent();
    const task = createTestTask("Plan research");
    const planner = createPlanner(
      createProvider({
        text: "not json",
        repairText: "still not json",
      }),
      {
        fallback: "fail",
      }
    );

    await expect(
      planner.plan(agentDefinition, task, createExecutionContext(agentDefinition, task))
    ).rejects.toMatchObject({
      code: "model_planner_repair_failed",
    });
  });

  it("rejects missing steps, empty steps, and excessive steps", async () => {
    const agentDefinition = createTestAgent();
    const task = createTestTask("Plan");
    const cases = [
      ["missing", {}, "model_planner_missing_steps"],
      ["empty", { steps: [] }, "model_planner_empty_steps"],
      [
        "excessive",
        {
          steps: Array.from({ length: 3 }, (_, index) => ({
            description: `Step ${index + 1}`,
          })),
        },
        "model_planner_excessive_step_count",
      ],
    ] as const;

    for (const [_name, payload, code] of cases) {
      const planner = createPlanner(
        createProvider({
          text: JSON.stringify(payload),
        }),
        {
          fallback: "fail",
          maxSteps: 2,
        }
      );

      await expect(
        planner.plan(agentDefinition, task, createExecutionContext(agentDefinition, task))
      ).rejects.toMatchObject({
        code: "model_planner_repair_failed",
        metadata: {
          originalError: {
            code,
          },
        },
      });
    }
  });

  it("rejects privileged provider-generated fields", async () => {
    const agentDefinition = createTestAgent();
    const task = createTestTask("Plan");
    const planner = createPlanner(
      createProvider({
        text: JSON.stringify({
          steps: [
            {
              id: "provider-step-id",
              description: "Do something",
            },
          ],
        }),
      }),
      {
        fallback: "fail",
      }
    );

    await expect(
      planner.plan(agentDefinition, task, createExecutionContext(agentDefinition, task))
    ).rejects.toMatchObject({
      code: "model_planner_repair_failed",
      metadata: {
        originalError: {
          code: "model_planner_privileged_fields",
        },
      },
    });
  });

  it("falls back when provider generation fails", async () => {
    const agentDefinition = createTestAgent();
    const task = createTestTask("Send a message");
    const planner = createPlanner(
      createProvider({
        throwError: true,
      })
    );
    const plan = await planner.plan(
      agentDefinition,
      task,
      createExecutionContext(agentDefinition, task)
    );

    expect(plan.metadata?.fallbackUsed).toBe(true);
    expect(plan.metadata?.fallbackReason).toBe("model_planner_generation_failed");
    expect(plan.metadata?.ruleMatched).toBe("message");
  });

  it("replans with previous plan metadata", async () => {
    const agentDefinition = createTestAgent();
    const task = createTestTask("Summarize complaints");
    const planner = createPlanner(createProvider());
    const context = createExecutionContext(agentDefinition, task);
    const firstPlan = await planner.plan(agentDefinition, task, context);
    const secondPlan = await planner.replan(agentDefinition, task, context, firstPlan);

    expect(secondPlan.id).toContain("model-replan");
    expect(secondPlan.metadata?.previousPlanId).toBe(firstPlan.id);
  });

  it("keeps RuleBasedPlanner working independently", () => {
    const agentDefinition = createTestAgent();
    const task = createTestTask("Create a payment invoice");
    const planner = new RuleBasedPlanner();
    const plan = planner.plan(agentDefinition, task, createExecutionContext(agentDefinition, task));

    expect(plan.metadata?.ruleMatched).toBe("payment");
    expect(plan.steps).toHaveLength(3);
  });
});
