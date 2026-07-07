import { describe, expect, it } from "vitest";
import { CapabilityCategory } from "@agentos/sdk";
import { createTestRegistry } from "../helpers/test-helpers";

describe("AgentOSRegistry", () => {
  it("registers and discovers capabilities, tools, connectors, and resources", () => {
    const registry = createTestRegistry();

    expect(registry.summary()).toMatchObject({
      capabilities: 7,
      connectors: 1,
      tools: 5,
      resources: 1,
    });
    expect(registry.findCapabilityById("messaging")?.name).toBe("Messaging");
    expect(registry.findToolsByCapability("messaging").length).toBeGreaterThan(0);
    expect(registry.findConnectorsByCapability("messaging")).toHaveLength(1);
    expect(registry.findCapabilitiesByCategory(CapabilityCategory.Messaging)).toHaveLength(1);
  });

  it("prevents duplicate ids", () => {
    const registry = createTestRegistry();
    const capability = registry.findCapabilityById("messaging");

    expect(capability).toBeDefined();
    const result = registry.registerCapability(capability!);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("registry_duplicate_id");
  });
});
