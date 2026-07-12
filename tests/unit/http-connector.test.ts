import { describe, expect, it, vi } from "vitest";
import {
  AgentOSRegistry,
  ConnectorPermission,
  ConnectorRiskLevel,
  ConnectorTrustLevel,
  MemoryScope,
  MemoryType,
  SecurityPolicyEngine,
  createHttpConnector,
  createTask,
  type Agent,
  type ExecutionContext,
  type HttpFetch,
  type HttpResolveHost,
  type HttpGetOutput,
  type RegisteredTool,
} from "@agentosdev/sdk";

function createContext(registry: AgentOSRegistry): ExecutionContext {
  const agent: Agent = {
    id: "http-test-agent",
    name: "HTTP Test Agent",
    description: "Tests HTTP connector tools.",
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

  return {
    agent,
    task: createTask({
      input: "http test",
    }),
    memory: [],
    resources: registry.listResources(),
    variables: {},
    environment: {},
  };
}

function registerHttpConnector(fetchImplementation: HttpFetch, maxResponseBytes = 1024) {
  const resolveHost: HttpResolveHost = async () => ["93.184.216.34"];
  const registry = new AgentOSRegistry();
  const connector = createHttpConnector({
    allowlist: ["https://example.com"],
    timeoutMs: 10,
    maxResponseBytes,
    fetchImplementation,
    resolveHost,
  });
  const registration = registry.registerConnectorBundle(connector);

  if (!registration.success) {
    throw new Error(registration.error?.message ?? "Expected HTTP connector registration.");
  }

  const tool = registry.findToolById("tool-http-get");

  if (!tool) {
    throw new Error("Expected HttpGetTool to be registered.");
  }

  return {
    connector,
    registry,
    tool,
    context: createContext(registry),
  };
}

describe("HttpConnector", () => {
  it("registers a bundle with network and retrieval capabilities", () => {
    const fetchImplementation = vi.fn<HttpFetch>();
    const { connector, registry } = registerHttpConnector(fetchImplementation);

    expect(registry.summary()).toMatchObject({
      capabilities: 2,
      connectors: 1,
      tools: 1,
      resources: 1,
    });
    expect(connector.security).toMatchObject({
      riskLevel: ConnectorRiskLevel.Medium,
      trustLevel: ConnectorTrustLevel.Remote,
      permissions: [ConnectorPermission.NetworkAccess],
      networkAccess: true,
      filesystemAccess: false,
      secretsAccess: false,
    });
  });

  it("performs an allowlisted HTTPS GET request", async () => {
    const fetchImplementation = vi.fn<HttpFetch>(async (_input, init) => {
      expect(init?.method).toBe("GET");
      expect(init?.redirect).toBe("manual");

      return new Response("hello from example", {
        status: 200,
        statusText: "OK",
        headers: {
          "content-type": "text/plain",
          "set-cookie": "secret=value",
        },
      });
    });
    const { tool, context } = registerHttpConnector(fetchImplementation);
    const result = await tool.execute(
      {
        url: "https://example.com/status",
        headers: {
          accept: "text/plain",
        },
      },
      context
    );

    expect(result.success).toBe(true);
    expect(fetchImplementation).toHaveBeenCalledOnce();
    expect((result.output as HttpGetOutput).body).toBe("hello from example");
    expect((result.output as HttpGetOutput).headers["set-cookie"]).toBe("[redacted]");
    expect(result.metadata?.requestHeaders).toEqual({
      accept: "text/plain",
    });
  });

  it("rejects hosts outside the allowlist", async () => {
    const fetchImplementation = vi.fn<HttpFetch>();
    const { tool, context } = registerHttpConnector(fetchImplementation);
    const result = await tool.execute(
      {
        url: "https://not-allowed.example/status",
      },
      context
    );

    expect(result.success).toBe(false);
    expect(result.errors[0]?.code).toBe("http_host_not_allowlisted");
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("rejects non-HTTPS URLs", async () => {
    const fetchImplementation = vi.fn<HttpFetch>();
    const { tool, context } = registerHttpConnector(fetchImplementation);
    const result = await tool.execute(
      {
        url: "http://example.com/status",
      },
      context
    );

    expect(result.success).toBe(false);
    expect(result.errors[0]?.code).toBe("http_insecure_protocol_denied");
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("rejects localhost and private network targets", async () => {
    const fetchImplementation = vi.fn<HttpFetch>();
    const registry = new AgentOSRegistry();
    const connector = createHttpConnector({
      allowlist: ["https://localhost", "https://127.0.0.1", "https://192.168.1.20"],
      timeoutMs: 10,
      maxResponseBytes: 1024,
      fetchImplementation,
      resolveHost: async () => ["93.184.216.34"],
    });

    expect(registry.registerConnectorBundle(connector).success).toBe(true);

    const tool = registry.findToolById("tool-http-get") as RegisteredTool;
    const context = createContext(registry);

    for (const url of [
      "https://localhost/status",
      "https://127.0.0.1/status",
      "https://192.168.1.20/status",
    ]) {
      const result = await tool.execute(
        {
          url,
        },
        context
      );

      expect(result.success).toBe(false);
      expect(result.errors[0]?.code).toBe("http_private_network_denied");
    }

    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("rejects redirects", async () => {
    const fetchImplementation = vi.fn<HttpFetch>(
      async () =>
        new Response("", {
          status: 302,
          headers: {
            location: "https://example.com/next",
          },
        })
    );
    const { tool, context } = registerHttpConnector(fetchImplementation);
    const result = await tool.execute(
      {
        url: "https://example.com/redirect",
      },
      context
    );

    expect(result.success).toBe(false);
    expect(result.errors[0]?.code).toBe("http_redirect_denied");
  });

  it("enforces request timeout", async () => {
    const fetchImplementation = vi.fn<HttpFetch>(() => new Promise<Response>(() => undefined));
    const { tool, context } = registerHttpConnector(fetchImplementation);
    const result = await tool.execute(
      {
        url: "https://example.com/slow",
      },
      context
    );

    expect(result.success).toBe(false);
    expect(result.errors[0]?.code).toBe("http_timeout");
  });

  it("enforces response size limits", async () => {
    const fetchImplementation = vi.fn<HttpFetch>(
      async () =>
        new Response("this response is too large", {
          status: 200,
        })
    );
    const { tool, context } = registerHttpConnector(fetchImplementation, 4);
    const result = await tool.execute(
      {
        url: "https://example.com/large",
      },
      context
    );

    expect(result.success).toBe(false);
    expect(result.errors[0]?.code).toBe("http_response_too_large");
  });

  it("rejects sensitive request headers", async () => {
    const fetchImplementation = vi.fn<HttpFetch>();
    const { tool, context } = registerHttpConnector(fetchImplementation);
    const result = await tool.execute(
      {
        url: "https://example.com/status",
        headers: {
          authorization: "Bearer secret",
        },
      },
      context
    );

    expect(result.success).toBe(false);
    expect(result.errors[0]?.code).toBe("http_sensitive_header_denied");
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("rejects credentials embedded in URLs", async () => {
    const fetchImplementation = vi.fn<HttpFetch>();
    const { tool, context } = registerHttpConnector(fetchImplementation);
    const result = await tool.execute(
      {
        url: "https://user:password@example.com/status",
      },
      context
    );

    expect(result.success).toBe(false);
    expect(result.errors[0]?.code).toBe("http_credentials_denied");
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("rejects allowlisted hosts that resolve to private network addresses", async () => {
    const fetchImplementation = vi.fn<HttpFetch>();
    const registry = new AgentOSRegistry();
    const connector = createHttpConnector({
      allowlist: ["https://private.example"],
      timeoutMs: 10,
      maxResponseBytes: 1024,
      fetchImplementation,
      resolveHost: async () => ["10.0.0.12"],
    });

    expect(registry.registerConnectorBundle(connector).success).toBe(true);

    const tool = registry.findToolById("tool-http-get") as RegisteredTool;
    const result = await tool.execute(
      {
        url: "https://private.example/status",
      },
      createContext(registry)
    );

    expect(result.success).toBe(false);
    expect(result.errors[0]?.code).toBe("http_private_network_denied");
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("is compatible with default policy and rejected by enterprise network policy", () => {
    const fetchImplementation = vi.fn<HttpFetch>();
    const connector = createHttpConnector({
      allowlist: ["https://example.com"],
      fetchImplementation,
      resolveHost: async () => ["93.184.216.34"],
    });

    expect(new SecurityPolicyEngine().evaluateConnector(connector).decision).toBe("allow");
    expect(SecurityPolicyEngine.enterprisePolicy().evaluateConnector(connector).decision).toBe(
      "deny"
    );

    const registry = new AgentOSRegistry({
      securityPolicyEngine: SecurityPolicyEngine.enterprisePolicy(),
    });
    const result = registry.registerConnectorBundle(connector);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("registry_connector_denied_by_policy");
  });
});
