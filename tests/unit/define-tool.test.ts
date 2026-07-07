import { describe, expect, it } from "vitest";
import {
  ToolCategory,
  ToolDefinitionValidationError,
  ToolVisibility,
  defineMessagingTool,
  defineTool,
  validateToolDefinitionConfig,
} from "@agentos/sdk";

describe("defineTool", () => {
  it("validates required fields and semantic version format", () => {
    const validation = validateToolDefinitionConfig({
      id: "",
      name: "",
      capability: "",
      version: "1",
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors.map((error) => error.code)).toEqual([
      "tool_missing_id",
      "tool_missing_name",
      "tool_missing_capability",
      "tool_missing_execute",
      "tool_invalid_version",
    ]);
  });

  it("throws typed validation errors", () => {
    expect(() =>
      defineTool({
        id: "broken",
        name: "",
        description: "Broken tool",
        capability: "general",
        execute: undefined as never,
      })
    ).toThrow(ToolDefinitionValidationError);
  });

  it("creates an immutable tool definition", () => {
    const tool = defineTool({
      id: "tool-test",
      name: "Test Tool",
      description: "A test tool.",
      capability: "general",
      version: "1.0.0",
      tags: ["test"],
      visibility: ToolVisibility.Public,
      execute() {
        return {
          success: true,
          output: "ok",
          durationMs: 0,
          errors: [],
        };
      },
    });

    expect(Object.isFrozen(tool)).toBe(true);
    expect(() => {
      (tool as { name: string }).name = "Changed";
    }).toThrow();
  });

  it("exposes inspect and summary output", () => {
    const tool = defineMessagingTool({
      id: "tool-summary",
      name: "Summary Tool",
      description: "Summarizes messages.",
      version: "1.2.3",
      tags: ["summary"],
      execute() {
        return {
          success: true,
          output: "summary",
          durationMs: 1,
          errors: [],
        };
      },
    });

    expect(tool.inspect()).toMatchObject({
      id: "tool-summary",
      capability: "messaging",
      category: ToolCategory.Communication,
      executionSignature: "execute(context)",
    });
    expect(tool.summary()).toMatchObject({
      id: "tool-summary",
      version: "1.2.3",
      tags: ["summary"],
    });
  });
});
