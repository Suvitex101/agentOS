import { describe, expect, it, vi } from "vitest";
import {
  AgentOSRegistry,
  ConnectorPermission,
  ConnectorRiskLevel,
  ConnectorTrustLevel,
  CredentialResolver,
  CredentialType,
  MemoryScope,
  MemoryType,
  ToolResolver,
  createGitHubConnector,
  createTask,
  type Agent,
  type ExecutionContext,
  type GitHubFetch,
  type GitHubIssueOutput,
  type GitHubReadFileOutput,
  type GitHubRepositoryOutput,
  type GitHubSearchCodeOutput,
  type RegisteredTool,
} from "@agentos/sdk";

const TEST_TOKEN = "ghp_test_secret_token";

function createContext(registry: AgentOSRegistry): ExecutionContext {
  const agent: Agent = {
    id: "github-test-agent",
    name: "GitHub Test Agent",
    description: "Tests GitHub connector tools.",
    version: "0.1.0",
    capabilities: [{ name: "repository" }, { name: "source-code" }, { name: "issues" }],
    tools: registry.listTools(),
    memoryPolicy: {
      enabled: false,
      scopes: [MemoryScope.Task],
      readableTypes: [MemoryType.Summary],
      writableTypes: [MemoryType.Summary],
    },
    permissions: [],
  };

  return {
    agent,
    task: createTask({
      input: "github test",
    }),
    memory: [],
    resources: registry.listResources(),
    variables: {},
    environment: {},
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    statusText: init.statusText,
    headers: {
      "content-type": "application/json",
      "x-ratelimit-limit": "5000",
      "x-ratelimit-remaining": "4999",
      "x-ratelimit-reset": "1760000000",
      ...Object.fromEntries(new Headers(init.headers).entries()),
    },
  });
}

function createMockedConnector(fetchImplementation: GitHubFetch) {
  const registry = new AgentOSRegistry();
  const connector = createGitHubConnector({
    credential: {
      type: CredentialType.Static,
      value: TEST_TOKEN,
    },
    credentialResolver: new CredentialResolver(),
    fetchImplementation,
    timeoutMs: 50,
    maxResponseBytes: 1024 * 64,
  });
  const registration = registry.registerConnectorBundle(connector);

  if (!registration.success) {
    throw new Error(registration.error?.message ?? "Expected GitHub connector registration.");
  }

  return {
    connector,
    registry,
    context: createContext(registry),
  };
}

describe("GitHubConnector", () => {
  it("registers a read-first GitHub connector bundle", () => {
    const fetchImplementation = vi.fn<GitHubFetch>();
    const { connector, registry } = createMockedConnector(fetchImplementation);

    expect(registry.summary()).toMatchObject({
      capabilities: 4,
      connectors: 1,
      tools: 6,
      resources: 1,
    });
    expect(connector.security).toMatchObject({
      riskLevel: ConnectorRiskLevel.Medium,
      trustLevel: ConnectorTrustLevel.Remote,
      permissions: [
        ConnectorPermission.NetworkAccess,
        ConnectorPermission.ExternalAPI,
        ConnectorPermission.SecretsAccess,
      ],
      networkAccess: true,
      filesystemAccess: false,
      secretsAccess: true,
    });
    expect(registry.findToolById("tool-github-create-issue")).toBeUndefined();
  });

  it("authenticates with a bearer token without exposing the token in results", async () => {
    const fetchImplementation = vi.fn<GitHubFetch>(async (_input, init) => {
      expect((init?.headers as Record<string, string>).authorization).toBe(`Bearer ${TEST_TOKEN}`);

      return jsonResponse({
        id: 1,
        name: "agentos",
        full_name: "agentos/agentos",
        private: false,
        default_branch: "main",
        owner: {
          login: "agentos",
        },
      });
    });
    const { registry, context } = createMockedConnector(fetchImplementation);
    const tool = registry.findToolById("tool-github-get-repository") as RegisteredTool;
    const result = await tool.execute(
      {
        owner: "agentos",
        repo: "agentos",
      },
      context
    );

    expect(result.success).toBe(true);
    expect((result.output as GitHubRepositoryOutput).fullName).toBe("agentos/agentos");
    expect(JSON.stringify(result)).not.toContain(TEST_TOKEN);
  });

  it("reads repository files and decodes base64 content", async () => {
    const fetchImplementation = vi.fn<GitHubFetch>(async () =>
      jsonResponse({
        path: "README.md",
        content: Buffer.from("Hello AgentOS").toString("base64"),
        encoding: "base64",
        size: 13,
        sha: "abc123",
        html_url: "https://github.com/agentos/agentos/blob/main/README.md",
      })
    );
    const { registry, context } = createMockedConnector(fetchImplementation);
    const tool = registry.findToolById("tool-github-read-file") as RegisteredTool;
    const result = await tool.execute(
      {
        owner: "agentos",
        repo: "agentos",
        path: "README.md",
      },
      context
    );

    expect(result.success).toBe(true);
    expect((result.output as GitHubReadFileOutput).content).toBe("Hello AgentOS");
  });

  it("searches code and normalizes GitHub search results", async () => {
    const fetchImplementation = vi.fn<GitHubFetch>(async (input) => {
      expect(String(input)).toContain("/search/code");
      expect(String(input)).toContain("repo%3Aagentos%2Fagentos");

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
    });
    const { registry, context } = createMockedConnector(fetchImplementation);
    const tool = registry.findToolById("tool-github-search-code") as RegisteredTool;
    const result = await tool.execute(
      {
        query: "defineAgent",
        owner: "agentos",
        repo: "agentos",
      },
      context
    );

    expect(result.success).toBe(true);
    expect((result.output as GitHubSearchCodeOutput).items[0]?.path).toBe(
      "packages/sdk/src/index.ts"
    );
  });

  it("lists and fetches issues", async () => {
    const fetchImplementation = vi.fn<GitHubFetch>(async (input) => {
      if (String(input).endsWith("/issues/42")) {
        return jsonResponse({
          id: 42,
          number: 42,
          title: "Improve docs",
          state: "open",
          user: { login: "octocat" },
          labels: [{ name: "documentation" }],
        });
      }

      return jsonResponse([
        {
          id: 1,
          number: 1,
          title: "First issue",
          state: "open",
          user: { login: "octocat" },
          labels: ["bug"],
        },
      ]);
    });
    const { registry, context } = createMockedConnector(fetchImplementation);
    const listTool = registry.findToolById("tool-github-list-issues") as RegisteredTool;
    const getTool = registry.findToolById("tool-github-get-issue") as RegisteredTool;
    const listResult = await listTool.execute({ owner: "agentos", repo: "agentos" }, context);
    const getResult = await getTool.execute(
      { owner: "agentos", repo: "agentos", issueNumber: 42 },
      context
    );

    expect(listResult.success).toBe(true);
    expect((listResult.output as { issues: GitHubIssueOutput[] }).issues[0]?.title).toBe(
      "First issue"
    );
    expect(getResult.success).toBe(true);
    expect((getResult.output as GitHubIssueOutput).labels).toEqual(["documentation"]);
  });

  it("handles GitHub rate limits and unauthorized responses", async () => {
    const rateLimitedFetch = vi.fn<GitHubFetch>(async () =>
      jsonResponse(
        {
          message: "API rate limit exceeded",
        },
        {
          status: 403,
          headers: {
            "x-ratelimit-remaining": "0",
          },
        }
      )
    );
    const unauthorizedFetch = vi.fn<GitHubFetch>(async () =>
      jsonResponse(
        {
          message: "Bad credentials",
        },
        {
          status: 401,
        }
      )
    );

    for (const [fetchImplementation, code] of [
      [rateLimitedFetch, "github_rate_limited"],
      [unauthorizedFetch, "github_unauthorized"],
    ] as const) {
      const { registry, context } = createMockedConnector(fetchImplementation);
      const tool = registry.findToolById("tool-github-get-repository") as RegisteredTool;
      const result = await tool.execute({ owner: "agentos", repo: "agentos" }, context);

      expect(result.success).toBe(false);
      expect(result.errors[0]?.code).toBe(code);
      expect(JSON.stringify(result)).not.toContain(TEST_TOKEN);
    }
  });

  it("returns a typed error when credentials cannot be resolved", async () => {
    const fetchImplementation = vi.fn<GitHubFetch>();
    const registry = new AgentOSRegistry();
    const connector = createGitHubConnector({
      credential: {
        type: CredentialType.Environment,
        name: "GITHUB_TOKEN",
      },
      credentialResolver: new CredentialResolver({
        environment: {},
      }),
      fetchImplementation,
    });

    expect(registry.registerConnectorBundle(connector).success).toBe(true);

    const tool = registry.findToolById("tool-github-get-repository") as RegisteredTool;
    const result = await tool.execute(
      { owner: "agentos", repo: "agentos" },
      createContext(registry)
    );

    expect(result.success).toBe(false);
    expect(result.errors[0]?.code).toBe("github_credential_unavailable");
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("resolves bundled tools through ToolResolver", async () => {
    const fetchImplementation = vi.fn<GitHubFetch>(async () =>
      jsonResponse({
        id: 1,
        name: "agentos",
        full_name: "agentos/agentos",
        private: false,
      })
    );
    const { registry, context } = createMockedConnector(fetchImplementation);
    const resolver = new ToolResolver({
      registry,
    });
    const resolution = resolver.resolve({
      toolId: "tool-github-get-repository",
    });

    expect(resolution.success).toBe(true);

    const result = await resolution.tool!.execute(
      {
        owner: "agentos",
        repo: "agentos",
      },
      context
    );

    expect(result.success).toBe(true);
    expect((result.output as GitHubRepositoryOutput).name).toBe("agentos");
  });

  it("keeps write tools explicit and policy-gated", () => {
    const connector = createGitHubConnector({
      credential: {
        type: CredentialType.Static,
        value: TEST_TOKEN,
      },
      enableWrites: true,
      fetchImplementation: vi.fn<GitHubFetch>(),
    });
    const registry = new AgentOSRegistry();
    const registration = registry.registerConnectorBundle(connector);

    expect(
      connector.capabilities.tools.some((tool) => tool.id === "tool-github-create-issue")
    ).toBe(true);
    expect(connector.security?.riskLevel).toBe(ConnectorRiskLevel.High);
    expect(registration.success).toBe(false);
  });
});
