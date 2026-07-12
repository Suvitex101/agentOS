import { describe, expect, it } from "vitest";
import {
  PlanSchemaVersion,
  PlanStatus,
  PlanStepStatus,
  PlanStepType,
  PlanValidator,
  type Plan,
} from "@agentosdev/sdk";

function createValidPlan(overrides: Partial<Plan> = {}): Plan {
  const now = new Date();

  return {
    id: "plan-test",
    taskId: "task-test",
    status: PlanStatus.Ready,
    createdAt: now,
    updatedAt: now,
    steps: [
      {
        id: "plan-test-step-1",
        order: 1,
        type: PlanStepType.UseTool,
        description: "Read the file",
        requiredTool: "tool-filesystem-read-file",
        status: PlanStepStatus.Pending,
        input: {
          path: "README.md",
        },
        metadata: {
          requiredCapability: "storage",
        },
      },
    ],
    metadata: {
      schemaVersion: PlanSchemaVersion.V1,
    },
    ...overrides,
  };
}

describe("PlanValidator", () => {
  it("accepts a valid v1 plan", () => {
    const validation = new PlanValidator().validate(createValidPlan());

    expect(validation.valid).toBe(true);
    expect(validation.issues?.filter((issue) => issue.severity === "error")).toHaveLength(0);
    expect(validation.metadata).toMatchObject({
      schemaVersion: PlanSchemaVersion.V1,
      stepCount: 1,
    });
  });

  it("collects structural issues together", () => {
    const plan = createValidPlan({
      taskId: "",
      steps: [
        {
          id: "duplicate",
          order: 2,
          type: "bad-type" as PlanStepType,
          description: "",
          status: PlanStepStatus.Pending,
        },
        {
          id: "duplicate",
          order: 2,
          type: PlanStepType.Reason,
          description: "Second step",
          status: PlanStepStatus.Pending,
        },
      ],
    });
    const validation = new PlanValidator().validate(plan);

    expect(validation.valid).toBe(false);
    expect(validation.issues?.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "plan_missing_task_id",
        "plan_step_order_invalid",
        "plan_step_missing_description",
        "plan_step_type_invalid",
        "plan_step_duplicate_id",
      ])
    );
  });

  it("rejects empty and excessive step lists", () => {
    const empty = new PlanValidator().validate(createValidPlan({ steps: [] }));
    const excessive = new PlanValidator({ maxSteps: 1 }).validate(
      createValidPlan({
        steps: [
          createValidPlan().steps[0]!,
          {
            ...createValidPlan().steps[0]!,
            id: "plan-test-step-2",
            order: 2,
          },
        ],
      })
    );

    expect(empty.errors.map((error) => error.code)).toContain("plan_steps_empty");
    expect(excessive.errors.map((error) => error.code)).toContain("plan_steps_excessive");
  });

  it("rejects dangerous keys and forbidden fields", () => {
    const validation = new PlanValidator().validate(
      createValidPlan({
        steps: [
          {
            ...createValidPlan().steps[0]!,
            input: {
              constructor: {
                prototype: {
                  polluted: true,
                },
              },
              registryMutation: true,
            },
            metadata: {
              executionId: "provider-execution-id",
            },
          },
        ],
      })
    );

    expect(validation.valid).toBe(false);
    expect(validation.issues?.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "plan_dangerous_key",
        "plan_forbidden_field",
        "plan_metadata_forbidden_field",
      ])
    );
  });

  it("rejects non-object inputs and oversize metadata", () => {
    const validation = new PlanValidator({ maxMetadataBytes: 20 }).validate(
      createValidPlan({
        steps: [
          {
            ...createValidPlan().steps[0]!,
            input: "README.md",
            metadata: {
              requiredCapability: "storage",
              large: "x".repeat(100),
            },
          },
        ],
      })
    );

    expect(validation.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining(["plan_step_input_invalid", "plan_metadata_too_large"])
    );
  });

  it("rejects unsupported schema versions and oversized plans", () => {
    const validation = new PlanValidator({ maxPlanBytes: 100 }).validate(
      createValidPlan({
        metadata: {
          schemaVersion: "v999",
        },
        steps: [
          {
            ...createValidPlan().steps[0]!,
            description: "x".repeat(200),
          },
        ],
      })
    );

    expect(validation.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining(["plan_schema_version_unsupported", "plan_too_large"])
    );
  });
});
