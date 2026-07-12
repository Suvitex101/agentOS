import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AgentOSRegistry,
  CredentialResolver,
  CredentialType,
  HTTPModelProviderBase,
  InMemoryMemoryStore,
  ModelAssistedPlanner,
  ModelProviderCapability,
  ModelProviderResolver,
  ResultStatus,
  SimpleExecutionEngine,
  createFilesystemConnector,
  createOpenAICompatibleProvider,
  defineAgent,
  type HTTPModelProviderFetch,
} from "@agentosdev/sdk";

describe("live model workflow architecture", () => {
  it("runs deterministically through provider, credentials, planner, filesystem tools, execution, and memory", async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "agentos-workflow-test-"));

    await writeFile(
      path.join(workspaceRoot, "README.md"),
      "# AgentOS\n\nAgentOS is task-centric infrastructure for intelligent work.\n",
      "utf8"
    );

    let capturedAuthorization: string | undefined;
    const fetchImplementation: HTTPModelProviderFetch = async (_input, init) => {
      const headers = init?.headers as Record<string, string> | undefined;

      capturedAuthorization = headers?.authorization;

      return new Response(
        JSON.stringify({
          id: "chatcmpl-workflow-test",
          model: "workflow-test-model",
          choices: [
            {
              message: {
                content: JSON.stringify({
                  steps: [
                    {
                      description: "Read README.md from the workspace.",
                      type: "tool",
                      requiredTool: "tool-workflow-filesystem-read-file",
                      requiredCapability: "storage",
                      input: {
                        path: "README.md",
                      },
                    },
                    {
                      description: "Write SUMMARY.md to the workspace.",
                      type: "tool",
                      requiredTool: "tool-workflow-filesystem-write-file",
                      requiredCapability: "storage",
                      input: {
                        path: "SUMMARY.md",
                        content:
                          "# Summary\n\nAgentOS is task-centric infrastructure for intelligent work.",
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
            prompt_tokens: 16,
            completion_tokens: 32,
            total_tokens: 48,
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
    const registry = new AgentOSRegistry();
    const filesystemConnector = createFilesystemConnector({
      id: "workflow-filesystem",
      workspaceRoot,
    });

    registry.registerConnectorBundle(filesystemConnector);
    registry.registerModelProvider(
      createOpenAICompatibleProvider({
        id: "workflow-provider",
        name: "Workflow Provider",
        model: "workflow-test-model",
        transport: new HTTPModelProviderBase({
          baseUrl: "https://model.example.test",
          credential: {
            type: CredentialType.Environment,
            name: "MODEL_API_KEY",
          },
          credentialResolver: new CredentialResolver({
            environment: {
              MODEL_API_KEY: "sk-workflow-secret",
            },
          }),
          fetchImplementation,
        }),
      })
    );
    registry.setDefaultModelProvider("workflow-provider");

    const memoryStore = new InMemoryMemoryStore();
    const agent = defineAgent({
      id: "workflow-agent",
      name: "Workflow Agent",
      description: "Runs the first complete deterministic workflow.",
      planner: new ModelAssistedPlanner({
        providerResolver: new ModelProviderResolver({ registry }),
        options: {
          fallback: "fail",
          provider: {
            requiredCapabilities: [ModelProviderCapability.TextGeneration],
            preferredCapabilities: [ModelProviderCapability.Reasoning],
          },
        },
      }),
      executionEngine: new SimpleExecutionEngine(),
      registry,
      memoryStore,
    });
    const result = await agent.run("Summarize README.md into SUMMARY.md");
    const summary = await readFile(path.join(workspaceRoot, "SUMMARY.md"), "utf8");
    const memories = await memoryStore.list();

    expect(result.status).toBe(ResultStatus.Completed);
    expect(result.toolCalls.map((call) => call.toolId)).toEqual([
      "tool-workflow-filesystem-read-file",
      "tool-workflow-filesystem-write-file",
    ]);
    expect(summary).toContain("AgentOS is task-centric infrastructure");
    expect(capturedAuthorization).toBe("Bearer sk-workflow-secret");
    expect(JSON.stringify(result)).not.toContain("sk-workflow-secret");
    expect(result.metadata).toMatchObject({
      memoryWriteAttempted: true,
    });
    expect(memories).toHaveLength(1);
  });
});
