import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AgentOSRegistry,
  ConnectorPermission,
  ConnectorRiskLevel,
  ConnectorTrustLevel,
  MemoryScope,
  MemoryType,
  createFilesystemConnector,
  createTask,
  type Agent,
  type ExecutionContext,
  type ListFilesOutput,
  type ReadFileOutput,
  type SearchFilesOutput,
} from "@agentosdev/sdk";

describe("FilesystemConnector", () => {
  let workspaceRoot: string;
  let registry: AgentOSRegistry;
  let context: ExecutionContext;

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(path.join(tmpdir(), "agentos-fs-test-"));
    registry = new AgentOSRegistry();
    const connector = createFilesystemConnector({
      workspaceRoot,
    });
    const registration = registry.registerConnectorBundle(connector);

    if (!registration.success) {
      throw new Error(registration.error?.message ?? "Failed to register connector.");
    }

    const agent: Agent = {
      id: "filesystem-test-agent",
      name: "Filesystem Test Agent",
      description: "Tests filesystem connector tools.",
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

    context = {
      agent,
      task: createTask({
        input: "filesystem test",
      }),
      memory: [],
      resources: registry.listResources(),
      variables: {},
      environment: {},
    };
  });

  afterEach(async () => {
    await rm(workspaceRoot, {
      recursive: true,
      force: true,
    });
  });

  it("creates a connector bundle with storage and search capabilities", () => {
    expect(registry.findConnectorById("filesystem")?.name).toBe("Filesystem Connector");
    expect(registry.findCapabilityById("storage")).toBeDefined();
    expect(registry.findCapabilityById("search")).toBeDefined();
    expect(registry.listTools()).toHaveLength(4);
    expect(registry.listResources()).toHaveLength(1);
  });

  it("declares a filesystem-specific connector security profile", () => {
    const connector = registry.findConnectorById("filesystem");

    expect(connector?.security).toMatchObject({
      riskLevel: ConnectorRiskLevel.Medium,
      trustLevel: ConnectorTrustLevel.Local,
      permissions: [ConnectorPermission.ReadFiles, ConnectorPermission.WriteFiles],
      requiresUserApproval: false,
      networkAccess: false,
      filesystemAccess: true,
      secretsAccess: false,
    });
  });

  it("writes, reads, lists, and searches files inside the workspace", async () => {
    const write = await getTool("tool-filesystem-write-file").execute(
      {
        path: "notes/agentos.md",
        content: "AgentOS can search local workspace files.",
      },
      context
    );
    const read = await getTool("tool-filesystem-read-file").execute(
      {
        path: "notes/agentos.md",
      },
      context
    );
    const list = await getTool("tool-filesystem-list-files").execute(
      {
        directory: ".",
        recursive: true,
      },
      context
    );
    const search = await getTool("tool-filesystem-search-files").execute(
      {
        query: "workspace",
        directory: ".",
        extension: "md",
      },
      context
    );

    expect(write.success).toBe(true);
    expect(read.success).toBe(true);
    expect((read.output as ReadFileOutput).content).toContain("AgentOS");
    expect((list.output as ListFilesOutput).entries.map((entry) => entry.path)).toContain(
      "notes/agentos.md"
    );
    expect((search.output as SearchFilesOutput).matches).toHaveLength(1);
  });

  it("prevents overwrite unless explicitly allowed", async () => {
    const tool = getTool("tool-filesystem-write-file");

    expect(
      (
        await tool.execute(
          {
            path: "existing.txt",
            content: "first",
          },
          context
        )
      ).success
    ).toBe(true);

    const blocked = await tool.execute(
      {
        path: "existing.txt",
        content: "second",
      },
      context
    );
    const overwritten = await tool.execute(
      {
        path: "existing.txt",
        content: "second",
        overwrite: true,
      },
      context
    );

    expect(blocked.success).toBe(false);
    expect(blocked.errors[0]?.code).toBe("filesystem_file_exists");
    expect(overwritten.success).toBe(true);
  });

  it("prevents traversal outside the workspace", async () => {
    const result = await getTool("tool-filesystem-read-file").execute(
      {
        path: "../outside.txt",
      },
      context
    );

    expect(result.success).toBe(false);
    expect(result.errors[0]?.code).toBe("filesystem_path_escape");
  });

  it("prevents absolute path access", async () => {
    const result = await getTool("tool-filesystem-read-file").execute(
      {
        path: path.join(workspaceRoot, "inside.txt"),
      },
      context
    );

    expect(result.success).toBe(false);
    expect(result.errors[0]?.code).toBe("filesystem_absolute_path_denied");
  });

  it("searches text files only and skips non-text extensions", async () => {
    await writeFile(path.join(workspaceRoot, "notes.txt"), "hello searchable text", "utf8");
    await writeFile(path.join(workspaceRoot, "binary.bin"), "hello searchable text", "utf8");

    const result = await getTool("tool-filesystem-search-files").execute(
      {
        query: "searchable",
        directory: ".",
      },
      context
    );

    expect(result.success).toBe(true);
    expect((result.output as SearchFilesOutput).matches).toHaveLength(1);
    expect((result.output as SearchFilesOutput).skippedFiles).toBe(1);
  });

  function getTool(toolId: string) {
    const tool = registry.findToolById(toolId);

    if (!tool) {
      throw new Error(`Expected tool "${toolId}" to be registered.`);
    }

    return tool;
  }
});
