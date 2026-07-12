import { describe, expect, it } from "vitest";
import {
  EchoModelProvider,
  MockModelProvider,
  ModelFinishReason,
  ModelProviderDefinitionValidationError,
  defineModelProvider,
  validateModelProviderDefinitionConfig,
} from "@agentosdev/sdk";

describe("defineModelProvider", () => {
  it("validates required fields and semantic version format", () => {
    const validation = validateModelProviderDefinitionConfig({
      id: "",
      name: "",
      version: "1",
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors.map((error) => error.code)).toEqual([
      "model_provider_missing_id",
      "model_provider_missing_name",
      "model_provider_invalid_version",
      "model_provider_missing_generate",
    ]);
  });

  it("throws typed validation errors", () => {
    expect(() =>
      defineModelProvider({
        id: "broken",
        name: "",
        version: "1.0.0",
        generate: undefined as never,
      })
    ).toThrow(ModelProviderDefinitionValidationError);
  });

  it("creates an immutable provider definition", () => {
    const provider = defineModelProvider({
      id: "immutable",
      name: "Immutable Provider",
      version: "1.0.0",
      capabilities: ["generation"],
      tags: ["test"],
      generate() {
        return {
          text: "ok",
        };
      },
    });

    expect(Object.isFrozen(provider)).toBe(true);
    expect(Object.isFrozen(provider.tags)).toBe(true);
    expect(Object.isFrozen(provider.capabilities)).toBe(true);
    expect(() => {
      (provider as { name: string }).name = "Changed";
    }).toThrow(TypeError);
  });

  it("returns inspect and summary information", () => {
    const provider = defineModelProvider({
      id: "inspectable",
      name: "Inspectable Provider",
      description: "Provider for inspection.",
      version: "1.0.0",
      capabilities: ["generation", "classification"],
      tags: ["inspect"],
      metadata: {
        local: true,
      },
      generate() {
        return {
          text: "ok",
        };
      },
    });

    expect(provider.inspect()).toMatchObject({
      id: "inspectable",
      name: "Inspectable Provider",
      generationSignature: "generate(request)",
      capabilities: ["generation", "classification"],
      tags: ["inspect"],
      metadata: {
        local: true,
      },
    });
    expect(provider.summary()).toMatchObject({
      id: "inspectable",
      name: "Inspectable Provider",
      capabilities: ["generation", "classification"],
    });
  });

  it("normalizes generate responses with provider, duration, and finish reason", async () => {
    const provider = defineModelProvider({
      id: "custom",
      name: "Custom Provider",
      version: "1.0.0",
      generate(request) {
        return {
          text: `Generated: ${request.prompt}`,
          model: "custom-model",
        };
      },
    });

    const response = await provider.generate({
      prompt: "Hello",
    });

    expect(response).toMatchObject({
      text: "Generated: Hello",
      provider: "custom",
      model: "custom-model",
      finishReason: ModelFinishReason.Unknown,
    });
    expect(typeof response.durationMs).toBe("number");
  });

  it("uses the deterministic mock provider", async () => {
    const response = await MockModelProvider.generate({
      prompt: "Summarize this task",
    });

    expect(response.text).toBe("Mock response for: Summarize this task");
    expect(response.provider).toBe("mock");
    expect(response.finishReason).toBe(ModelFinishReason.Stop);
    expect(response.usage?.totalTokens).toBeGreaterThan(0);
  });

  it("uses the echo provider", async () => {
    const response = await EchoModelProvider.generate({
      prompt: "Return exactly this",
    });

    expect(response.text).toBe("Return exactly this");
    expect(response.provider).toBe("echo");
    expect(response.metadata).toMatchObject({
      echoed: true,
    });
  });
});
