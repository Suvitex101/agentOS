import { describe, expect, it } from "vitest";
import {
  AgentOSRegistry,
  HTTPModelProviderBase,
  ModelAssistedPlanner,
  ModelFinishReason,
  ModelProviderCapability,
  ModelProviderResolver,
  createOpenAICompatibleProvider,
  createTask,
  type Agent,
  type AgentOSError,
  type ExecutionContext,
  type HTTPModelProviderFetch,
} from "@agentos/sdk";

const successBody = {
  id: "chatcmpl-test",
  model: "test-model",
  choices: [
    {
      message: {
        content: JSON.stringify({
          steps: [
            {
              description: "Gather relevant information",
              type: "research",
              requiredCapability: "research",
            },
          ],
        }),
      },
      finish_reason: "stop",
    },
  ],
  usage: {
    prompt_tokens: 2,
    completion_tokens: 3,
    total_tokens: 5,
  },
};

function createJsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
    ...init,
  });
}

function createProvider(fetchImplementation: HTTPModelProviderFetch) {
  return createOpenAICompatibleProvider({
    id: "remote-test-provider",
    name: "Remote Test Provider",
    model: "test-model",
    transport: {
      baseUrl: "https://api.example.test",
      fetchImplementation,
    },
  });
}

describe("HTTPModelProviderBase", () => {
  it("enforces HTTPS for remote base URLs", () => {
    expect(
      () =>
        new HTTPModelProviderBase({
          baseUrl: "http://api.example.test",
        })
    ).toThrow("Remote model provider baseUrl must use HTTPS");
  });

  it("allows localhost HTTP only when explicitly enabled", () => {
    expect(
      () =>
        new HTTPModelProviderBase({
          baseUrl: "http://localhost:11434",
        })
    ).toThrow("Remote model provider baseUrl must use HTTPS");

    expect(
      () =>
        new HTTPModelProviderBase({
          baseUrl: "http://localhost:11434",
          allowLocalhost: true,
        })
    ).not.toThrow();
  });

  it("maps OpenAI-compatible requests", async () => {
    let capturedRequest: { input: string | URL; init?: RequestInit } | undefined;
    const provider = createProvider(async (input, init) => {
      capturedRequest = { input, init };

      return createJsonResponse(successBody);
    });

    await provider.generate({
      prompt: "Plan this task",
      systemPrompt: "Return JSON.",
      temperature: 0.2,
      maxTokens: 200,
      metadata: {
        taskId: "task-1",
      },
    });

    const body = JSON.parse(String(capturedRequest?.init?.body)) as Record<string, unknown>;
    const messages = body.messages as Array<Record<string, unknown>>;

    expect(String(capturedRequest?.input)).toBe("https://api.example.test/v1/chat/completions");
    expect(capturedRequest?.init?.method).toBe("POST");
    expect(body.model).toBe("test-model");
    expect(body.temperature).toBe(0.2);
    expect(body.max_tokens).toBe(200);
    expect(messages).toEqual([
      {
        role: "system",
        content: "Return JSON.",
      },
      {
        role: "user",
        content: "Plan this task",
      },
    ]);
  });

  it("maps OpenAI-compatible responses", async () => {
    const provider = createProvider(async () => createJsonResponse(successBody));
    const response = await provider.generate({
      prompt: "Plan this task",
    });

    expect(response.text).toContain("Gather relevant information");
    expect(response.provider).toBe("openai-compatible");
    expect(response.model).toBe("test-model");
    expect(response.finishReason).toBe(ModelFinishReason.Stop);
    expect(response.usage).toMatchObject({
      inputTokens: 2,
      outputTokens: 3,
      totalTokens: 5,
    });
    expect(typeof response.durationMs).toBe("number");
  });

  it("normalizes finish reasons and usage", async () => {
    const provider = createProvider(async () =>
      createJsonResponse({
        ...successBody,
        choices: [
          {
            message: {
              content: "ok",
            },
            finish_reason: "length",
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 4,
          total_tokens: 14,
        },
      })
    );
    const response = await provider.generate({
      prompt: "Plan this task",
    });

    expect(response.finishReason).toBe(ModelFinishReason.Length);
    expect(response.usage?.totalTokens).toBe(14);
  });

  it("rejects redirects", async () => {
    const provider = createProvider(async () =>
      createJsonResponse({}, { status: 302, headers: { location: "https://example.com" } })
    );

    await expect(provider.generate({ prompt: "test" })).rejects.toMatchObject({
      code: "http_model_provider_redirect_denied",
    });
  });

  it("rejects invalid content types", async () => {
    const provider = createProvider(
      async () =>
        new Response("plain text", {
          status: 200,
          headers: {
            "content-type": "text/plain",
          },
        })
    );

    await expect(provider.generate({ prompt: "test" })).rejects.toMatchObject({
      code: "http_model_provider_invalid_content_type",
    });
  });

  it("rejects malformed JSON", async () => {
    const provider = createProvider(
      async () =>
        new Response("{bad-json", {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        })
    );

    await expect(provider.generate({ prompt: "test" })).rejects.toMatchObject({
      code: "http_model_provider_invalid_json",
    });
  });

  it("rejects oversized responses", async () => {
    const provider = createOpenAICompatibleProvider({
      model: "test-model",
      transport: {
        baseUrl: "https://api.example.test",
        maxResponseBytes: 4,
        fetchImplementation: async () => createJsonResponse(successBody),
      },
    });

    await expect(provider.generate({ prompt: "test" })).rejects.toMatchObject({
      code: "http_model_provider_response_too_large",
    });
  });

  it("returns timeout errors", async () => {
    const provider = createOpenAICompatibleProvider({
      model: "test-model",
      transport: {
        baseUrl: "https://api.example.test",
        timeoutMs: 1,
        fetchImplementation: () => new Promise<Response>(() => undefined),
      },
    });

    await expect(provider.generate({ prompt: "test" })).rejects.toMatchObject({
      code: "http_model_provider_timeout",
    });
  });

  it("redacts secrets from transport errors", async () => {
    const provider = createOpenAICompatibleProvider({
      model: "test-model",
      transport: {
        baseUrl: "https://api.example.test",
        defaultHeaders: {
          authorization: "Bearer sk-secret",
        },
        fetchImplementation: async () => {
          throw new Error("Failed with Bearer sk-secret");
        },
      },
    });

    try {
      await provider.generate({ prompt: "test" });
      throw new Error("Expected provider.generate to fail");
    } catch (error) {
      const agentOSError = error as AgentOSError;

      expect(agentOSError.code).toBe("http_model_provider_network_error");
      expect(agentOSError.message).toContain("[redacted]");
      expect(agentOSError.message).not.toContain("sk-secret");
    }
  });

  it("works with ModelAssistedPlanner through the provider resolver", async () => {
    const registry = new AgentOSRegistry();
    const provider = createProvider(async () => createJsonResponse(successBody));

    registry.registerModelProvider(provider);
    registry.setDefaultModelProvider(provider.id);

    const planner = new ModelAssistedPlanner({
      providerResolver: new ModelProviderResolver({ registry }),
      options: {
        fallback: "fail",
      },
    });
    const task = createTask({
      id: "http-provider-planner-task",
      input: "Create a research plan",
      source: {
        type: "test",
      },
    });
    const agent: Agent = {
      id: "http-provider-planner-agent",
      name: "HTTP Provider Planner Agent",
      description: "Tests HTTP provider planning.",
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

    expect(plan.metadata?.providerId).toBe("remote-test-provider");
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]?.description).toBe("Gather relevant information");
  });
});
