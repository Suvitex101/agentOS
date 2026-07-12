import {
  AgentOSRegistry,
  InMemoryMemoryStore,
  MemoryScope,
  MemoryType,
  ModelAssistedPlanner,
  ModelProviderCapability,
  ModelProviderResolver,
  SimpleExecutionEngine,
  ToolResolver,
  createFilesystemConnector,
  createOllamaProvider,
  createTask,
  type Agent,
  type ExecutionContext,
  type HTTPModelProviderFetch,
} from "@agentosdev/sdk";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const liveMode = process.argv.includes("--live");
const providerModel = process.env.OLLAMA_MODEL ?? "agentos-demo-local";

const deterministicFetch: HTTPModelProviderFetch = async (input) => {
  const url = String(input);

  if (url.endsWith("/api/tags")) {
    return jsonResponse({
      models: [{ name: "agentos-demo-local" }],
    });
  }

  if (url.endsWith("/api/version")) {
    return jsonResponse({
      version: "mocked",
    });
  }

  return jsonResponse({
    model: "agentos-demo-local",
    response: JSON.stringify({
      steps: [
        {
          description: "Read README.md from the local workspace",
          type: "tool",
          requiredTool: "tool-ollama-demo-filesystem-read-file",
          requiredCapability: "storage",
          input: {
            path: "README.md",
          },
        },
        {
          description: "Write SUMMARY.md to the local workspace",
          type: "tool",
          requiredTool: "tool-ollama-demo-filesystem-write-file",
          requiredCapability: "storage",
          input: {
            path: "SUMMARY.md",
            content: "AgentOS is a task-centric infrastructure layer for intelligent work.",
            overwrite: true,
          },
        },
      ],
    }),
    done: true,
    done_reason: "stop",
    prompt_eval_count: 48,
    eval_count: 64,
  });
};

async function main() {
  const workspaceRoot = join(tmpdir(), "agentos-ollama-provider-example");
  await mkdir(workspaceRoot, { recursive: true });
  await writeFile(
    join(workspaceRoot, "README.md"),
    "AgentOS is a task-centric infrastructure layer for intelligent work.",
    "utf8"
  );

  const registry = new AgentOSRegistry();
  const filesystem = createFilesystemConnector({
    id: "ollama-demo-filesystem",
    workspaceRoot,
  });
  const provider = createOllamaProvider({
    id: "ollama-demo",
    name: liveMode ? "Ollama Local Provider" : "Mocked Ollama Provider",
    model: providerModel,
    fetchImplementation: liveMode ? undefined : deterministicFetch,
  });

  if (liveMode) {
    const health = await provider.health();

    if (!health.reachable) {
      console.log(
        "Ollama smoke skipped because Ollama is not reachable at http://localhost:11434."
      );
      return;
    }

    if (!health.modelAvailable) {
      console.log(`Ollama smoke skipped because model "${providerModel}" is not available.`);
      return;
    }
  }

  const connectorRegistration = registry.registerConnectorBundle(filesystem);
  const providerRegistration = registry.registerModelProvider(provider);

  if (!connectorRegistration.success) {
    throw new Error(
      connectorRegistration.error?.message ?? "Failed to register filesystem connector."
    );
  }

  if (!providerRegistration.success) {
    throw new Error(providerRegistration.error?.message ?? "Failed to register Ollama provider.");
  }

  registry.setDefaultModelProvider(provider.id);

  const planner = new ModelAssistedPlanner({
    providerResolver: new ModelProviderResolver({ registry }),
    options: {
      fallback: "fail",
      provider: {
        requiredCapabilities: [ModelProviderCapability.TextGeneration],
        preferredCapabilities: [ModelProviderCapability.Reasoning],
      },
    },
  });
  const engine = new SimpleExecutionEngine();
  const memory = new InMemoryMemoryStore();
  const task = createTask({
    input: "Summarize README.md into SUMMARY.md",
    source: {
      type: "example",
      name: "ollama-provider",
    },
  });
  const agent: Agent = {
    id: "ollama-local-agent",
    name: "Ollama Local Agent",
    description: "Demonstrates local model planning through Ollama.",
    version: "0.1.0",
    capabilities: [{ name: "storage" }, { name: "search" }],
    tools: registry.listTools(),
    memoryPolicy: {
      enabled: true,
      scopes: [MemoryScope.Agent],
      readableTypes: [MemoryType.Summary],
      writableTypes: [MemoryType.Summary],
    },
    permissions: [],
  };
  const context: ExecutionContext = {
    agent,
    task,
    memory: await memory.list({
      type: MemoryScope.Agent,
      id: agent.id,
    }),
    resources: registry.listResources(),
    variables: {},
    environment: {},
  };
  const plan = await planner.plan(agent, task, context);
  const result = await engine.executePlan(agent, task, plan, context, {
    toolResolver: new ToolResolver({ registry }),
  });

  console.log("\n=== Ollama Provider ===");
  console.log(`Mode: ${liveMode ? "live" : "deterministic"}`);
  console.log(`Provider: ${provider.id}`);
  console.log(`Model: ${String(provider.inspect().metadata?.model ?? providerModel)}`);
  console.log(`Plan steps: ${plan.steps.length}`);
  console.log(`Result status: ${result.status}`);
  console.log(`Tool calls: ${result.toolCalls.length}`);
  console.log(`Workspace: ${workspaceRoot}`);
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
