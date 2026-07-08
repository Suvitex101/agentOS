import {
  AgentOSRegistry,
  MemoryScope,
  MemoryType,
  createHttpConnector,
  type Agent,
  type ExecutionContext,
  type HttpFetch,
  type HttpResolveHost,
  type RegisteredTool,
} from "@agentos/sdk";

const mockFetch: HttpFetch = async (input, init) => {
  const url = input.toString();

  if (init?.redirect !== "manual") {
    throw new Error("Expected redirects to be disabled.");
  }

  if (url === "https://example.com/status") {
    return new Response("AgentOS HTTP connector demo response.", {
      status: 200,
      statusText: "OK",
      headers: {
        "content-type": "text/plain",
      },
    });
  }

  return new Response("not found", {
    status: 404,
    statusText: "Not Found",
  });
};
const resolveHost: HttpResolveHost = async () => ["93.184.216.34"];

async function main() {
  const httpConnector = createHttpConnector({
    allowlist: ["https://example.com"],
    timeoutMs: 5000,
    maxResponseBytes: 1024 * 1024,
    fetchImplementation: mockFetch,
    resolveHost,
  });
  const registry = new AgentOSRegistry();
  const registration = registry.registerConnectorBundle(httpConnector);

  if (!registration.success) {
    throw new Error(registration.error?.message ?? "Failed to register HTTP connector.");
  }

  const agent: Agent = {
    id: "http-example-agent",
    name: "HTTP Example Agent",
    description: "Demonstrates safe HTTP GET connector tools.",
    version: "0.1.0",
    capabilities: [{ name: "network" }, { name: "retrieval" }],
    tools: registry.listTools(),
    memoryPolicy: {
      enabled: false,
      scopes: [MemoryScope.Task],
      readableTypes: [MemoryType.Summary],
      writableTypes: [MemoryType.Summary],
    },
    permissions: [],
  };
  const context: ExecutionContext = {
    agent,
    task: {
      id: "task-http-example",
      input: "Demonstrate HTTP connector",
      status: "pending",
      priority: "normal",
      source: {
        type: "example",
        name: "http-connector",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    memory: [],
    resources: registry.listResources(),
    variables: {},
    environment: {},
  };
  const getTool = getRegisteredTool(registry, "tool-http-get");

  const success = await getTool.execute(
    {
      url: "https://example.com/status",
      headers: {
        accept: "text/plain",
      },
    },
    context
  );
  const rejectedHost = await getTool.execute(
    {
      url: "https://not-allowed.example/status",
    },
    context
  );
  const rejectedHttp = await getTool.execute(
    {
      url: "http://example.com/status",
    },
    context
  );
  const rejectedLocalhost = await getTool.execute(
    {
      url: "https://localhost/status",
    },
    context
  );

  console.log("\n=== HTTP Connector ===");
  console.log("Endpoint: https://example.com/status");
  console.log(`Registered capabilities: ${registry.listCapabilities().length}`);
  console.log(`Registered tools: ${registry.listTools().length}`);
  console.log(`Successful GET: ${success.success}`);
  console.log(`Status: ${String((success.output as { status?: number } | undefined)?.status)}`);
  console.log(`Rejected host: ${rejectedHost.errors[0]?.code}`);
  console.log(`Rejected http:// URL: ${rejectedHttp.errors[0]?.code}`);
  console.log(`Rejected localhost URL: ${rejectedLocalhost.errors[0]?.code}`);
}

function getRegisteredTool(registry: AgentOSRegistry, toolId: string): RegisteredTool {
  const tool = registry.findToolById(toolId);

  if (!tool) {
    throw new Error(`Expected tool "${toolId}" to be registered.`);
  }

  return tool;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
