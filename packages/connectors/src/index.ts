import { lookup } from "node:dns/promises";
import { mkdir, readdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import path from "node:path";
import {
  CredentialResolver,
  defineConnector,
  defineTool,
  type ConnectorDefinition,
  type CredentialResolverOptions,
  type ToolDefinition,
} from "@agentos/core";
import {
  CapabilityCategory,
  ConnectorAuthType,
  ConnectorPermission,
  ConnectorRiskLevel,
  ConnectorTrustLevel,
  ResourceType,
  ToolCategory,
  ToolPermissionLevel,
  type AgentOSError,
  type CredentialReference,
  type ToolExecutionResult,
} from "@agentos/types";

export const agentOSConnectors = {
  name: "@agentos/connectors",
  description: "Provider-agnostic connector package for AgentOS.",
} as const;

export interface FilesystemConnectorOptions {
  workspaceRoot: string;
  id?: string;
  name?: string;
  description?: string;
  version?: string;
}

export type HttpFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;
export type HttpResolveHost = (hostname: string) => Promise<string[]>;

export interface HttpConnectorOptions {
  allowlist: string[];
  timeoutMs?: number;
  maxResponseBytes?: number;
  id?: string;
  name?: string;
  description?: string;
  version?: string;
  fetchImplementation?: HttpFetch;
  resolveHost?: HttpResolveHost;
}

export type GitHubFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface GitHubConnectorOptions {
  credential: CredentialReference;
  id?: string;
  name?: string;
  description?: string;
  version?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
  enableWrites?: boolean;
  fetchImplementation?: GitHubFetch;
  credentialResolver?: CredentialResolver;
  credentialResolverOptions?: CredentialResolverOptions;
  userAgent?: string;
}

export interface ListFilesInput {
  directory?: string;
  recursive?: boolean;
}

export interface FileEntry {
  path: string;
  type: "file" | "directory";
  size?: number;
  modifiedAt?: string;
}

export interface ListFilesOutput {
  workspaceRoot: string;
  directory: string;
  entries: FileEntry[];
}

export interface ReadFileInput {
  path: string;
}

export interface ReadFileOutput {
  path: string;
  content: string;
  size: number;
  modifiedAt: string;
}

export interface WriteFileInput {
  path: string;
  content: string;
  overwrite?: boolean;
}

export interface WriteFileOutput {
  path: string;
  bytesWritten: number;
  overwritten: boolean;
}

export interface SearchFilesInput {
  query: string;
  directory?: string;
  extension?: string;
}

export interface SearchMatch {
  path: string;
  line: number;
  preview: string;
}

export interface SearchFilesOutput {
  query: string;
  directory: string;
  matches: SearchMatch[];
  searchedFiles: number;
  skippedFiles: number;
}

export interface HttpGetInput {
  url: string;
  headers?: Record<string, string>;
}

export interface HttpGetOutput {
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  bytesRead: number;
}

export interface GitHubRepositoryInput {
  owner: string;
  repo: string;
}

export interface GitHubRepositoryOutput {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch?: string;
  description?: string;
  htmlUrl?: string;
  visibility?: string;
  owner?: string;
}

export interface GitHubListRepositoriesInput {
  owner?: string;
  organization?: string;
  visibility?: "all" | "public" | "private";
  perPage?: number;
  page?: number;
}

export interface GitHubListRepositoriesOutput {
  repositories: GitHubRepositoryOutput[];
}

export interface GitHubReadFileInput extends GitHubRepositoryInput {
  path: string;
  ref?: string;
}

export interface GitHubReadFileOutput {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
  encoding?: string;
  content: string;
  size: number;
  sha?: string;
  htmlUrl?: string;
}

export interface GitHubSearchCodeInput {
  query: string;
  owner?: string;
  repo?: string;
  language?: string;
  perPage?: number;
  page?: number;
}

export interface GitHubSearchCodeResult {
  name: string;
  path: string;
  repository: string;
  htmlUrl?: string;
  score?: number;
}

export interface GitHubSearchCodeOutput {
  totalCount: number;
  incompleteResults: boolean;
  items: GitHubSearchCodeResult[];
}

export interface GitHubListIssuesInput extends GitHubRepositoryInput {
  state?: "open" | "closed" | "all";
  perPage?: number;
  page?: number;
}

export interface GitHubIssueOutput {
  id: number;
  number: number;
  title: string;
  state: string;
  htmlUrl?: string;
  user?: string;
  labels: string[];
  createdAt?: string;
  updatedAt?: string;
  body?: string;
}

export interface GitHubListIssuesOutput {
  issues: GitHubIssueOutput[];
}

export interface GitHubGetIssueInput extends GitHubRepositoryInput {
  issueNumber: number;
}

export interface GitHubCreateIssueInput extends GitHubRepositoryInput {
  title: string;
  body?: string;
  labels?: string[];
}

export interface GitHubCreateIssueOutput {
  issue: GitHubIssueOutput;
}

interface SafePathResult {
  success: boolean;
  absolutePath?: string;
  relativePath?: string;
  error?: AgentOSError;
}

interface SafeHttpUrlResult {
  success: boolean;
  url?: URL;
  error?: AgentOSError;
}

interface HttpBodyResult {
  body: string;
  bytesRead: number;
}

const MAX_LIST_ENTRIES = 1000;
const MAX_SEARCH_FILE_SIZE_BYTES = 1024 * 1024;
const DEFAULT_HTTP_TIMEOUT_MS = 5000;
const DEFAULT_HTTP_MAX_RESPONSE_BYTES = 1024 * 1024;
const DEFAULT_GITHUB_BASE_URL = "https://api.github.com";
const DEFAULT_GITHUB_TIMEOUT_MS = 5000;
const DEFAULT_GITHUB_MAX_RESPONSE_BYTES = 1024 * 1024;
const DEFAULT_GITHUB_PER_PAGE = 30;
const SENSITIVE_HEADER_NAMES = new Set([
  "authorization",
  "cookie",
  "proxy-authorization",
  "set-cookie",
  "x-api-key",
  "x-auth-token",
]);
const TEXT_EXTENSIONS = new Set([
  ".css",
  ".csv",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".log",
  ".md",
  ".mdx",
  ".mjs",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);

export function createFilesystemConnector(
  options: FilesystemConnectorOptions
): ConnectorDefinition {
  if (!options.workspaceRoot?.trim()) {
    throw new Error("FilesystemConnector requires a workspaceRoot.");
  }

  const connectorId = options.id ?? "filesystem";
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const toolPrefix = `tool-${connectorId}`;

  const listFilesTool = defineTool<unknown, ListFilesOutput>({
    id: `${toolPrefix}-list-files`,
    name: "ListFilesTool",
    description: "Lists files and directories inside the configured workspace.",
    capability: "storage",
    capabilityIds: ["storage"],
    category: ToolCategory.Data,
    version: "1.0.0",
    permissionLevel: ToolPermissionLevel.Read,
    execute: async ({ input }) => {
      const startedAt = Date.now();
      const parsedInput = parseListFilesInput(input);
      const directory = parsedInput.directory ?? ".";
      const safePath = await resolveExistingPath(workspaceRoot, directory);

      if (!safePath.success) {
        return failedToolResult(startedAt, safePath.error);
      }

      const directoryStats = await stat(safePath.absolutePath!);

      if (!directoryStats.isDirectory()) {
        return failedToolResult(
          startedAt,
          createFilesystemError("filesystem_not_directory", `"${directory}" is not a directory.`)
        );
      }

      const realWorkspaceRoot = await realpath(workspaceRoot);
      const entries = await listEntries(realWorkspaceRoot, safePath.absolutePath!, {
        recursive: parsedInput.recursive ?? false,
      });

      return {
        success: true,
        output: {
          workspaceRoot,
          directory: safePath.relativePath ?? ".",
          entries,
        },
        metadata: {
          workspaceRoot,
          entryCount: entries.length,
        },
        durationMs: Date.now() - startedAt,
        errors: [],
      };
    },
  });

  const readFileTool = defineTool<unknown, ReadFileOutput>({
    id: `${toolPrefix}-read-file`,
    name: "ReadFileTool",
    description: "Reads a text file inside the configured workspace.",
    capability: "storage",
    capabilityIds: ["storage"],
    category: ToolCategory.Data,
    version: "1.0.0",
    permissionLevel: ToolPermissionLevel.Read,
    execute: async ({ input }) => {
      const startedAt = Date.now();
      const parsedInput = parseReadFileInput(input);

      if (!parsedInput.path) {
        return failedToolResult(
          startedAt,
          createFilesystemError("filesystem_missing_path", "File path is required.")
        );
      }

      const safePath = await resolveExistingPath(workspaceRoot, parsedInput.path);

      if (!safePath.success) {
        return failedToolResult(startedAt, safePath.error);
      }

      const fileStats = await stat(safePath.absolutePath!);

      if (!fileStats.isFile()) {
        return failedToolResult(
          startedAt,
          createFilesystemError("filesystem_not_file", `"${parsedInput.path}" is not a file.`)
        );
      }

      const content = await readFile(safePath.absolutePath!, "utf8");

      return {
        success: true,
        output: {
          path: safePath.relativePath ?? parsedInput.path,
          content,
          size: fileStats.size,
          modifiedAt: fileStats.mtime.toISOString(),
        },
        metadata: {
          workspaceRoot,
        },
        durationMs: Date.now() - startedAt,
        errors: [],
      };
    },
  });

  const writeFileTool = defineTool<unknown, WriteFileOutput>({
    id: `${toolPrefix}-write-file`,
    name: "WriteFileTool",
    description: "Writes a text file inside the configured workspace.",
    capability: "storage",
    capabilityIds: ["storage"],
    category: ToolCategory.Data,
    version: "1.0.0",
    permissionLevel: ToolPermissionLevel.Write,
    execute: async ({ input }) => {
      const startedAt = Date.now();
      const parsedInput = parseWriteFileInput(input);

      if (!parsedInput.path) {
        return failedToolResult(
          startedAt,
          createFilesystemError("filesystem_missing_path", "File path is required.")
        );
      }

      if (parsedInput.content === undefined) {
        return failedToolResult(
          startedAt,
          createFilesystemError("filesystem_missing_content", "File content is required.")
        );
      }

      const safePath = await resolveWritablePath(workspaceRoot, parsedInput.path);

      if (!safePath.success) {
        return failedToolResult(startedAt, safePath.error);
      }

      const existing = await getOptionalStat(safePath.absolutePath!);

      if (existing?.isDirectory()) {
        return failedToolResult(
          startedAt,
          createFilesystemError(
            "filesystem_target_is_directory",
            `"${parsedInput.path}" is a directory.`
          )
        );
      }

      if (existing && parsedInput.overwrite !== true) {
        return failedToolResult(
          startedAt,
          createFilesystemError(
            "filesystem_file_exists",
            `"${parsedInput.path}" already exists and overwrite is false.`
          )
        );
      }

      await mkdir(path.dirname(safePath.absolutePath!), {
        recursive: true,
      });
      await writeFile(safePath.absolutePath!, parsedInput.content, "utf8");

      return {
        success: true,
        output: {
          path: safePath.relativePath ?? parsedInput.path,
          bytesWritten: Buffer.byteLength(parsedInput.content, "utf8"),
          overwritten: Boolean(existing),
        },
        metadata: {
          workspaceRoot,
        },
        durationMs: Date.now() - startedAt,
        errors: [],
      };
    },
  });

  const searchFilesTool = defineTool<unknown, SearchFilesOutput>({
    id: `${toolPrefix}-search-files`,
    name: "SearchFilesTool",
    description: "Searches text files inside the configured workspace.",
    capability: "search",
    capabilityIds: ["search", "storage"],
    category: ToolCategory.Data,
    version: "1.0.0",
    permissionLevel: ToolPermissionLevel.Read,
    execute: async ({ input }) => {
      const startedAt = Date.now();
      const parsedInput = parseSearchFilesInput(input);
      const query = parsedInput.query?.trim();

      if (!query) {
        return failedToolResult(
          startedAt,
          createFilesystemError("filesystem_missing_query", "Search query is required.")
        );
      }

      const directory = parsedInput.directory ?? ".";
      const safePath = await resolveExistingPath(workspaceRoot, directory);

      if (!safePath.success) {
        return failedToolResult(startedAt, safePath.error);
      }

      const directoryStats = await stat(safePath.absolutePath!);

      if (!directoryStats.isDirectory()) {
        return failedToolResult(
          startedAt,
          createFilesystemError("filesystem_not_directory", `"${directory}" is not a directory.`)
        );
      }

      const realWorkspaceRoot = await realpath(workspaceRoot);
      const search = await searchFiles(realWorkspaceRoot, safePath.absolutePath!, query, {
        extension: parsedInput.extension,
      });

      return {
        success: true,
        output: {
          query,
          directory: safePath.relativePath ?? ".",
          matches: search.matches,
          searchedFiles: search.searchedFiles,
          skippedFiles: search.skippedFiles,
        },
        metadata: {
          workspaceRoot,
          maxFileSizeBytes: MAX_SEARCH_FILE_SIZE_BYTES,
        },
        durationMs: Date.now() - startedAt,
        errors: [],
      };
    },
  });

  return defineConnector({
    id: connectorId,
    name: options.name ?? "Filesystem Connector",
    description:
      options.description ??
      "Safely reads, writes, lists, and searches files inside a configured local workspace.",
    version: options.version ?? "1.0.0",
    capabilities: [
      {
        id: "storage",
        name: "Storage",
        description: "Read, write, and list local workspace files.",
        category: CapabilityCategory.Storage,
        supportedConnectors: [connectorId],
      },
      {
        id: "search",
        name: "Search",
        description: "Search local workspace text files.",
        category: CapabilityCategory.Search,
        supportedConnectors: [connectorId],
      },
    ],
    tools: [listFilesTool, readFileTool, writeFileTool, searchFilesTool],
    resources: [
      {
        id: `${connectorId}-workspace`,
        type: ResourceType.Repository,
        source: connectorId,
        uri: `file://${workspaceRoot}`,
        metadata: {
          workspaceRoot,
          local: true,
        },
      },
    ],
    tags: ["filesystem", "storage", "search", "local"],
    security: {
      riskLevel: ConnectorRiskLevel.Medium,
      trustLevel: ConnectorTrustLevel.Local,
      permissions: [ConnectorPermission.ReadFiles, ConnectorPermission.WriteFiles],
      requiresUserApproval: false,
      networkAccess: false,
      filesystemAccess: true,
      secretsAccess: false,
      metadata: {
        workspaceRoot,
        boundary: "workspaceRoot",
      },
    },
    metadata: {
      workspaceRoot,
      safety: "workspace-root-confined",
    },
    health() {
      return {
        healthy: true,
        metadata: {
          workspaceRoot,
        },
      };
    },
  });
}

export function createHttpConnector(options: HttpConnectorOptions): ConnectorDefinition {
  if (!options.allowlist?.length) {
    throw new Error("HttpConnector requires at least one allowlisted HTTPS origin.");
  }

  const connectorId = options.id ?? "http";
  const timeoutMs = options.timeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS;
  const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_HTTP_MAX_RESPONSE_BYTES;
  const allowlist = normalizeHttpAllowlist(options.allowlist);
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const resolveHost = options.resolveHost ?? resolveHostWithDNS;

  if (timeoutMs <= 0) {
    throw new Error("HttpConnector timeoutMs must be greater than zero.");
  }

  if (maxResponseBytes <= 0) {
    throw new Error("HttpConnector maxResponseBytes must be greater than zero.");
  }

  const httpGetTool = defineTool<unknown, HttpGetOutput>({
    id: `tool-${connectorId}-get`,
    name: "HttpGetTool",
    description: "Performs a safe HTTPS GET request to an allowlisted origin.",
    capability: "retrieval",
    capabilityIds: ["network", "retrieval"],
    category: ToolCategory.Data,
    version: "1.0.0",
    permissionLevel: ToolPermissionLevel.Read,
    execute: async ({ input }) => {
      const startedAt = Date.now();
      const parsedInput = parseHttpGetInput(input);
      const safeUrl = await validateHttpUrl(parsedInput.url, allowlist, resolveHost);

      if (!safeUrl.success) {
        return failedHttpToolResult(startedAt, safeUrl.error);
      }

      const headers = sanitizeRequestHeaders(parsedInput.headers);

      if (!headers.success) {
        return failedHttpToolResult(startedAt, headers.error);
      }

      const controller = new AbortController();
      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      try {
        const timeout = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            controller.abort();
            reject(createHttpToolError("http_timeout", "HTTP GET request exceeded timeout."));
          }, timeoutMs);
        });
        const response = await Promise.race([
          fetchImplementation(safeUrl.url!, {
            method: "GET",
            headers: headers.headers,
            redirect: "manual",
            signal: controller.signal,
          }),
          timeout,
        ]);

        if (response.status >= 300 && response.status < 400) {
          return failedHttpToolResult(
            startedAt,
            createHttpToolError("http_redirect_denied", "HTTP redirects are not allowed.")
          );
        }

        const body = await readHttpBody(response, maxResponseBytes);

        return {
          success: true,
          output: {
            url: safeUrl.url!.toString(),
            status: response.status,
            statusText: response.statusText,
            headers: safeResponseHeaders(response.headers),
            body: body.body,
            bytesRead: body.bytesRead,
          },
          metadata: {
            allowlist: [...allowlist],
            timeoutMs,
            maxResponseBytes,
            requestHeaders: redactHeaders(headers.headers),
          },
          durationMs: Date.now() - startedAt,
          errors: [],
        };
      } catch (error) {
        return failedHttpToolResult(startedAt, normalizeHttpError(error));
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    },
  });

  return defineConnector({
    id: connectorId,
    name: options.name ?? "HTTP Connector",
    description:
      options.description ?? "Safely performs HTTPS GET requests to allowlisted origins.",
    version: options.version ?? "1.0.0",
    capabilities: [
      {
        id: "network",
        name: "Network",
        description: "Access allowlisted network resources.",
        category: CapabilityCategory.Custom,
        supportedConnectors: [connectorId],
      },
      {
        id: "retrieval",
        name: "Retrieval",
        description: "Retrieve remote content through safe GET requests.",
        category: CapabilityCategory.Search,
        supportedConnectors: [connectorId],
      },
    ],
    tools: [httpGetTool],
    resources: [
      {
        id: `${connectorId}-allowlist`,
        type: ResourceType.DatabaseRecord,
        source: connectorId,
        uri: `agentos://connectors/${connectorId}/allowlist`,
        metadata: {
          allowlist: [...allowlist],
        },
      },
    ],
    tags: ["http", "network", "retrieval", "get-only"],
    security: {
      riskLevel: ConnectorRiskLevel.Medium,
      trustLevel: ConnectorTrustLevel.Remote,
      permissions: [ConnectorPermission.NetworkAccess],
      requiresUserApproval: false,
      networkAccess: true,
      filesystemAccess: false,
      secretsAccess: false,
      metadata: {
        allowlist: [...allowlist],
        methods: ["GET"],
      },
    },
    metadata: {
      allowlist: [...allowlist],
      timeoutMs,
      maxResponseBytes,
      redirects: "disabled",
      methods: ["GET"],
    },
    health() {
      return {
        healthy: true,
        metadata: {
          allowlist: [...allowlist],
          timeoutMs,
          maxResponseBytes,
        },
      };
    },
  });
}

export function createGitHubConnector(options: GitHubConnectorOptions): ConnectorDefinition {
  const connectorId = options.id ?? "github";
  const timeoutMs = options.timeoutMs ?? DEFAULT_GITHUB_TIMEOUT_MS;
  const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_GITHUB_MAX_RESPONSE_BYTES;
  const baseUrl = normalizeGitHubBaseUrl(options.baseUrl ?? DEFAULT_GITHUB_BASE_URL);
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const credentialResolver =
    options.credentialResolver ?? new CredentialResolver(options.credentialResolverOptions);
  const credentialSummary = credentialResolver.inspectReference(options.credential);
  const userAgent = options.userAgent ?? "AgentOS-GitHubConnector/1.0";
  const enableWrites = options.enableWrites ?? false;
  const toolPrefix = `tool-${connectorId}`;
  const client = new GitHubRestClient({
    baseUrl,
    credential: options.credential,
    credentialResolver,
    fetchImplementation,
    maxResponseBytes,
    timeoutMs,
    userAgent,
  });

  if (timeoutMs <= 0) {
    throw new Error("GitHubConnector timeoutMs must be greater than zero.");
  }

  if (maxResponseBytes <= 0) {
    throw new Error("GitHubConnector maxResponseBytes must be greater than zero.");
  }

  const getRepositoryTool = defineTool<unknown, GitHubRepositoryOutput>({
    id: `${toolPrefix}-get-repository`,
    name: "GetRepositoryTool",
    description: "Fetches GitHub repository metadata.",
    capability: "repository",
    capabilityIds: ["repository", "source-code"],
    category: ToolCategory.Data,
    version: "1.0.0",
    permissionLevel: ToolPermissionLevel.Read,
    execute: async ({ input }) => {
      const startedAt = Date.now();
      const parsedInput = parseGitHubRepositoryInput(input);
      const validation = validateRepositoryInput(parsedInput);

      if (validation) {
        return failedGitHubToolResult(startedAt, validation);
      }

      const response = await client.request({
        path: `/repos/${encodeURIComponent(parsedInput.owner!)}/${encodeURIComponent(
          parsedInput.repo!
        )}`,
      });

      return githubResultFromResponse(startedAt, response, (body) =>
        normalizeRepository(body as Record<string, unknown>)
      );
    },
  });

  const listRepositoriesTool = defineTool<unknown, GitHubListRepositoriesOutput>({
    id: `${toolPrefix}-list-repositories`,
    name: "ListRepositoriesTool",
    description: "Lists repositories visible to the authenticated token, owner, or organization.",
    capability: "repository",
    capabilityIds: ["repository", "source-code"],
    category: ToolCategory.Data,
    version: "1.0.0",
    permissionLevel: ToolPermissionLevel.Read,
    execute: async ({ input }) => {
      const startedAt = Date.now();
      const parsedInput = parseGitHubListRepositoriesInput(input);
      const perPage = normalizePerPage(parsedInput.perPage);
      const page = normalizePage(parsedInput.page);
      let path = `/user/repos?per_page=${perPage}&page=${page}&visibility=${
        parsedInput.visibility ?? "all"
      }`;

      if (parsedInput.organization) {
        path = `/orgs/${encodeURIComponent(parsedInput.organization)}/repos?per_page=${perPage}&page=${page}`;
      } else if (parsedInput.owner) {
        path = `/users/${encodeURIComponent(parsedInput.owner)}/repos?per_page=${perPage}&page=${page}`;
      }

      const response = await client.request({ path });

      return githubResultFromResponse(startedAt, response, (body) => ({
        repositories: Array.isArray(body)
          ? body.map((repository) => normalizeRepository(repository as Record<string, unknown>))
          : [],
      }));
    },
  });

  const readFileTool = defineTool<unknown, GitHubReadFileOutput>({
    id: `${toolPrefix}-read-file`,
    name: "ReadFileTool",
    description: "Reads a file from a GitHub repository.",
    capability: "source-code",
    capabilityIds: ["source-code", "repository"],
    category: ToolCategory.Data,
    version: "1.0.0",
    permissionLevel: ToolPermissionLevel.Read,
    execute: async ({ input }) => {
      const startedAt = Date.now();
      const parsedInput = parseGitHubReadFileInput(input);
      const validation = validateRepositoryInput(parsedInput);

      if (validation) {
        return failedGitHubToolResult(startedAt, validation);
      }

      if (!parsedInput.path?.trim()) {
        return failedGitHubToolResult(
          startedAt,
          createGitHubError("github_missing_path", "GitHub file path is required.")
        );
      }

      const query = parsedInput.ref ? `?ref=${encodeURIComponent(parsedInput.ref)}` : "";
      const response = await client.request({
        path: `/repos/${encodeURIComponent(parsedInput.owner!)}/${encodeURIComponent(
          parsedInput.repo!
        )}/contents/${encodePathSegments(parsedInput.path)}${query}`,
      });

      return githubResultFromResponse(startedAt, response, (body) =>
        normalizeGitHubFile(body as Record<string, unknown>, parsedInput as GitHubReadFileInput)
      );
    },
  });

  const searchCodeTool = defineTool<unknown, GitHubSearchCodeOutput>({
    id: `${toolPrefix}-search-code`,
    name: "SearchCodeTool",
    description: "Searches GitHub source code through the GitHub REST API.",
    capability: "search",
    capabilityIds: ["search", "source-code"],
    category: ToolCategory.Data,
    version: "1.0.0",
    permissionLevel: ToolPermissionLevel.Read,
    execute: async ({ input }) => {
      const startedAt = Date.now();
      const parsedInput = parseGitHubSearchCodeInput(input);
      const query = buildGitHubSearchQuery(parsedInput);

      if (!query) {
        return failedGitHubToolResult(
          startedAt,
          createGitHubError("github_missing_query", "GitHub code search query is required.")
        );
      }

      const response = await client.request({
        path: `/search/code?q=${encodeURIComponent(query)}&per_page=${normalizePerPage(
          parsedInput.perPage
        )}&page=${normalizePage(parsedInput.page)}`,
      });

      return githubResultFromResponse(startedAt, response, normalizeSearchCodeOutput);
    },
  });

  const listIssuesTool = defineTool<unknown, GitHubListIssuesOutput>({
    id: `${toolPrefix}-list-issues`,
    name: "ListIssuesTool",
    description: "Lists issues for a GitHub repository.",
    capability: "issues",
    capabilityIds: ["issues", "repository"],
    category: ToolCategory.Data,
    version: "1.0.0",
    permissionLevel: ToolPermissionLevel.Read,
    execute: async ({ input }) => {
      const startedAt = Date.now();
      const parsedInput = parseGitHubListIssuesInput(input);
      const validation = validateRepositoryInput(parsedInput);

      if (validation) {
        return failedGitHubToolResult(startedAt, validation);
      }

      const response = await client.request({
        path: `/repos/${encodeURIComponent(parsedInput.owner!)}/${encodeURIComponent(
          parsedInput.repo!
        )}/issues?state=${parsedInput.state ?? "open"}&per_page=${normalizePerPage(
          parsedInput.perPage
        )}&page=${normalizePage(parsedInput.page)}`,
      });

      return githubResultFromResponse(startedAt, response, (body) => ({
        issues: Array.isArray(body)
          ? body.map((issue) => normalizeIssue(issue as Record<string, unknown>))
          : [],
      }));
    },
  });

  const getIssueTool = defineTool<unknown, GitHubIssueOutput>({
    id: `${toolPrefix}-get-issue`,
    name: "GetIssueTool",
    description: "Fetches one GitHub issue by number.",
    capability: "issues",
    capabilityIds: ["issues", "repository"],
    category: ToolCategory.Data,
    version: "1.0.0",
    permissionLevel: ToolPermissionLevel.Read,
    execute: async ({ input }) => {
      const startedAt = Date.now();
      const parsedInput = parseGitHubGetIssueInput(input);
      const validation = validateRepositoryInput(parsedInput);

      if (validation) {
        return failedGitHubToolResult(startedAt, validation);
      }

      if (!parsedInput.issueNumber || parsedInput.issueNumber <= 0) {
        return failedGitHubToolResult(
          startedAt,
          createGitHubError("github_invalid_issue_number", "GitHub issueNumber must be positive.")
        );
      }

      const response = await client.request({
        path: `/repos/${encodeURIComponent(parsedInput.owner!)}/${encodeURIComponent(
          parsedInput.repo!
        )}/issues/${parsedInput.issueNumber}`,
      });

      return githubResultFromResponse(startedAt, response, (body) =>
        normalizeIssue(body as Record<string, unknown>)
      );
    },
  });

  const tools: ToolDefinition[] = [
    getRepositoryTool,
    listRepositoriesTool,
    readFileTool,
    searchCodeTool,
    listIssuesTool,
    getIssueTool,
  ];

  if (enableWrites) {
    tools.push(
      defineTool<unknown, GitHubCreateIssueOutput>({
        id: `${toolPrefix}-create-issue`,
        name: "CreateIssueTool",
        description: "Creates a GitHub issue. This tool is only available when writes are enabled.",
        capability: "issues",
        capabilityIds: ["issues", "repository"],
        category: ToolCategory.Data,
        version: "1.0.0",
        permissionLevel: ToolPermissionLevel.Write,
        execute: async ({ input }) => {
          const startedAt = Date.now();
          const parsedInput = parseGitHubCreateIssueInput(input);
          const validation = validateRepositoryInput(parsedInput);

          if (validation) {
            return failedGitHubToolResult(startedAt, validation);
          }

          if (!parsedInput.title?.trim()) {
            return failedGitHubToolResult(
              startedAt,
              createGitHubError("github_missing_issue_title", "GitHub issue title is required.")
            );
          }

          const response = await client.request({
            method: "POST",
            path: `/repos/${encodeURIComponent(parsedInput.owner!)}/${encodeURIComponent(
              parsedInput.repo!
            )}/issues`,
            body: {
              title: parsedInput.title,
              body: parsedInput.body,
              labels: parsedInput.labels,
            },
          });

          return githubResultFromResponse(startedAt, response, (body) => ({
            issue: normalizeIssue(body as Record<string, unknown>),
          }));
        },
      })
    );
  }

  return defineConnector({
    id: connectorId,
    name: options.name ?? "GitHub Connector",
    description:
      options.description ??
      "Production GitHub REST connector for safe repository, source-code, issue, and search operations.",
    version: options.version ?? "1.0.0",
    authType: ConnectorAuthType.ApiKey,
    capabilities: [
      {
        id: "repository",
        name: "Repository",
        description: "Read GitHub repository metadata.",
        category: CapabilityCategory.Custom,
        supportedConnectors: [connectorId],
      },
      {
        id: "source-code",
        name: "Source Code",
        description: "Read and search GitHub source code.",
        category: CapabilityCategory.Custom,
        supportedConnectors: [connectorId],
      },
      {
        id: "issues",
        name: "Issues",
        description: "Read GitHub issues and optionally create issues when enabled.",
        category: CapabilityCategory.Community,
        supportedConnectors: [connectorId],
      },
      {
        id: "search",
        name: "Search",
        description: "Search GitHub code.",
        category: CapabilityCategory.Search,
        supportedConnectors: [connectorId],
      },
    ],
    tools,
    resources: [
      {
        id: `${connectorId}-api`,
        type: ResourceType.Repository,
        source: connectorId,
        uri: baseUrl,
        metadata: {
          provider: "github",
          baseUrl,
          writesEnabled: enableWrites,
        },
      },
    ],
    tags: ["github", "repository", "source-code", "issues", "search"],
    security: {
      riskLevel: enableWrites ? ConnectorRiskLevel.High : ConnectorRiskLevel.Medium,
      trustLevel: ConnectorTrustLevel.Remote,
      permissions: [
        ConnectorPermission.NetworkAccess,
        ConnectorPermission.ExternalAPI,
        ConnectorPermission.SecretsAccess,
      ],
      requiresUserApproval: enableWrites,
      networkAccess: true,
      filesystemAccess: false,
      secretsAccess: true,
      metadata: {
        provider: "github",
        writesEnabled: enableWrites,
        methods: enableWrites ? ["GET", "POST"] : ["GET"],
      },
    },
    metadata: {
      provider: "github",
      baseUrl,
      timeoutMs,
      maxResponseBytes,
      writesEnabled: enableWrites,
      credential: credentialSummary,
    },
    health() {
      return {
        healthy: true,
        metadata: {
          baseUrl,
          timeoutMs,
          maxResponseBytes,
          writesEnabled: enableWrites,
          credential: credentialSummary,
        },
      };
    },
  });
}

interface GitHubRequestInput {
  method?: "GET" | "POST";
  path: string;
  body?: Record<string, unknown>;
}

interface GitHubResponseResult {
  success: boolean;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: unknown;
  error?: AgentOSError;
  rateLimit?: {
    limit?: string;
    remaining?: string;
    reset?: string;
  };
}

interface GitHubRestClientOptions {
  baseUrl: string;
  credential: CredentialReference;
  credentialResolver: CredentialResolver;
  fetchImplementation: GitHubFetch;
  maxResponseBytes: number;
  timeoutMs: number;
  userAgent: string;
}

class GitHubRestClient {
  private readonly baseUrl: string;
  private readonly credential: CredentialReference;
  private readonly credentialResolver: CredentialResolver;
  private readonly fetchImplementation: GitHubFetch;
  private readonly maxResponseBytes: number;
  private readonly timeoutMs: number;
  private readonly userAgent: string;

  constructor(options: GitHubRestClientOptions) {
    this.baseUrl = options.baseUrl;
    this.credential = options.credential;
    this.credentialResolver = options.credentialResolver;
    this.fetchImplementation = options.fetchImplementation;
    this.maxResponseBytes = options.maxResponseBytes;
    this.timeoutMs = options.timeoutMs;
    this.userAgent = options.userAgent;
  }

  async request(input: GitHubRequestInput): Promise<GitHubResponseResult> {
    const method = input.method ?? "GET";
    const credential = await this.credentialResolver.resolve(this.credential);

    if (!credential.success || !credential.credential) {
      return {
        success: false,
        error: createGitHubError(
          "github_credential_unavailable",
          "GitHub credential could not be resolved.",
          {
            reference: credential.reference,
            errors: credential.errors.map((error) => ({
              code: error.code,
              message: error.message,
            })),
          }
        ),
      };
    }

    const url = new URL(input.path, `${this.baseUrl}/`);
    const headers: Record<string, string> = {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${credential.credential.value}`,
      "user-agent": this.userAgent,
      "x-github-api-version": "2022-11-28",
    };
    const requestInit: RequestInit = {
      method,
      headers,
      redirect: "manual",
    };

    if (input.body) {
      headers["content-type"] = "application/json";
      requestInit.body = JSON.stringify(removeUndefinedValues(input.body));
    }

    const attempts = method === "GET" ? 2 : 1;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const response = await this.fetchWithTimeout(url, requestInit);

      if (!response.success) {
        return response;
      }

      const shouldRetry =
        method === "GET" &&
        attempt < attempts &&
        response.status !== undefined &&
        (response.status === 429 || response.status >= 500);

      if (shouldRetry) {
        await waitForRetryWindow();
        continue;
      }

      return response;
    }

    return {
      success: false,
      error: createGitHubError("github_request_failed", "GitHub request failed."),
    };
  }

  private async fetchWithTimeout(url: URL, init: RequestInit): Promise<GitHubResponseResult> {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(createGitHubError("github_timeout", "GitHub request exceeded timeout."));
        }, this.timeoutMs);
      });

      const response = await Promise.race([
        this.fetchImplementation(url, {
          ...init,
          signal: controller.signal,
        }),
        timeout,
      ]);

      if (response.status >= 300 && response.status < 400) {
        return {
          success: false,
          status: response.status,
          statusText: response.statusText,
          headers: safeResponseHeaders(response.headers),
          error: createGitHubError("github_redirect_denied", "GitHub redirects are not allowed.", {
            status: response.status,
          }),
          rateLimit: readGitHubRateLimit(response.headers),
        };
      }

      const body = await readGitHubResponseBody(response, this.maxResponseBytes);
      const rateLimit = readGitHubRateLimit(response.headers);
      const headers = safeResponseHeaders(response.headers);

      if (response.status >= 400) {
        return {
          success: false,
          status: response.status,
          statusText: response.statusText,
          headers,
          body,
          error: createGitHubHttpError(response, body, rateLimit),
          rateLimit,
        };
      }

      return {
        success: true,
        status: response.status,
        statusText: response.statusText,
        headers,
        body,
        rateLimit,
      };
    } catch (error) {
      return {
        success: false,
        error: normalizeGitHubError(error),
      };
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}

function parseGitHubRepositoryInput(input: unknown): Partial<GitHubRepositoryInput> {
  const record = asRecord(input);

  return {
    owner: readOptionalString(record.owner),
    repo: readOptionalString(record.repo),
  };
}

function parseGitHubListRepositoriesInput(input: unknown): Partial<GitHubListRepositoriesInput> {
  const record = asRecord(input);

  return {
    owner: readOptionalString(record.owner),
    organization: readOptionalString(record.organization),
    visibility: readOptionalString(record.visibility) as GitHubListRepositoriesInput["visibility"],
    perPage: readOptionalNumber(record.perPage),
    page: readOptionalNumber(record.page),
  };
}

function parseGitHubReadFileInput(input: unknown): Partial<GitHubReadFileInput> {
  const record = asRecord(input);

  return {
    ...parseGitHubRepositoryInput(input),
    path: readOptionalString(record.path),
    ref: readOptionalString(record.ref),
  };
}

function parseGitHubSearchCodeInput(input: unknown): Partial<GitHubSearchCodeInput> {
  const record = asRecord(input);

  return {
    query: readOptionalString(record.query),
    owner: readOptionalString(record.owner),
    repo: readOptionalString(record.repo),
    language: readOptionalString(record.language),
    perPage: readOptionalNumber(record.perPage),
    page: readOptionalNumber(record.page),
  };
}

function parseGitHubListIssuesInput(input: unknown): Partial<GitHubListIssuesInput> {
  const record = asRecord(input);

  return {
    ...parseGitHubRepositoryInput(input),
    state: readOptionalString(record.state) as GitHubListIssuesInput["state"],
    perPage: readOptionalNumber(record.perPage),
    page: readOptionalNumber(record.page),
  };
}

function parseGitHubGetIssueInput(input: unknown): Partial<GitHubGetIssueInput> {
  const record = asRecord(input);

  return {
    ...parseGitHubRepositoryInput(input),
    issueNumber: readOptionalNumber(record.issueNumber),
  };
}

function parseGitHubCreateIssueInput(input: unknown): Partial<GitHubCreateIssueInput> {
  const record = asRecord(input);

  return {
    ...parseGitHubRepositoryInput(input),
    title: readOptionalString(record.title),
    body: readOptionalString(record.body),
    labels: Array.isArray(record.labels)
      ? record.labels.filter((label): label is string => typeof label === "string")
      : undefined,
  };
}

function validateRepositoryInput(input: Partial<GitHubRepositoryInput>): AgentOSError | undefined {
  if (!input.owner?.trim()) {
    return createGitHubError("github_missing_owner", "GitHub repository owner is required.");
  }

  if (!input.repo?.trim()) {
    return createGitHubError("github_missing_repo", "GitHub repository name is required.");
  }

  return undefined;
}

function normalizeGitHubBaseUrl(input: string): string {
  const url = new URL(input);

  if (url.protocol !== "https:") {
    throw new Error("GitHubConnector baseUrl must use HTTPS.");
  }

  if (url.username || url.password) {
    throw new Error("GitHubConnector baseUrl must not include credentials.");
  }

  return url.origin;
}

function normalizePerPage(perPage: number | undefined): number {
  if (!perPage || !Number.isFinite(perPage)) {
    return DEFAULT_GITHUB_PER_PAGE;
  }

  return Math.min(100, Math.max(1, Math.floor(perPage)));
}

function normalizePage(page: number | undefined): number {
  if (!page || !Number.isFinite(page)) {
    return 1;
  }

  return Math.max(1, Math.floor(page));
}

function buildGitHubSearchQuery(input: Partial<GitHubSearchCodeInput>): string {
  const parts = [input.query?.trim()].filter(Boolean) as string[];

  if (input.owner && input.repo) {
    parts.push(`repo:${input.owner}/${input.repo}`);
  } else if (input.owner) {
    parts.push(`user:${input.owner}`);
  }

  if (input.language) {
    parts.push(`language:${input.language}`);
  }

  return parts.join(" ");
}

function normalizeRepository(record: Record<string, unknown>): GitHubRepositoryOutput {
  return {
    id: readNumber(record.id),
    name: readString(record.name),
    fullName: readString(record.full_name),
    private: readBoolean(record.private),
    defaultBranch: readOptionalString(record.default_branch),
    description: readOptionalString(record.description),
    htmlUrl: readOptionalString(record.html_url),
    visibility: readOptionalString(record.visibility),
    owner: readOptionalString(asRecord(record.owner).login),
  };
}

function normalizeGitHubFile(
  record: Record<string, unknown>,
  input: GitHubReadFileInput
): GitHubReadFileOutput {
  const encoding = readOptionalString(record.encoding);
  const rawContent = readString(record.content);
  const content =
    encoding === "base64"
      ? Buffer.from(rawContent.replace(/\s/g, ""), "base64").toString("utf8")
      : rawContent;

  return {
    owner: input.owner,
    repo: input.repo,
    path: readString(record.path) || input.path,
    ref: input.ref,
    encoding,
    content,
    size: readNumber(record.size),
    sha: readOptionalString(record.sha),
    htmlUrl: readOptionalString(record.html_url),
  };
}

function normalizeSearchCodeOutput(body: unknown): GitHubSearchCodeOutput {
  const record = asRecord(body);

  return {
    totalCount: readNumber(record.total_count),
    incompleteResults: readBoolean(record.incomplete_results),
    items: Array.isArray(record.items)
      ? record.items.map((item) => {
          const itemRecord = asRecord(item);
          const repository = asRecord(itemRecord.repository);

          return {
            name: readString(itemRecord.name),
            path: readString(itemRecord.path),
            repository: readString(repository.full_name),
            htmlUrl: readOptionalString(itemRecord.html_url),
            score: readOptionalNumber(itemRecord.score),
          };
        })
      : [],
  };
}

function normalizeIssue(record: Record<string, unknown>): GitHubIssueOutput {
  const user = asRecord(record.user);

  return {
    id: readNumber(record.id),
    number: readNumber(record.number),
    title: readString(record.title),
    state: readString(record.state),
    htmlUrl: readOptionalString(record.html_url),
    body: readOptionalString(record.body),
    user: readOptionalString(user.login),
    labels: Array.isArray(record.labels)
      ? record.labels
          .map((label) => {
            if (typeof label === "string") {
              return label;
            }

            return readOptionalString(asRecord(label).name);
          })
          .filter((label): label is string => Boolean(label))
      : [],
    createdAt: readOptionalString(record.created_at),
    updatedAt: readOptionalString(record.updated_at),
  };
}

function githubResultFromResponse<Output>(
  startedAt: number,
  response: GitHubResponseResult,
  normalize: (body: unknown) => Output
): ToolExecutionResult<Output> {
  if (!response.success) {
    return failedGitHubToolResult(startedAt, response.error);
  }

  try {
    return {
      success: true,
      output: normalize(response.body),
      metadata: {
        status: response.status,
        statusText: response.statusText,
        rateLimit: response.rateLimit,
      },
      durationMs: Date.now() - startedAt,
      errors: [],
    };
  } catch {
    return failedGitHubToolResult(
      startedAt,
      createGitHubError("github_malformed_response", "GitHub response shape was not recognized.")
    );
  }
}

function failedGitHubToolResult<Output>(
  startedAt: number,
  error: AgentOSError | undefined
): ToolExecutionResult<Output> {
  return {
    success: false,
    durationMs: Date.now() - startedAt,
    errors: [error ?? createGitHubError("github_unknown_error", "GitHub tool failed.")],
  };
}

async function readGitHubResponseBody(response: Response, maxResponseBytes: number) {
  const body = await readHttpBody(response, maxResponseBytes);
  const contentType = response.headers.get("content-type") ?? "";

  if (!body.body) {
    return undefined;
  }

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(body.body) as unknown;
    } catch {
      throw createGitHubError("github_invalid_json", "GitHub returned invalid JSON.");
    }
  }

  return body.body;
}

function readGitHubRateLimit(headers: Headers): GitHubResponseResult["rateLimit"] {
  return {
    limit: headers.get("x-ratelimit-limit") ?? undefined,
    remaining: headers.get("x-ratelimit-remaining") ?? undefined,
    reset: headers.get("x-ratelimit-reset") ?? undefined,
  };
}

function createGitHubHttpError(
  response: Response,
  body: unknown,
  rateLimit: GitHubResponseResult["rateLimit"]
): AgentOSError {
  if ((response.status === 403 || response.status === 429) && rateLimit?.remaining === "0") {
    return createGitHubError("github_rate_limited", "GitHub rate limit was exceeded.", {
      status: response.status,
      rateLimit,
    });
  }

  if (response.status === 401) {
    return createGitHubError("github_unauthorized", "GitHub request was unauthorized.", {
      status: response.status,
    });
  }

  if (response.status === 403) {
    return createGitHubError("github_forbidden", "GitHub request was forbidden.", {
      status: response.status,
    });
  }

  if (response.status === 404) {
    return createGitHubError("github_not_found", "GitHub resource was not found.", {
      status: response.status,
    });
  }

  const message = readOptionalString(asRecord(body).message) ?? "GitHub request failed.";

  return createGitHubError("github_http_error", message, {
    status: response.status,
  });
}

function normalizeGitHubError(error: unknown): AgentOSError {
  if (isAgentOSError(error)) {
    if (error.code === "http_response_too_large") {
      return createGitHubError("github_response_too_large", error.message);
    }

    return error;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return createGitHubError("github_timeout", "GitHub request exceeded timeout.");
  }

  return createGitHubError("github_request_failed", "GitHub request failed.");
}

function createGitHubError(
  code: string,
  message: string,
  metadata?: Record<string, unknown>
): AgentOSError {
  return {
    code,
    message,
    recoverable: true,
    metadata,
  };
}

function encodePathSegments(filePath: string): string {
  return filePath.split("/").map(encodeURIComponent).join("/");
}

function removeUndefinedValues(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

async function waitForRetryWindow(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function parseListFilesInput(input: unknown): Partial<ListFilesInput> {
  const record = asRecord(input);

  return {
    directory: readOptionalString(record.directory),
    recursive: readOptionalBoolean(record.recursive),
  };
}

function parseReadFileInput(input: unknown): Partial<ReadFileInput> {
  const record = asRecord(input);

  return {
    path: readOptionalString(record.path),
  };
}

function parseWriteFileInput(input: unknown): Partial<WriteFileInput> {
  const record = asRecord(input);

  return {
    path: readOptionalString(record.path),
    content: readOptionalString(record.content),
    overwrite: readOptionalBoolean(record.overwrite),
  };
}

function parseSearchFilesInput(input: unknown): Partial<SearchFilesInput> {
  const record = asRecord(input);

  return {
    query: readOptionalString(record.query),
    directory: readOptionalString(record.directory),
    extension: readOptionalString(record.extension),
  };
}

function parseHttpGetInput(input: unknown): Partial<HttpGetInput> {
  const record = asRecord(input);

  return {
    url: readOptionalString(record.url),
    headers: readOptionalStringRecord(record.headers),
  };
}

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" ? (input as Record<string, unknown>) : {};
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readNumber(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function readBoolean(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

function readOptionalStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const output: Record<string, string> = {};

  for (const [key, entryValue] of Object.entries(value)) {
    if (typeof entryValue === "string") {
      output[key] = entryValue;
    }
  }

  return output;
}

function normalizeHttpAllowlist(allowlist: string[]): string[] {
  const origins = allowlist.map((entry) => {
    const url = new URL(entry);

    if (url.protocol !== "https:") {
      throw new Error(`HttpConnector allowlist entry "${entry}" must use HTTPS.`);
    }

    return url.origin;
  });

  return [...new Set(origins)];
}

async function validateHttpUrl(
  inputUrl: string | undefined,
  allowlist: readonly string[],
  resolveHost: HttpResolveHost
): Promise<SafeHttpUrlResult> {
  if (!inputUrl?.trim()) {
    return {
      success: false,
      error: createHttpToolError("http_missing_url", "HTTP GET url is required."),
    };
  }

  let url: URL;

  try {
    url = new URL(inputUrl);
  } catch {
    return {
      success: false,
      error: createHttpToolError("http_invalid_url", "HTTP GET url must be a valid URL."),
    };
  }

  if (url.protocol !== "https:") {
    return {
      success: false,
      error: createHttpToolError("http_insecure_protocol_denied", "Only HTTPS URLs are allowed."),
    };
  }

  if (url.username || url.password) {
    return {
      success: false,
      error: createHttpToolError(
        "http_credentials_denied",
        "Credentials embedded in URLs are not allowed."
      ),
    };
  }

  if (!allowlist.includes(url.origin)) {
    return {
      success: false,
      error: createHttpToolError(
        "http_host_not_allowlisted",
        `Origin "${url.origin}" is not allowlisted.`
      ),
    };
  }

  if (isBlockedNetworkTarget(url.hostname)) {
    return {
      success: false,
      error: createHttpToolError(
        "http_private_network_denied",
        "Localhost, loopback, link-local, and private network targets are not allowed."
      ),
    };
  }

  if (!isIP(normalizeHostname(url.hostname))) {
    let resolvedAddresses: string[];

    try {
      resolvedAddresses = await resolveHost(url.hostname);
    } catch {
      return {
        success: false,
        error: createHttpToolError("http_dns_lookup_failed", "Could not resolve HTTP target host."),
      };
    }

    if (resolvedAddresses.some((address) => isBlockedNetworkTarget(address))) {
      return {
        success: false,
        error: createHttpToolError(
          "http_private_network_denied",
          "Resolved host points to a local, loopback, link-local, or private network target."
        ),
      };
    }
  }

  return {
    success: true,
    url,
  };
}

function sanitizeRequestHeaders(headers: Record<string, string> | undefined): {
  success: boolean;
  headers?: Record<string, string>;
  error?: AgentOSError;
} {
  const safeHeaders: Record<string, string> = {};

  for (const [name, value] of Object.entries(headers ?? {})) {
    const normalizedName = name.toLowerCase();

    if (SENSITIVE_HEADER_NAMES.has(normalizedName)) {
      return {
        success: false,
        error: createHttpToolError(
          "http_sensitive_header_denied",
          `Sensitive request header "${name}" is not allowed.`
        ),
      };
    }

    safeHeaders[name] = value;
  }

  return {
    success: true,
    headers: safeHeaders,
  };
}

async function readHttpBody(response: Response, maxResponseBytes: number): Promise<HttpBodyResult> {
  if (!response.body) {
    const buffer = await response.arrayBuffer();

    if (buffer.byteLength > maxResponseBytes) {
      throw createHttpToolError(
        "http_response_too_large",
        "HTTP response exceeded maximum response size."
      );
    }

    return {
      body: new TextDecoder().decode(buffer),
      bytesRead: buffer.byteLength,
    };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytesRead = 0;

  try {
    while (true) {
      const read = await reader.read();

      if (read.done) {
        break;
      }

      bytesRead += read.value.byteLength;

      if (bytesRead > maxResponseBytes) {
        throw createHttpToolError(
          "http_response_too_large",
          "HTTP response exceeded maximum response size."
        );
      }

      chunks.push(read.value);
    }
  } finally {
    reader.releaseLock();
  }

  const bodyBytes = new Uint8Array(bytesRead);
  let offset = 0;

  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return {
    body: new TextDecoder().decode(bodyBytes),
    bytesRead,
  };
}

function safeResponseHeaders(headers: Headers): Record<string, string> {
  const output: Record<string, string> = {};

  headers.forEach((value, name) => {
    output[name] = SENSITIVE_HEADER_NAMES.has(name.toLowerCase()) ? "[redacted]" : value;
  });

  return output;
}

function redactHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  const output: Record<string, string> = {};

  for (const [name, value] of Object.entries(headers ?? {})) {
    output[name] = SENSITIVE_HEADER_NAMES.has(name.toLowerCase()) ? "[redacted]" : value;
  }

  return output;
}

function isBlockedNetworkTarget(hostname: string): boolean {
  const host = normalizeHostname(hostname);

  if (host === "localhost" || host.endsWith(".localhost")) {
    return true;
  }

  const ipVersion = isIP(host);

  if (ipVersion === 4) {
    return isBlockedIPv4(host);
  }

  if (ipVersion === 6) {
    return isBlockedIPv6(host);
  }

  return false;
}

async function resolveHostWithDNS(hostname: string): Promise<string[]> {
  const addresses = await lookup(hostname, {
    all: true,
  });

  return addresses.map((address) => address.address);
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
}

function isBlockedIPv4(ipAddress: string): boolean {
  const parts = ipAddress.split(".").map((part) => Number(part));
  const [first = 0, second = 0] = parts;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isBlockedIPv6(ipAddress: string): boolean {
  const normalized = ipAddress.toLowerCase();

  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd")
  );
}

async function resolveExistingPath(
  workspaceRoot: string,
  inputPath: string | undefined
): Promise<SafePathResult> {
  const safePath = resolveWorkspacePath(workspaceRoot, inputPath);

  if (!safePath.success) {
    return safePath;
  }

  try {
    const realTarget = await realpath(safePath.absolutePath!);
    const realRoot = await realpath(workspaceRoot);

    if (!isInsideOrSame(realRoot, realTarget)) {
      return {
        success: false,
        error: createFilesystemError(
          "filesystem_path_escape",
          "Resolved path escapes the configured workspace."
        ),
      };
    }

    return {
      ...safePath,
      absolutePath: realTarget,
      relativePath: toWorkspaceRelative(realRoot, realTarget),
    };
  } catch {
    return {
      success: false,
      error: createFilesystemError("filesystem_path_not_found", "Path does not exist."),
    };
  }
}

async function resolveWritablePath(
  workspaceRoot: string,
  inputPath: string | undefined
): Promise<SafePathResult> {
  const safePath = resolveWorkspacePath(workspaceRoot, inputPath);

  if (!safePath.success) {
    return safePath;
  }

  let realRoot: string;
  let realParent: string;

  try {
    realRoot = await realpath(workspaceRoot);
    const nearestExistingParent = await findNearestExistingParent(
      path.dirname(safePath.absolutePath!)
    );
    realParent = await realpath(nearestExistingParent);
  } catch {
    return {
      success: false,
      error: createFilesystemError(
        "filesystem_workspace_not_found",
        "Configured workspaceRoot does not exist."
      ),
    };
  }

  if (!isInsideOrSame(realRoot, realParent)) {
    return {
      success: false,
      error: createFilesystemError(
        "filesystem_path_escape",
        "Writable path parent escapes the configured workspace."
      ),
    };
  }

  const existing = await getOptionalStat(safePath.absolutePath!);

  if (existing) {
    const realTarget = await realpath(safePath.absolutePath!);

    if (!isInsideOrSame(realRoot, realTarget)) {
      return {
        success: false,
        error: createFilesystemError(
          "filesystem_path_escape",
          "Writable path escapes the configured workspace."
        ),
      };
    }
  }

  return safePath;
}

function resolveWorkspacePath(
  workspaceRoot: string,
  inputPath: string | undefined
): SafePathResult {
  const requestedPath = inputPath?.trim() || ".";

  if (path.isAbsolute(requestedPath)) {
    return {
      success: false,
      error: createFilesystemError(
        "filesystem_absolute_path_denied",
        "Absolute paths are not allowed."
      ),
    };
  }

  const absolutePath = path.resolve(workspaceRoot, requestedPath);

  if (!isInsideOrSame(workspaceRoot, absolutePath)) {
    return {
      success: false,
      error: createFilesystemError(
        "filesystem_path_escape",
        "Path escapes the configured workspace."
      ),
    };
  }

  return {
    success: true,
    absolutePath,
    relativePath: toWorkspaceRelative(workspaceRoot, absolutePath),
  };
}

async function listEntries(
  workspaceRoot: string,
  directory: string,
  options: { recursive: boolean }
): Promise<FileEntry[]> {
  const entries: FileEntry[] = [];

  async function visit(currentDirectory: string): Promise<void> {
    if (entries.length >= MAX_LIST_ENTRIES) {
      return;
    }

    const directoryEntries = await readdir(currentDirectory, {
      withFileTypes: true,
    });

    for (const entry of directoryEntries) {
      if (entries.length >= MAX_LIST_ENTRIES) {
        break;
      }

      const absolutePath = path.join(currentDirectory, entry.name);

      if (entry.isSymbolicLink()) {
        continue;
      }

      const entryStats = await stat(absolutePath);
      const relativePath = toWorkspaceRelative(workspaceRoot, absolutePath);

      entries.push({
        path: relativePath,
        type: entry.isDirectory() ? "directory" : "file",
        size: entry.isFile() ? entryStats.size : undefined,
        modifiedAt: entryStats.mtime.toISOString(),
      });

      if (options.recursive && entry.isDirectory()) {
        await visit(absolutePath);
      }
    }
  }

  await visit(directory);

  return entries;
}

async function searchFiles(
  workspaceRoot: string,
  directory: string,
  query: string,
  options: { extension?: string }
): Promise<Pick<SearchFilesOutput, "matches" | "searchedFiles" | "skippedFiles">> {
  const matches: SearchMatch[] = [];
  let searchedFiles = 0;
  let skippedFiles = 0;
  const extension = normalizeExtension(options.extension);
  const entries = await listEntries(workspaceRoot, directory, {
    recursive: true,
  });

  for (const entry of entries) {
    if (entry.type !== "file") {
      continue;
    }

    if (extension && path.extname(entry.path) !== extension) {
      continue;
    }

    if (!isTextFile(entry.path) || (entry.size ?? 0) > MAX_SEARCH_FILE_SIZE_BYTES) {
      skippedFiles += 1;
      continue;
    }

    const absolutePath = path.join(workspaceRoot, entry.path);
    const content = await readFile(absolutePath, "utf8");
    searchedFiles += 1;

    content.split(/\r?\n/).forEach((line, index) => {
      if (line.toLowerCase().includes(query.toLowerCase())) {
        matches.push({
          path: entry.path,
          line: index + 1,
          preview: line.trim(),
        });
      }
    });
  }

  return {
    matches,
    searchedFiles,
    skippedFiles,
  };
}

async function findNearestExistingParent(directory: string): Promise<string> {
  let current = directory;

  while (!(await getOptionalStat(current))) {
    const parent = path.dirname(current);

    if (parent === current) {
      return current;
    }

    current = parent;
  }

  return current;
}

async function getOptionalStat(targetPath: string) {
  try {
    return await stat(targetPath);
  } catch {
    return undefined;
  }
}

function isInsideOrSame(root: string, target: string): boolean {
  const relative = path.relative(root, target);

  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function toWorkspaceRelative(workspaceRoot: string, absolutePath: string): string {
  return path.relative(workspaceRoot, absolutePath) || ".";
}

function normalizeExtension(extension: string | undefined): string | undefined {
  if (!extension?.trim()) {
    return undefined;
  }

  return extension.startsWith(".") ? extension : `.${extension}`;
}

function isTextFile(filePath: string): boolean {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function failedToolResult<Output>(
  startedAt: number,
  error: AgentOSError | undefined
): ToolExecutionResult<Output> {
  return {
    success: false,
    durationMs: Date.now() - startedAt,
    errors: [error ?? createFilesystemError("filesystem_unknown_error", "Filesystem tool failed.")],
  };
}

function failedHttpToolResult<Output>(
  startedAt: number,
  error: AgentOSError | undefined
): ToolExecutionResult<Output> {
  return {
    success: false,
    durationMs: Date.now() - startedAt,
    errors: [error ?? createHttpToolError("http_unknown_error", "HTTP GET request failed.")],
  };
}

function createFilesystemError(code: string, message: string): AgentOSError {
  return {
    code,
    message,
    recoverable: true,
  };
}

function createHttpToolError(code: string, message: string): AgentOSError {
  return {
    code,
    message,
    recoverable: true,
  };
}

function normalizeHttpError(error: unknown): AgentOSError {
  if (isAgentOSError(error)) {
    return error;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return createHttpToolError("http_timeout", "HTTP GET request exceeded timeout.");
  }

  if (error instanceof Error && error.message === "agentos_http_timeout") {
    return createHttpToolError("http_timeout", "HTTP GET request exceeded timeout.");
  }

  return createHttpToolError("http_request_failed", "HTTP GET request failed.");
}

function isAgentOSError(error: unknown): error is AgentOSError {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    "message" in error &&
    typeof (error as AgentOSError).code === "string" &&
    typeof (error as AgentOSError).message === "string"
  );
}
