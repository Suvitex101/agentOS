import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { publishablePackages } from "./release-packages.mjs";

const root = process.cwd();
const packDirectory = path.join(root, ".release", "pack");
const consumerDirectory = path.join(tmpdir(), `agentos-package-consumer-${Date.now()}`);

run("pnpm", ["build", "--force"], root);
run("node", ["scripts/validate-package-boundaries.mjs", "--check-dist"], root);
run("node", ["scripts/pack-packages.mjs"], root);

const tarballManifest = JSON.parse(readFileSync(path.join(packDirectory, "tarballs.json"), "utf8"));

for (const pkg of publishablePackages) {
  if (!tarballManifest.tarballs.some((item) => item.name === pkg.name)) {
    throw new Error(`Missing tarball for ${pkg.name}.`);
  }
}

rmSync(consumerDirectory, { recursive: true, force: true });
mkdirSync(consumerDirectory, { recursive: true });
writeFileSync(
  path.join(consumerDirectory, "package.json"),
  JSON.stringify(
    {
      name: "agentos-external-consumer-test",
      version: "0.0.0",
      private: true,
      type: "module",
      dependencies: Object.fromEntries(
        tarballManifest.tarballs.map((tarball) => [tarball.name, `file:${tarball.path}`])
      ),
    },
    null,
    2
  )
);
writeFileSync(
  path.join(consumerDirectory, "index.mjs"),
  `
import {
  AgentOSRegistry,
  InMemoryMemoryStore,
  ResultStatus,
  RuleBasedPlanner,
  SimpleExecutionEngine,
  createAgentOSRegistryBootstrapExample,
  defineAgent
} from "@agentosdev/sdk";

const registry = createAgentOSRegistryBootstrapExample();
const agent = defineAgent({
  id: "external-consumer-agent",
  name: "External Consumer Agent",
  description: "Verifies @agentosdev/sdk outside the monorepo.",
  planner: new RuleBasedPlanner(),
  executionEngine: new SimpleExecutionEngine(),
  registry,
  memoryStore: new InMemoryMemoryStore(),
});

const emptyRegistry = new AgentOSRegistry();
if (emptyRegistry.summary().tools !== 0) {
  throw new Error("AgentOSRegistry import did not behave as expected.");
}

const result = await agent.run("Summarize public alpha packaging readiness.");

if (result.status !== ResultStatus.Completed) {
  throw new Error(\`Expected completed result, got \${result.status}.\`);
}

if (!result.toolCalls.length) {
  throw new Error("Expected at least one tool call from the bootstrap registry.");
}

console.log("External package consumer test passed.");
`
);

run(
  "npm",
  ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--offline"],
  consumerDirectory
);
run("node", ["index.mjs"], consumerDirectory);

console.log(`Verified external consumer project at ${consumerDirectory}.`);

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    env: {
      ...process.env,
      npm_config_cache: path.join(consumerDirectory, ".npm-cache"),
    },
    encoding: "utf8",
    stdio: "pipe",
  });

  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed.`);
  }
}
