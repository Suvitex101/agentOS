import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  AgentOSRegistry,
  CredentialResolver,
  CredentialType,
  HTTPModelProviderBase,
  InMemoryMemoryStore,
  ModelAssistedPlanner,
  ModelProviderCapability,
  ModelProviderResolver,
  SimpleExecutionEngine,
  createFilesystemConnector,
  createOpenAICompatibleProvider,
  defineAgent,
  type HTTPModelProviderFetch,
} from "@agentosdev/sdk";

const LIVE_FLAG = "--live";
const TASK = "Summarize README.md into SUMMARY.md";

async function main() {
  const liveMode = process.argv.includes(LIVE_FLAG);
  const liveConfig = readLiveConfig();

  if (liveMode && !liveConfig.valid) {
    console.log(`Live example skipped because ${liveConfig.reason}`);
    return;
  }

  const workspaceRoot = await createWorkspace();
  const registry = new AgentOSRegistry();
  const filesystemConnector = createFilesystemConnector({
    id: "live-filesystem",
    name: "Live Model Filesystem Connector",
    workspaceRoot,
  });

  registry.registerConnectorBundle(filesystemConnector);

  const provider = liveMode
    ? createLiveProvider(liveConfig.config!)
    : createDeterministicProvider();

  registry.registerModelProvider(provider);
  registry.setDefaultModelProvider(provider.id);

  const providerResolver = new ModelProviderResolver({
    registry,
  });
  const planner = new ModelAssistedPlanner({
    providerResolver,
    options: {
      fallback: "fail",
      provider: {
        requiredCapabilities: [ModelProviderCapability.TextGeneration],
        preferredCapabilities: [
          ModelProviderCapability.Reasoning,
          ModelProviderCapability.StructuredOutput,
        ],
      },
      systemPrompt: buildSystemPrompt(),
    },
  });
  const agent = defineAgent({
    id: "live-model-agent",
    name: "Live Model Agent",
    description: "Demonstrates model-assisted planning with filesystem execution.",
    planner,
    executionEngine: new SimpleExecutionEngine(),
    registry,
    memoryStore: new InMemoryMemoryStore(),
  });
  const result = await agent.run(TASK, {
    metadata: {
      mode: liveMode ? "live" : "deterministic",
      workspaceRoot,
    },
  });
  const summaryPath = path.join(workspaceRoot, "SUMMARY.md");
  const summary = await readOptionalFile(summaryPath);

  console.log("\n=== Live Model Agent Workflow ===");
  console.log(`Mode: ${liveMode ? "live" : "deterministic"}`);
  console.log(`Workspace: ${workspaceRoot}`);
  console.log(`Provider: ${provider.id}`);
  console.log(`Task: ${TASK}`);
  console.log(`Status: ${result.status}`);
  console.log(`Tool calls: ${result.toolCalls.length}`);
  console.log(`Trace events: ${result.trace.length}`);
  console.log(`Memory read count: ${String(result.metadata?.memoryReadCount ?? 0)}`);
  console.log(`Memory write attempted: ${String(result.metadata?.memoryWriteAttempted ?? false)}`);
  console.log(`SUMMARY.md created: ${summary !== undefined}`);

  if (summary) {
    console.log("\n--- SUMMARY.md ---");
    console.log(summary.trim());
  }
}

function createLiveProvider(config: LiveModelConfig) {
  return createOpenAICompatibleProvider({
    id: "live-openai-compatible",
    name: "Live OpenAI-Compatible Provider",
    model: config.modelName,
    transport: new HTTPModelProviderBase({
      baseUrl: config.baseUrl,
      credential: {
        type: CredentialType.Environment,
        name: "MODEL_API_KEY",
      },
      credentialResolver: new CredentialResolver(),
      timeoutMs: 30000,
      maxResponseBytes: 1024 * 1024,
    }),
  });
}

function createDeterministicProvider() {
  let capturedAuthorization = false;
  const deterministicFetch: HTTPModelProviderFetch = async (_input, init) => {
    const headers = init?.headers as Record<string, string> | undefined;
    capturedAuthorization = headers?.authorization === "Bearer deterministic-token";

    return new Response(
      JSON.stringify({
        id: "chatcmpl-deterministic-live-model-agent",
        model: "deterministic-workflow-model",
        choices: [
          {
            message: {
              content: JSON.stringify({
                steps: [
                  {
                    description: "Read README.md from the configured workspace.",
                    type: "tool",
                    requiredTool: "tool-live-filesystem-read-file",
                    requiredCapability: "storage",
                    input: {
                      path: "README.md",
                    },
                  },
                  {
                    description: "Write SUMMARY.md into the configured workspace.",
                    type: "tool",
                    requiredTool: "tool-live-filesystem-write-file",
                    requiredCapability: "storage",
                    input: {
                      path: "SUMMARY.md",
                      content:
                        "# Summary\n\nAgentOS is a task-centric infrastructure layer for building agents that can plan, use tools, remember context, and operate across real workflows.",
                      overwrite: true,
                    },
                  },
                ],
              }),
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 64,
          completion_tokens: 96,
          total_tokens: 160,
        },
        metadata: {
          capturedAuthorization,
        },
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }
    );
  };

  return createOpenAICompatibleProvider({
    id: "deterministic-openai-compatible",
    name: "Deterministic OpenAI-Compatible Provider",
    model: "deterministic-workflow-model",
    transport: new HTTPModelProviderBase({
      baseUrl: "https://deterministic.example.test",
      credential: {
        type: CredentialType.Static,
        value: "deterministic-token",
      },
      credentialResolver: new CredentialResolver(),
      fetchImplementation: deterministicFetch,
    }),
  });
}

function buildSystemPrompt(): string {
  return [
    "You are a planning component inside AgentOS.",
    "Return only JSON with a steps array.",
    "The task is to summarize README.md into SUMMARY.md.",
    "Use exactly these filesystem tool ids when relevant:",
    '- tool-live-filesystem-read-file with input {"path":"README.md"}',
    '- tool-live-filesystem-write-file with input {"path":"SUMMARY.md","content":"...","overwrite":true}',
    "Do not include secrets. Do not call external APIs. Do not return markdown outside JSON.",
  ].join("\n");
}

interface LiveModelConfig {
  baseUrl: string;
  modelName: string;
}

type LiveConfigResult =
  | {
      valid: true;
      config: LiveModelConfig;
    }
  | {
      valid: false;
      reason: string;
    };

function readLiveConfig(): LiveConfigResult {
  const baseUrl = process.env.MODEL_BASE_URL;
  const modelName = process.env.MODEL_NAME;
  const apiKey = process.env.MODEL_API_KEY;

  if (!baseUrl) {
    return {
      valid: false,
      reason: "MODEL_BASE_URL is not configured.",
    };
  }

  if (!modelName) {
    return {
      valid: false,
      reason: "MODEL_NAME is not configured.",
    };
  }

  if (!apiKey) {
    return {
      valid: false,
      reason: "MODEL_API_KEY is not configured.",
    };
  }

  return {
    valid: true,
    config: {
      baseUrl,
      modelName,
    },
  };
}

async function createWorkspace(): Promise<string> {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "agentos-live-model-agent-"));

  await mkdir(workspaceRoot, {
    recursive: true,
  });
  await writeFile(
    path.join(workspaceRoot, "README.md"),
    [
      "# AgentOS",
      "",
      "AgentOS is an open-source AI agent infrastructure layer for the Global South, starting with Africa.",
      "It is task-centric rather than model-centric.",
      "The architecture separates tasks, planners, plans, execution engines, registries, tools, connectors, memory, and results.",
      "This makes intelligent workflows easier to inspect, test, extend, and port across providers.",
      "",
    ].join("\n"),
    "utf8"
  );

  return workspaceRoot;
}

async function readOptionalFile(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
