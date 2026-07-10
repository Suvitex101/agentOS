import {
  AgentOSRegistry,
  EchoModelProvider,
  MockModelProvider,
  ModelProviderCapability,
  ModelProviderResolver,
  defineModelProvider,
} from "@agentos/sdk";

async function main() {
  const registry = new AgentOSRegistry();
  const reasoningProvider = defineModelProvider({
    id: "reasoning-demo",
    name: "Reasoning Demo Provider",
    description: "Local provider that demonstrates provider capabilities.",
    version: "1.0.0",
    capabilities: [ModelProviderCapability.Reasoning, ModelProviderCapability.StructuredOutput],
    tags: ["example", "reasoning"],
    generate(request) {
      return {
        text: `Reasoning demo response for: ${request.prompt}`,
        model: "reasoning-demo",
      };
    },
  });

  registry.registerModelProvider(MockModelProvider);
  registry.registerModelProvider(EchoModelProvider);
  registry.registerModelProvider(reasoningProvider);
  registry.setDefaultModelProvider("mock");

  const resolver = new ModelProviderResolver({ registry });
  const defaultResolution = resolver.resolve();
  const capabilityResolution = resolver.resolve({
    capability: ModelProviderCapability.Reasoning,
  });

  console.log("\n=== Provider Registry ===");
  console.log(`Registered providers: ${registry.listModelProviders().length}`);
  console.log(`Default provider: ${defaultResolution.provider?.name}`);
  console.log(`Reasoning provider: ${capabilityResolution.provider?.name}`);
  console.log(`Reasoning capabilities: ${reasoningProvider.inspect().capabilities.join(", ")}`);

  const response = await capabilityResolution.provider?.generate({
    prompt: "Plan a community research task",
  });

  console.log(`Generated text: ${response?.text}`);

  registry.unregisterModelProvider("echo");

  console.log(`Providers after unregister: ${registry.listModelProviders().length}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
