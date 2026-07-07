import { describe, expect, it } from "vitest";
import { MemoryScope, MemoryType } from "@agentos/sdk";
import { createTestMemory } from "../helpers/test-helpers";

describe("InMemoryMemoryStore", () => {
  it("writes, reads, searches, deletes, and filters by scope", async () => {
    const memory = createTestMemory();
    const projectScope = { type: MemoryScope.Project, id: "agentos" };
    const otherScope = { type: MemoryScope.Agent, id: "agent" };

    const write = await memory.write({
      id: "memory-1",
      content: "AgentOS supports local tools for Africa developers.",
      type: MemoryType.Fact,
      scope: projectScope,
    });
    await memory.write({
      id: "memory-2",
      content: "Other memory",
      type: MemoryType.Summary,
      scope: otherScope,
    });

    expect(write.success).toBe(true);
    expect(await memory.read("memory-1")).toMatchObject({ id: "memory-1" });
    expect(await memory.search({ query: "Africa developers", scope: projectScope })).toHaveLength(
      1
    );
    expect(await memory.list(projectScope)).toHaveLength(1);
    expect(await memory.delete("memory-1")).toMatchObject({ success: true });
    expect(await memory.read("memory-1")).toBeUndefined();
  });
});
