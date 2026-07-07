import { describe, expect, it } from "vitest";
import {
  AgentOSRegistry,
  LocalCommunityConnector,
  MemoryScope,
  MemoryType,
  ToolResolver,
  createTask,
  type Agent,
  type ExecutionContext,
} from "@agentos/sdk";

describe("connector bundle integration", () => {
  it("resolves and executes a bundled community tool", async () => {
    const registry = new AgentOSRegistry();
    const registration = registry.registerConnectorBundle(LocalCommunityConnector);

    expect(registration.success).toBe(true);

    const resolver = new ToolResolver({ registry });
    const resolution = resolver.resolve({
      capability: "community",
      toolId: "tool-summarize-messages",
    });

    expect(resolution.success).toBe(true);
    expect(resolution.tool?.connectorId).toBe(LocalCommunityConnector.id);

    const task = createTask({
      input: "Summarize the top complaints in our community.",
    });
    const agent: Agent = {
      id: "bundle-test-agent",
      name: "Bundle Test Agent",
      description: "Tests connector bundle tool execution.",
      version: "0.1.0",
      capabilities: [{ name: "community" }],
      tools: registry.listTools(),
      memoryPolicy: {
        enabled: false,
        scopes: [MemoryScope.Task],
        readableTypes: [MemoryType.Summary],
        writableTypes: [MemoryType.Summary],
      },
      permissions: [],
    };
    const context: ExecutionContext = {
      agent,
      task,
      memory: [],
      resources: registry.listResources(),
      variables: {},
      environment: {},
    };

    const result = await resolution.tool!.execute(
      {
        taskInput: task.input,
      },
      context
    );

    expect(result.success).toBe(true);
    expect(result.output).toMatchObject({
      findings: ["Top themes identified", "Suggested next action drafted"],
    });
  });
});
