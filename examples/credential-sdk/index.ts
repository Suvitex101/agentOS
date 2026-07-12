import {
  CredentialResolver,
  CredentialType,
  HTTPModelProviderBase,
  createOpenAICompatibleProvider,
  type HTTPModelProviderFetch,
} from "@agentosdev/sdk";

const mockedFetch: HTTPModelProviderFetch = async () =>
  new Response(
    JSON.stringify({
      id: "chatcmpl-credential-demo",
      model: "credential-demo-model",
      choices: [
        {
          message: {
            content: "Credential-backed provider request completed.",
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 4,
        completion_tokens: 6,
        total_tokens: 10,
      },
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    }
  );

async function main() {
  const environmentResolver = new CredentialResolver({
    environment: {
      MODEL_API_KEY: "sk-demo-environment-secret",
    },
  });
  const staticResolver = new CredentialResolver();
  const missingResolver = new CredentialResolver({
    environment: {},
  });

  const environmentCredential = {
    type: CredentialType.Environment,
    name: "MODEL_API_KEY",
  } as const;
  const staticCredential = {
    type: CredentialType.Static,
    value: "sk-demo-static-secret",
  } as const;
  const environmentResolution = environmentResolver.resolve(environmentCredential);
  const staticResolution = staticResolver.resolve(staticCredential);
  const missingResolution = missingResolver.resolve({
    type: CredentialType.Environment,
    name: "MISSING_MODEL_API_KEY",
  });
  const transport = new HTTPModelProviderBase({
    baseUrl: "https://api.example.test",
    credential: environmentCredential,
    credentialResolver: environmentResolver,
    fetchImplementation: mockedFetch,
  });
  const provider = createOpenAICompatibleProvider({
    id: "credential-demo-provider",
    name: "Credential Demo Provider",
    model: "credential-demo-model",
    transport,
  });
  const response = await provider.generate({
    prompt: "Demonstrate credential-backed provider usage.",
  });

  console.log("\n=== Credential SDK ===");
  console.log(`Environment credential resolved: ${environmentResolution.success}`);
  console.log(`Static credential resolved: ${staticResolution.success}`);
  console.log(`Static credential warning: ${staticResolution.warnings[0]?.code}`);
  console.log(`Missing credential error: ${missingResolution.errors[0]?.code}`);
  console.log(`Transport credential reference: ${JSON.stringify(transport.config.credential)}`);
  console.log(`Provider inspect id: ${provider.inspect().id}`);
  console.log(`Provider response: ${response.text}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
