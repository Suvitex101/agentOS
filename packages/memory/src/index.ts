export const agentOSMemory = {
  name: "@agentos/memory",
  description: "Provider-agnostic memory interfaces and in-memory store for AgentOS.",
} as const;

import {
  MemoryScope,
  MemoryType,
  type AgentOSError,
  type AgentOSMetadata,
  type MemoryPolicy,
  type MemoryQuery,
  type MemoryRecord,
  type MemoryScopeReference,
} from "@agentos/types";

export interface MemoryWriteInput {
  id?: string;
  content: unknown;
  type: MemoryType;
  scope: MemoryScopeReference;
  ownerId?: string;
  taskId?: string;
  createdAt?: Date;
  updatedAt?: Date;
  metadata?: AgentOSMetadata;
}

export interface MemoryDeleteResult {
  success: boolean;
  id: string;
  error?: AgentOSError;
  metadata?: AgentOSMetadata;
}

export interface MemoryClearResult {
  success: boolean;
  deletedCount: number;
  scope?: MemoryScopeReference;
  error?: AgentOSError;
  metadata?: AgentOSMetadata;
}

export interface MemoryWriteResult {
  success: boolean;
  record?: MemoryRecord;
  error?: AgentOSError;
  metadata?: AgentOSMetadata;
}

export interface MemoryStore {
  write(record: MemoryWriteInput): Promise<MemoryWriteResult> | MemoryWriteResult;
  read(id: string): Promise<MemoryRecord | undefined> | MemoryRecord | undefined;
  search(query: MemoryQuery): Promise<MemoryRecord[]> | MemoryRecord[];
  list(scope?: MemoryScopeReference): Promise<MemoryRecord[]> | MemoryRecord[];
  delete(id: string): Promise<MemoryDeleteResult> | MemoryDeleteResult;
  clear(scope?: MemoryScopeReference): Promise<MemoryClearResult> | MemoryClearResult;
}

export interface InMemoryMemoryStoreOptions {
  policy?: MemoryPolicy;
}

export class InMemoryMemoryStore implements MemoryStore {
  private readonly records = new Map<string, MemoryRecord>();
  private readonly policy: MemoryPolicy;

  constructor(options: InMemoryMemoryStoreOptions = {}) {
    this.policy =
      options.policy ??
      ({
        enabled: true,
        scopes: [
          MemoryScope.User,
          MemoryScope.Organization,
          MemoryScope.Agent,
          MemoryScope.Task,
          MemoryScope.Mission,
          MemoryScope.Project,
          MemoryScope.Global,
        ],
        readableTypes: [
          MemoryType.Fact,
          MemoryType.Preference,
          MemoryType.Summary,
          MemoryType.Event,
          MemoryType.Document,
          MemoryType.Custom,
        ],
        writableTypes: [
          MemoryType.Fact,
          MemoryType.Preference,
          MemoryType.Summary,
          MemoryType.Event,
          MemoryType.Document,
          MemoryType.Custom,
        ],
      } satisfies MemoryPolicy);
  }

  write(input: MemoryWriteInput): MemoryWriteResult {
    if (!this.policy.enabled) {
      return {
        success: false,
        error: createMemoryError("memory_disabled", "Memory writes are disabled by policy."),
      };
    }

    if (!this.policy.writableTypes.includes(input.type)) {
      return {
        success: false,
        error: createMemoryError(
          "memory_type_not_writable",
          `Memory type "${input.type}" is not writable by policy.`
        ),
      };
    }

    if (!this.policy.scopes.includes(input.scope.type)) {
      return {
        success: false,
        error: createMemoryError(
          "memory_scope_not_writable",
          `Memory scope "${input.scope.type}" is not writable by policy.`
        ),
      };
    }

    const now = new Date();
    const existing = input.id ? this.records.get(input.id) : undefined;
    const record: MemoryRecord = {
      id: input.id ?? createMemoryId(now),
      content: input.content,
      type: input.type,
      scope: input.scope,
      ownerId: input.ownerId,
      taskId: input.taskId,
      createdAt: input.createdAt ?? existing?.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
      metadata: input.metadata,
    };

    this.records.set(record.id, record);

    return {
      success: true,
      record,
    };
  }

  read(id: string): MemoryRecord | undefined {
    return this.records.get(id);
  }

  search(query: MemoryQuery): MemoryRecord[] {
    const searchText = normalize(query.query ?? query.text ?? "");
    const terms = searchText.split(/\s+/).filter(Boolean);
    const records = this.list(query.scope).filter((record) => {
      if (query.types && !query.types.includes(record.type)) {
        return false;
      }

      if (query.scopes && !query.scopes.includes(record.scope.type)) {
        return false;
      }

      if (query.ownerId && record.ownerId !== query.ownerId) {
        return false;
      }

      if (query.taskId && record.taskId !== query.taskId) {
        return false;
      }

      if (terms.length === 0) {
        return true;
      }

      const searchable = normalize(
        [
          record.type,
          stringify(record.content),
          record.scope.type,
          record.scope.id,
          stringify(record.metadata),
        ].join(" ")
      );

      return terms.every((term) => searchable.includes(term));
    });

    return typeof query.limit === "number" ? records.slice(0, query.limit) : records;
  }

  list(scope?: MemoryScopeReference): MemoryRecord[] {
    const records = [...this.records.values()];

    if (!scope) {
      return records;
    }

    return records.filter((record) => isSameScope(record.scope, scope));
  }

  delete(id: string): MemoryDeleteResult {
    const deleted = this.records.delete(id);

    if (!deleted) {
      return {
        success: false,
        id,
        error: createMemoryError("memory_record_not_found", `Memory record "${id}" was not found.`),
      };
    }

    return {
      success: true,
      id,
    };
  }

  clear(scope?: MemoryScopeReference): MemoryClearResult {
    if (!scope) {
      const deletedCount = this.records.size;
      this.records.clear();

      return {
        success: true,
        deletedCount,
      };
    }

    const matchingIds = this.list(scope).map((record) => record.id);

    for (const id of matchingIds) {
      this.records.delete(id);
    }

    return {
      success: true,
      deletedCount: matchingIds.length,
      scope,
    };
  }
}

export function createInMemoryMemoryStoreExample() {
  const memory = new InMemoryMemoryStore();
  const scope = {
    type: MemoryScope.Project,
    id: "agentos",
  };
  const write = memory.write({
    content: "The user is building AgentOS for open-source AI agents in Africa.",
    type: MemoryType.Fact,
    scope,
    metadata: {
      source: "example",
    },
  });
  const record = write.record;
  const read = record ? memory.read(record.id) : undefined;
  const search = memory.search({
    query: "Africa agents",
    scope,
  });
  const list = memory.list(scope);
  const deleted = record ? memory.delete(record.id) : undefined;
  const cleared = memory.clear(scope);

  return {
    write,
    read,
    search,
    list,
    deleted,
    cleared,
  };
}

function createMemoryId(now: Date): string {
  return `memory-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isSameScope(left: MemoryScopeReference, right: MemoryScopeReference): boolean {
  return left.type === right.type && left.id === right.id;
}

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

function stringify(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function createMemoryError(code: string, message: string): AgentOSError {
  return {
    code,
    message,
    recoverable: true,
  };
}

export type { MemoryPolicy, MemoryQuery, MemoryRecord, MemoryScopeReference } from "@agentos/types";
export { MemoryScope, MemoryType } from "@agentos/types";
