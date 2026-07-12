import { describe, expect, it } from "vitest";
import {
  AgentOSRegistry,
  EchoModelProvider,
  MockModelProvider,
  ModelProviderCapability,
  ModelProviderResolver,
  defineModelProvider,
  type ModelProvider,
} from "@agentosdev/sdk";

function createReasoningProvider(id = "reasoning-provider") {
  return defineModelProvider({
    id,
    name: "Reasoning Provider",
    description: "Provider with reasoning capability.",
    version: "1.0.0",
    capabilities: [ModelProviderCapability.Reasoning, ModelProviderCapability.StructuredOutput],
    generate(request) {
      return {
        text: `Reasoned: ${request.prompt}`,
      };
    },
  });
}

describe("AgentOSRegistry model providers", () => {
  it("registers, lists, finds, and summarizes model providers", () => {
    const registry = new AgentOSRegistry();
    const result = registry.registerModelProvider(MockModelProvider);

    expect(result.success).toBe(true);
    expect(registry.findModelProvider("mock")?.name).toBe("Mock Provider");
    expect(registry.listModelProviders()).toHaveLength(1);
    expect(registry.defaultModelProvider()?.id).toBe("mock");
    expect(registry.summary()).toMatchObject({
      modelProviders: 1,
    });
  });

  it("prevents duplicate provider ids", () => {
    const registry = new AgentOSRegistry();

    expect(registry.registerModelProvider(MockModelProvider).success).toBe(true);

    const duplicate = registry.registerModelProvider(MockModelProvider);

    expect(duplicate.success).toBe(false);
    expect(duplicate.error?.code).toBe("registry_duplicate_model_provider");
  });

  it("changes and clears the default model provider", () => {
    const registry = new AgentOSRegistry();

    registry.registerModelProvider(MockModelProvider);
    registry.registerModelProvider(EchoModelProvider);

    const changed = registry.setDefaultModelProvider("echo");

    expect(changed.success).toBe(true);
    expect(registry.defaultModelProvider()?.id).toBe("echo");

    const cleared = registry.clearDefaultModelProvider();

    expect(cleared.success).toBe(true);
    expect(registry.defaultModelProvider()).toBeUndefined();
  });

  it("rejects unknown default providers", () => {
    const registry = new AgentOSRegistry();
    const result = registry.setDefaultModelProvider("missing-provider");

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("registry_unknown_default_model_provider");
  });

  it("unregisters providers and clears default when needed", () => {
    const registry = new AgentOSRegistry();

    registry.registerModelProvider(MockModelProvider);

    const result = registry.unregisterModelProvider("mock");

    expect(result.success).toBe(true);
    expect(registry.findModelProvider("mock")).toBeUndefined();
    expect(registry.defaultModelProvider()).toBeUndefined();
  });

  it("validates missing capabilities and invalid metadata", () => {
    const registry = new AgentOSRegistry();
    const missingCapabilitiesProvider: ModelProvider = {
      ...MockModelProvider,
      id: "missing-capabilities",
      capabilities: [],
    };
    const invalidMetadataProvider: ModelProvider = {
      ...MockModelProvider,
      id: "invalid-metadata",
      metadata: [] as unknown as Record<string, unknown>,
    };

    const missingCapabilities = registry.registerModelProvider(missingCapabilitiesProvider);
    const invalidMetadata = registry.registerModelProvider(invalidMetadataProvider);

    expect(missingCapabilities.success).toBe(false);
    expect(missingCapabilities.error?.code).toBe("registry_model_provider_missing_capabilities");
    expect(invalidMetadata.success).toBe(false);
    expect(invalidMetadata.error?.code).toBe("registry_model_provider_invalid_metadata");
  });
});

describe("ModelProviderResolver", () => {
  it("resolves providers by id", () => {
    const registry = new AgentOSRegistry();
    const resolver = new ModelProviderResolver({ registry });

    registry.registerModelProvider(MockModelProvider);

    const result = resolver.resolve({ providerId: "mock" });

    expect(result.success).toBe(true);
    expect(result.provider?.id).toBe("mock");
    expect(result.reason).toBe("matched_provider_id");
  });

  it("resolves providers by capability", () => {
    const registry = new AgentOSRegistry();
    const resolver = new ModelProviderResolver({ registry });

    registry.registerModelProvider(MockModelProvider);
    registry.registerModelProvider(createReasoningProvider());

    const result = resolver.resolve({ capability: ModelProviderCapability.Reasoning });

    expect(result.success).toBe(true);
    expect(result.provider?.id).toBe("reasoning-provider");
    expect(result.reason).toBe("matched_capability");
  });

  it("resolves the default provider", () => {
    const registry = new AgentOSRegistry();
    const resolver = new ModelProviderResolver({ registry });

    registry.registerModelProvider(MockModelProvider);

    const result = resolver.resolve();

    expect(result.success).toBe(true);
    expect(result.provider?.id).toBe("mock");
    expect(result.reason).toBe("matched_default_provider");
  });

  it("returns typed errors for missing providers", () => {
    const resolver = new ModelProviderResolver({ registry: new AgentOSRegistry() });

    expect(resolver.resolve({ providerId: "missing" }).errors[0]?.code).toBe(
      "model_provider_not_found"
    );
    expect(resolver.resolve({ capability: "missing-capability" }).errors[0]?.code).toBe(
      "model_provider_capability_not_found"
    );
    expect(resolver.resolve().errors[0]?.code).toBe("model_provider_default_not_found");
  });
});
