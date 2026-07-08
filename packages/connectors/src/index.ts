import { mkdir, readdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { defineConnector, defineTool, type ConnectorDefinition } from "@agentos/core";
import {
  CapabilityCategory,
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

interface SafePathResult {
  success: boolean;
  absolutePath?: string;
  relativePath?: string;
  error?: AgentOSError;
}

const MAX_LIST_ENTRIES = 1000;
const MAX_SEARCH_FILE_SIZE_BYTES = 1024 * 1024;
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

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" ? (input as Record<string, unknown>) : {};
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
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

function createFilesystemError(code: string, message: string): AgentOSError {
  return {
    code,
    message,
    recoverable: true,
  };
}
