import {
  AgentOSRegistry,
  CredentialType,
  MemoryScope,
  MemoryType,
  ToolResolver,
  createGitHubConnector,
  createTask,
  type Agent,
  type ExecutionContext,
  type GitHubFetch,
  type GitHubRepositoryOutput,
} from "@agentosdev/sdk";

const mockedGitHubFetch: GitHubFetch = async (input, init) => {
  const url = String(input);
  const method = init?.method ?? "GET";

  if (method === "GET" && url.includes("/repos/agentos/agentos/issues")) {
    return jsonResponse([
      {
        id: 10,
        number: 10,
        title: "Document connector bundle lifecycle",
        state: "open",
        user: {
          login: "contributor",
        },
        labels: [{ name: "documentation" }],
      },
    ]);
  }

  if (method === "GET" && url.includes("/search/code")) {
    return jsonResponse({
      total_count: 1,
      incomplete_results: false,
      items: [
        {
          name: "index.ts",
          path: "packages/sdk/src/index.ts",
          html_url: "https://github.com/agentos/agentos/blob/main/packages/sdk/src/index.ts",
          score: 1,
          repository: {
            full_name: "agentos/agentos",
          },
        },
      ],
    });
  }

  return jsonResponse({
    id: 1,
    name: "agentos",
    full_name: "agentos/agentos",
    private: false,
    default_branch: "main",
    description: "Open-source AI agent infrastructure layer.",
    html_url: "https://github.com/agentos/agentos",
    visibility: "public",
    owner: {
      login: "agentos",
    },
  });
};

const registry = new AgentOSRegistry();
const githubConnector = createGitHubConnector({
  credential: {
    type: CredentialType.Static,
    value: "demo-token",
  },
  fetchImplementation: mockedGitHubFetch,
});

const registration = registry.registerConnectorBundle(githubConnector);

if (!registration.success) {
  throw new Error(registration.error?.message ?? "Failed to register GitHub connector.");
}

const resolver = new ToolResolver({
  registry,
});

const repositoryResolution = resolver.resolve({
  toolId: "tool-github-get-repository",
});
const issuesResolution = resolver.resolve({
  toolId: "tool-github-list-issues",
});
const searchResolution = resolver.resolve({
  toolId: "tool-github-search-code",
});

if (!repositoryResolution.success || !issuesResolution.success || !searchResolution.success) {
  throw new Error("Expected GitHub tools to resolve.");
}

const agent: Agent = {
  id: "github-example-agent",
  name: "GitHub Example Agent",
  description: "Demonstrates the GitHub connector.",
  version: "0.1.0",
  capabilities: [{ name: "repository" }, { name: "issues" }, { name: "search" }],
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
  task: createTask({
    input: "Inspect AgentOS repository information",
    source: "example",
  }),
  memory: [],
  resources: registry.listResources(),
  variables: {},
  environment: {},
  metadata: {},
};

async function main() {
  const repository = await repositoryResolution.tool!.execute(
    {
      owner: "agentos",
      repo: "agentos",
    },
    context
  );
  const issues = await issuesResolution.tool!.execute(
    {
      owner: "agentos",
      repo: "agentos",
    },
    context
  );
  const search = await searchResolution.tool!.execute(
    {
      query: "defineAgent",
      owner: "agentos",
      repo: "agentos",
    },
    context
  );

  console.log("\n=== GitHub Connector ===");
  console.log(`Connector: ${githubConnector.name}`);
  console.log(
    `Capabilities: ${registry
      .listCapabilities()
      .map((capability) => capability.id)
      .join(", ")}`
  );
  console.log(`Registered tools: ${registry.listTools().length}`);
  console.log(`Repository: ${(repository.output as GitHubRepositoryOutput).fullName}`);
  console.log(`Repository status: ${repository.success ? "success" : "failed"}`);
  console.log(`Issues status: ${issues.success ? "success" : "failed"}`);
  console.log(`Search status: ${search.success ? "success" : "failed"}`);
  console.log(`Resolved tool: ${repositoryResolution.tool!.name}`);
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
