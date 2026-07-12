import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AgentOSRegistry,
  MemoryScope,
  MemoryType,
  ToolResolver,
  createFilesystemConnector,
  createTask,
  type Agent,
  type ExecutionContext,
  type WriteFileOutput,
} from "@agentosdev/sdk";

describe("FilesystemConnector integration", () => {
  let workspaceRoot: string;

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(path.join(tmpdir(), "agentos-fs-integration-"));
  });

  afterEach(async () => {
    await rm(workspaceRoot, {
      recursive: true,
      force: true,
    });
  });

  it("registers as a bundle and executes through the registry tool path", async () => {
    const registry = new AgentOSRegistry();
    const connector = createFilesystemConnector({
      workspaceRoot,
    });
    const registration = registry.registerConnectorBundle(connector);

    expect(registration.success).toBe(true);
    expect(registry.summary()).toMatchObject({
      capabilities: 2,
      connectors: 1,
      tools: 4,
      resources: 1,
    });

    const resolver = new ToolResolver({ registry });
    const resolution = resolver.resolve({
      toolId: "tool-filesystem-write-file",
      capability: "storage",
    });

    expect(resolution.success).toBe(true);
    expect(resolution.tool?.connectorId).toBe("filesystem");

    const task = createTask({
      input: "write filesystem file",
    });
    const agent: Agent = {
      id: "filesystem-integration-agent",
      name: "Filesystem Integration Agent",
      description: "Runs filesystem connector integration tests.",
      version: "0.1.0",
      capabilities: [{ name: "storage" }],
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
        path: "integration/result.txt",
        content: "filesystem integration",
      },
      context
    );

    expect(result.success).toBe(true);
    expect((result.output as WriteFileOutput).path).toBe("integration/result.txt");
    expect(result.errors).toEqual([]);
  });
});
