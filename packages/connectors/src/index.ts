import { lookup } from "node:dns/promises";
import { mkdir, readdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import path from "node:path";
import { defineConnector, defineTool, type ConnectorDefinition } from "@agentos/core";
import {
  CapabilityCategory,
  ConnectorPermission,
  ConnectorRiskLevel,
  ConnectorTrustLevel,
  ResourceType,
  ToolCategory,
  ToolPermissionLevel,
  type AgentOSError,
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
