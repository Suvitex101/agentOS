import { describe, expect, it, vi } from "vitest";
import {
  AgentOSRegistry,
  ModelAssistedPlanner,
  ModelFinishReason,
  ModelProviderCapability,
  ModelProviderResolver,
  PlanStatus,
  createOllamaProvider,
  createTask,
  type Agent,
  type ExecutionContext,
  type HTTPModelProviderFetch,
} from "@agentos/sdk";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    statusText: init.statusText,
    headers: {
      "content-type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

function createSuccessFetch(): HTTPModelProviderFetch {
  return vi.fn<HTTPModelProviderFetch>(async (input) => {
    const url = String(input);

    if (url.endsWith("/api/tags")) {
      return jsonResponse({
        models: [
          {
            name: "llama3.1",
          },
        ],
      });
    }

    if (url.endsWith("/api/version")) {
      return jsonResponse({
        version: "0.5.0",
      });
    }

    return jsonResponse({
      model: "llama3.1",
      response: JSON.stringify({
        steps: [
          {
            description: "Gather relevant information",
            type: "research",
            requiredCapability: "research",
          },
        ],
      }),
      done: true,
      done_reason: "stop",
      prompt_eval_count: 12,
      eval_count: 8,
      total_duration: 1000,
    });
  });
}

describe("OllamaProvider", () => {
  it("creates a local-first provider with Ollama capabilities", () => {
    const provider = createOllamaProvider({
      model: "llama3.1",
      fetchImplementation: createSuccessFetch(),
    });

    expect(provider.id).toBe("ollama");
    expect(provider.summary().capabilities).toContain(ModelProviderCapability.TextGeneration);
    expect(provider.summary().tags).toContain("ollama");
    expect(provider.inspect().metadata).toMatchObject({
      model: "llama3.1",
      localFirst: true,
    });
  });

  it("rejects remote endpoints unless explicitly allowed", () => {
    expect(() =>
      createOllamaProvider({
        baseUrl: "https://ollama.example.test",
        model: "llama3.1",
      })
    ).toThrow(expect.objectContaining({ code: "ollama_provider_remote_disabled" }));

    expect(() =>
      createOllamaProvider({
        baseUrl: "https://ollama.example.test",
        model: "llama3.1",
        allowRemote: true,
      })
    ).not.toThrow();
  });

  it("maps AgentOS generation requests to Ollama native generate requests", async () => {
    let capturedBody: Record<string, unknown> | undefined;
    const fetchImplementation = vi.fn<HTTPModelProviderFetch>(async (_input, init) => {
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;

      return jsonResponse({
        model: "llama3.1",
        response: "ok",
        done: true,
        done_reason: "stop",
      });
    });
    const provider = createOllamaProvider({
      model: "llama3.1",
      fetchImplementation,
    });

    await provider.generate({
      prompt: "Plan a task",
      systemPrompt: "Return JSON only.",
      temperature: 0.2,
      maxTokens: 256,
      metadata: {
        contextWindow: 4096,
      },
    });

    expect(fetchImplementation).toHaveBeenCalledOnce();
    expect(capturedBody).toMatchObject({
      model: "llama3.1",
      prompt: "Plan a task",
      system: "Return JSON only.",
      stream: false,
    });
    expect(capturedBody?.options).toMatchObject({
      temperature: 0.2,
      num_predict: 256,
      num_ctx: 4096,
    });
  });

  it("normalizes Ollama responses into ModelGenerationResponse", async () => {
    const provider = createOllamaProvider({
      model: "llama3.1",
      fetchImplementation: createSuccessFetch(),
    });
    const response = await provider.generate({
      prompt: "Generate a plan",
    });

    expect(response.provider).toBe("ollama");
    expect(response.model).toBe("llama3.1");
    expect(response.finishReason).toBe(ModelFinishReason.Stop);
    expect(response.usage).toMatchObject({
      inputTokens: 12,
      outputTokens: 8,
      totalTokens: 20,
    });
    expect(response.text).toContain("Gather relevant information");
  });

  it("reports health without throwing when Ollama is reachable", async () => {
    const provider = createOllamaProvider({
      model: "llama3.1",
      fetchImplementation: createSuccessFetch(),
    });
    const health = await provider.health();

    expect(health.reachable).toBe(true);
    expect(health.modelAvailable).toBe(true);
    expect(health.providerVersion).toBe("0.5.0");
    expect(health.errors).toEqual([]);
  });

  it("reports unavailable models through health", async () => {
    const fetchImplementation = vi.fn<HTTPModelProviderFetch>(async (input) => {
      if (String(input).endsWith("/api/tags")) {
        return jsonResponse({
          models: [{ name: "mistral" }],
        });
      }

      return jsonResponse({ version: "0.5.0" });
    });
    const provider = createOllamaProvider({
      model: "llama3.1",
      fetchImplementation,
    });
    const health = await provider.health();

    expect(health.reachable).toBe(true);
    expect(health.modelAvailable).toBe(false);
  });

  it("rejects malformed JSON and invalid content types", async () => {
    const malformedProvider = createOllamaProvider({
      model: "llama3.1",
      fetchImplementation: async () =>
        new Response("{bad-json", {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }),
    });
    const plainProvider = createOllamaProvider({
      model: "llama3.1",
      fetchImplementation: async () =>
        new Response("not-json", {
          status: 200,
          headers: {
            "content-type": "text/plain",
          },
        }),
    });

    await expect(malformedProvider.generate({ prompt: "test" })).rejects.toMatchObject({
      code: "http_model_provider_invalid_json",
    });
    await expect(plainProvider.generate({ prompt: "test" })).rejects.toMatchObject({
      code: "http_model_provider_invalid_content_type",
    });
  });

  it("times out safely", async () => {
    const provider = createOllamaProvider({
      model: "llama3.1",
      timeoutMs: 1,
      fetchImplementation: () => new Promise<Response>(() => undefined),
    });

    await expect(provider.generate({ prompt: "test" })).rejects.toMatchObject({
      code: "http_model_provider_timeout",
    });
  });

  it("integrates with ModelAssistedPlanner through the registry", async () => {
    const registry = new AgentOSRegistry();
    const provider = createOllamaProvider({
      model: "llama3.1",
      fetchImplementation: createSuccessFetch(),
    });

    registry.registerModelProvider(provider);
    registry.setDefaultModelProvider(provider.id);

    const planner = new ModelAssistedPlanner({
      providerResolver: new ModelProviderResolver({ registry }),
      options: {
        fallback: "fail",
      },
    });
    const task = createTask({
      id: "ollama-planner-task",
      input: "Create a local research plan",
      source: {
        type: "test",
      },
    });
    const agent: Agent = {
      id: "ollama-agent",
      name: "Ollama Agent",
      description: "Plans through local Ollama.",
      version: "0.1.0",
      capabilities: [{ name: "research" }],
      tools: [],
      memoryPolicy: {
        enabled: false,
        scopes: [],
        readableTypes: [],
        writableTypes: [],
      },
      permissions: [],
    };
    const context: ExecutionContext = {
      agent,
      task,
      memory: [],
      resources: [],
      variables: {},
      environment: {},
    };
    const plan = await planner.plan(agent, task, context);

    expect(plan.status).toBe(PlanStatus.Ready);
    expect(plan.metadata?.providerId).toBe("ollama");
    expect(plan.steps[0]?.description).toBe("Gather relevant information");
  });
});
