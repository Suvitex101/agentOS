import { describe, expect, it } from "vitest";
import { AgentOSRegistry, ToolResolver } from "@agentosdev/sdk";
import { createTestRegistry } from "../helpers/test-helpers";

describe("ToolResolver", () => {
  it("resolves by capability", () => {
    const resolver = new ToolResolver({ registry: createTestRegistry() });
    const result = resolver.resolve({ capability: "payments" });

    expect(result.success).toBe(true);
    expect(result.tool?.id).toBe("tool-create-invoice");
  });

  it("resolves by explicit tool id", () => {
    const resolver = new ToolResolver({ registry: createTestRegistry() });
    const result = resolver.resolve({ toolId: "tool-analyze-text" });

    expect(result.success).toBe(true);
    expect(result.tool?.name).toBe("AnalyzeTextTool");
  });

  it("returns a typed error for missing tools", () => {
    const resolver = new ToolResolver({ registry: new AgentOSRegistry() });
    const result = resolver.resolve({ toolId: "missing-tool", capability: "missing" });

    expect(result.success).toBe(false);
    expect(result.errors[0]?.code).toBe("tool_not_found");
  });
});
