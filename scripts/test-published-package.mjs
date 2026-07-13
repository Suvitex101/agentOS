import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const sdkPackageName = "@agentosdev/sdk";
const sdkInstallSpecifier = `${sdkPackageName}@alpha`;
const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "agentos-published-smoke-"));

try {
  writeFileSync(
    path.join(temporaryDirectory, "package.json"),
    JSON.stringify(
      {
        name: "agentos-published-smoke-test",
        version: "0.0.0",
        private: true,
        type: "module",
      },
      null,
      2
    )
  );

  run("npm", ["install", "--no-audit", "--no-fund", sdkInstallSpecifier], temporaryDirectory);

  writeFileSync(
    path.join(temporaryDirectory, "index.mjs"),
    `
import {
  InMemoryMemoryStore,
  ResultStatus,
  RuleBasedPlanner,
  SimpleExecutionEngine,
  createAgentOSRegistryBootstrapExample,
  defineAgent,
} from "${sdkPackageName}";

const registry = createAgentOSRegistryBootstrapExample();
const agent = defineAgent({
  id: "published-smoke-agent",
  name: "Published Smoke Agent",
  description: "Verifies the live AgentOS SDK package from npm.",
  planner: new RuleBasedPlanner(),
  executionEngine: new SimpleExecutionEngine(),
  registry,
  memoryStore: new InMemoryMemoryStore(),
});

const result = await agent.run("Summarize AgentOS alpha package readiness.");

if (result.status !== ResultStatus.Completed) {
  throw new Error(\`Expected completed result, received \${result.status}.\`);
}

if (!result.toolCalls.length) {
  throw new Error("Expected at least one tool call from the bootstrap registry.");
}

console.log("Published AgentOS package smoke test passed.");
console.log(result.answer);
`
  );

  run("node", ["index.mjs"], temporaryDirectory);
  console.log(`Verified ${sdkInstallSpecifier} in a clean temporary project.`);
} catch (error) {
  console.error("");
  console.error("Published package smoke test failed.");
  console.error(
    "This test requires npm registry access and the published @agentosdev/sdk alpha package."
  );
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
  });

  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}.`);
  }
}
