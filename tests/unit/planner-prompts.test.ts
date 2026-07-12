import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLANNING_SYSTEM_PROMPT,
  ModelProviderCapability,
  PlanSchemaVersion,
  PlanStepType,
  PlannerPromptVersion,
  REPAIR_SYSTEM_PROMPT,
  buildPlanningPrompt,
  buildRepairPrompt,
  defineModelProvider,
} from "@agentosdev/sdk";
import { createTestAgent, createTestTask } from "../helpers/test-helpers";

function createProvider(capabilities: string[]) {
  return defineModelProvider({
    id: "prompt-provider",
    name: "Prompt Provider",
    version: "1.0.0",
    capabilities,
    generate() {
      return {
        text: JSON.stringify({ steps: [{ description: "Plan" }] }),
      };
    },
  });
}

describe("planner prompts", () => {
  it("builds a versioned standard planning prompt", () => {
    const result = buildPlanningPrompt({
      agent: createTestAgent(),
      task: createTestTask("Summarize README.md"),
      provider: createProvider([ModelProviderCapability.TextGeneration]),
      maxSteps: 4,
    });

    expect(result.metadata).toMatchObject({
      promptVersion: PlannerPromptVersion.V1,
      schemaVersion: PlanSchemaVersion.V1,
      providerCapabilityPath: "standard",
    });
    expect(result.prompt).toContain("Return JSON only");
    expect(result.prompt).toContain("No Markdown");
    expect(result.prompt).toContain("No code fences");
    expect(result.prompt).toContain("minimalValidJsonExample");
    expect(result.prompt).toContain(PlanStepType.Reason);
    expect(result.systemPrompt).toBe(DEFAULT_PLANNING_SYSTEM_PROMPT);
  });

  it("uses the structured-output path when the provider declares it", () => {
    const result = buildPlanningPrompt({
      agent: createTestAgent(),
      task: createTestTask("Create a plan"),
      provider: createProvider([
        ModelProviderCapability.TextGeneration,
        ModelProviderCapability.StructuredOutput,
      ]),
      maxSteps: 3,
    });

    expect(result.metadata.providerCapabilityPath).toBe("structured-output");
    expect(result.prompt).toContain("strict JSON");
  });

  it("keeps prompt context focused", () => {
    const agent = {
      ...createTestAgent(),
      tools: [
        {
          id: "tool-read",
          name: "Read Tool",
          description: "Reads files",
          capability: "storage",
          capabilityIds: ["storage"],
          inputSchema: {},
          outputSchema: {},
          category: "data",
          permissionLevel: "read",
          execute() {
            return {
              success: true,
              durationMs: 0,
              errors: [],
            };
          },
        },
      ],
    };
    const result = buildPlanningPrompt({
      agent,
      task: createTestTask("Read README.md"),
      provider: createProvider([ModelProviderCapability.TextGeneration]),
      maxSteps: 2,
    });

    expect(result.prompt).toContain("tool-read");
    expect(result.prompt).not.toContain("MODEL_API_KEY");
    expect(result.metadata.includedToolCount).toBe(1);
  });

  it("builds a versioned repair prompt", () => {
    const result = buildRepairPrompt({
      task: createTestTask("Repair plan"),
      provider: createProvider([ModelProviderCapability.TextGeneration]),
      originalResponse: "not-json",
      issues: [
        {
          code: "model_planner_invalid_json",
          message: "Invalid JSON",
          severity: "error",
          path: "$",
        },
      ],
      maxSteps: 2,
    });

    expect(result.systemPrompt).toBe(REPAIR_SYSTEM_PROMPT);
    expect(result.metadata.promptVersion).toBe(PlannerPromptVersion.V1);
    expect(result.prompt).toContain("Return corrected JSON only");
    expect(result.prompt).toContain("No Markdown");
    expect(result.prompt).toContain("validationIssues");
  });
});
