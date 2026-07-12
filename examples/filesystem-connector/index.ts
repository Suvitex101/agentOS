import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  AgentOSRegistry,
  MemoryScope,
  MemoryType,
  createFilesystemConnector,
  type Agent,
  type ExecutionContext,
  type RegisteredTool,
} from "@agentosdev/sdk";

async function main() {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "agentos-filesystem-"));

  try {
    const filesystemConnector = createFilesystemConnector({
      workspaceRoot,
    });
    const registry = new AgentOSRegistry();
    const registration = registry.registerConnectorBundle(filesystemConnector);

    if (!registration.success) {
      throw new Error(registration.error?.message ?? "Failed to register filesystem connector.");
    }

    const agent: Agent = {
      id: "filesystem-example-agent",
      name: "Filesystem Example Agent",
      description: "Demonstrates safe local filesystem connector tools.",
      version: "0.1.0",
      capabilities: [{ name: "storage" }, { name: "search" }],
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
      task: {
        id: "task-filesystem-example",
        input: "Demonstrate filesystem connector",
        status: "pending",
        priority: "normal",
        source: {
          type: "example",
          name: "filesystem-connector",
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      memory: [],
      resources: registry.listResources(),
      variables: {},
      environment: {},
    };

    const writeTool = getTool(registry, "tool-filesystem-write-file");
    const listTool = getTool(registry, "tool-filesystem-list-files");
    const readTool = getTool(registry, "tool-filesystem-read-file");
    const searchTool = getTool(registry, "tool-filesystem-search-files");

    const write = await writeTool.execute(
      {
        path: "notes/agentos.md",
        content: "AgentOS filesystem connector safely reads and writes local workspace files.",
      },
      context
    );
    const list = await listTool.execute(
      {
        directory: ".",
        recursive: true,
      },
      context
    );
    const read = await readTool.execute(
      {
        path: "notes/agentos.md",
      },
      context
    );
    const search = await searchTool.execute(
      {
        query: "filesystem connector",
        directory: ".",
        extension: "md",
      },
      context
    );
    const unsafe = await readTool.execute(
      {
        path: "../outside.txt",
      },
      context
    );

    console.log("\n=== Filesystem Connector ===");
    console.log(`Workspace: ${workspaceRoot}`);
    console.log(`Registered capabilities: ${registry.listCapabilities().length}`);
    console.log(`Registered tools: ${registry.listTools().length}`);
    console.log(`Write success: ${write.success}`);
    console.log(`List output: ${JSON.stringify(list.output)}`);
    console.log(`Read output: ${JSON.stringify(read.output)}`);
    console.log(`Search output: ${JSON.stringify(search.output)}`);
    console.log(`Unsafe path success: ${unsafe.success}`);
    console.log(`Unsafe path error: ${unsafe.errors[0]?.code}`);
  } finally {
    await rm(workspaceRoot, {
      recursive: true,
      force: true,
    });
  }
}

function getTool(registry: AgentOSRegistry, toolId: string): RegisteredTool {
  const tool = registry.findToolById(toolId);

  if (!tool) {
    throw new Error(`Expected tool "${toolId}" to be registered.`);
  }

  return tool;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
