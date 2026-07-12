import { EchoModelProvider, MockModelProvider, defineModelProvider } from "@agentosdev/sdk";

async function main() {
  const customProvider = defineModelProvider({
    id: "local-demo",
    name: "Local Demo Provider",
    description: "Small deterministic provider for AgentOS examples.",
    version: "1.0.0",
    capabilities: ["generation", "reasoning"],
    tags: ["example", "local"],
    generate(request) {
      return {
        text: `Demo response: ${request.prompt}`,
        usage: {
          inputTokens: request.prompt.split(/\s+/).filter(Boolean).length,
          outputTokens: 3,
          totalTokens: request.prompt.split(/\s+/).filter(Boolean).length + 3,
        },
        finishReason: "stop",
        model: "local-demo",
        metadata: {
          deterministic: true,
        },
      };
    },
  });

  const prompt = "Explain AgentOS providers in one sentence.";
  const custom = await customProvider.generate({
    prompt,
    systemPrompt: "Be concise.",
    temperature: 0,
    maxTokens: 64,
  });
  const mock = await MockModelProvider.generate({
    prompt,
  });
  const echo = await EchoModelProvider.generate({
    prompt,
  });

  console.log("\n=== Model Provider SDK ===");
  console.log(`Custom provider: ${customProvider.summary().name}`);
  console.log(`Capabilities: ${customProvider.inspect().capabilities.join(", ")}`);
  console.log(`Custom response: ${custom.text}`);
  console.log(`Mock response: ${mock.text}`);
  console.log(`Echo response: ${echo.text}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
