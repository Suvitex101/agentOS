import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("runnable examples", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it.each([
    ["basic", "../../examples/basic-agent/index.ts"],
    ["community", "../../examples/community-manager/index.ts"],
    ["business", "../../examples/business-assistant/index.ts"],
    ["research", "../../examples/research-assistant/index.ts"],
    ["memory", "../../examples/memory-demo/index.ts"],
    ["custom-tool", "../../examples/custom-tool/index.ts"],
    ["research-connector", "../../examples/research-connector/index.ts"],
    ["community-connector", "../../examples/community-connector/index.ts"],
    ["filesystem-connector", "../../examples/filesystem-connector/index.ts"],
    ["http-connector", "../../examples/http-connector/index.ts"],
    ["model-provider", "../../examples/model-provider/index.ts"],
    ["provider-registry", "../../examples/provider-registry/index.ts"],
    ["model-assisted-planner", "../../examples/model-assisted-planner/index.ts"],
  ])("runs the %s example", async (_name, path) => {
    await expect(import(path)).resolves.toBeDefined();
    expect(process.exitCode).toBeUndefined();
  });
});
