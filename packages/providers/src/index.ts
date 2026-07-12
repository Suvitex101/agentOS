import {
  CredentialResolver,
  defineModelProvider,
  redactCredentialReference,
  redactMetadata,
  redactSecretValue,
} from "@agentos/core";
import {
  CredentialType,
  ModelFinishReason,
  ModelProviderCapability,
  type AgentOSError,
  type AgentOSMetadata,
  type CredentialReference,
  type CredentialReferenceSummary,
  type CredentialResolver as CredentialResolverContract,
  type ModelGenerationRequest,
  type ModelGenerationResponse,
  type ModelUsage,
} from "@agentos/types";

export const agentOSProviders = {
  name: "@agentos/providers",
  description: "Provider-agnostic model provider foundations for AgentOS.",
} as const;

export type HTTPModelProviderFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface HTTPModelProviderTransportConfig {
  baseUrl: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
  defaultHeaders?: Record<string, string>;
  allowLocalhost?: boolean;
  userAgent?: string;
  credential?: CredentialReference;
  credentialResolver?: CredentialResolverContract;
  credentialHeaderName?: string;
  credentialPrefix?: string;
  fetchImplementation?: HTTPModelProviderFetch;
}

export interface HTTPModelProviderRequest {
  path: string;
  method?: "POST";
  headers?: Record<string, string>;
  body?: unknown;
}

export interface HTTPModelProviderAdapter {
  name: string;
  buildRequest(request: ModelGenerationRequest): HTTPModelProviderRequest;
  parseResponse(input: HTTPModelProviderAdapterResponse): ModelGenerationResponse;
  normalizeFinishReason?(finishReason: unknown): ModelFinishReason | string;
  normalizeUsage?(usage: unknown): ModelUsage | undefined;
}

export interface HTTPModelProviderAdapterResponse {
  json: unknown;
  request: ModelGenerationRequest;
  status: number;
  headers: Record<string, string>;
  durationMs: number;
  metadata?: AgentOSMetadata;
}

export interface OpenAICompatibleProviderOptions {
  id?: string;
  name?: string;
  description?: string;
  version?: string;
  model: string;
  transport: HTTPModelProviderBase | HTTPModelProviderTransportConfig;
  capabilities?: string[];
  tags?: string[];
  metadata?: AgentOSMetadata;
}

export interface OllamaProviderOptions {
  id?: string;
  name?: string;
  description?: string;
  version?: string;
  baseUrl?: string;
  model: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
  allowRemote?: boolean;
  capabilities?: string[];
  tags?: string[];
  metadata?: AgentOSMetadata;
  credential?: CredentialReference;
  credentialResolver?: CredentialResolverContract;
  fetchImplementation?: HTTPModelProviderFetch;
}

export interface OllamaHealthResult {
  reachable: boolean;
  modelAvailable: boolean;
  providerVersion?: string;
  checkedAt: Date;
  errors: AgentOSError[];
  metadata?: AgentOSMetadata;
}

export interface OllamaProvider {
  id: string;
  name: string;
  generate(request: ModelGenerationRequest): Promise<ModelGenerationResponse>;
  inspect(): {
    id: string;
    name: string;
    description?: string;
    version: string;
    tags: string[];
    capabilities: string[];
    generationSignature: "generate(request)";
    metadata?: AgentOSMetadata;
  };
  summary(): {
    id: string;
    name: string;
    description?: string;
    version: string;
    capabilities: string[];
    tags: string[];
  };
  health(): Promise<OllamaHealthResult>;
}

interface HTTPBodyResult {
  text: string;
  bytesRead: number;
}

interface OllamaHTTPResult {
  json: unknown;
  status: number;
  headers: Record<string, string>;
  durationMs: number;
  bytesRead: number;
}

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_RESPONSE_BYTES = 1024 * 1024;
const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
const JSON_CONTENT_TYPES = ["application/json", "application/problem+json"];
const SENSITIVE_HEADER_NAMES = new Set([
  "authorization",
  "cookie",
  "proxy-authorization",
  "set-cookie",
  "x-api-key",
  "x-auth-token",
]);

export class HTTPModelProviderBase {
  readonly config: Readonly<
    Required<
      Omit<
        HTTPModelProviderTransportConfig,
        "credential" | "credentialResolver" | "fetchImplementation"
      >
    > & {
      credential?: CredentialReferenceSummary;
    }
  >;

  private readonly fetchImplementation: HTTPModelProviderFetch;
  private readonly credentialReference?: CredentialReference;
  private readonly credentialResolver: CredentialResolverContract;

  constructor(config: HTTPModelProviderTransportConfig) {
    const baseUrl = new URL(config.baseUrl);

    if (!isAllowedProtocol(baseUrl, config.allowLocalhost ?? false)) {
      throw createTransportError(
        "http_model_provider_insecure_base_url",
        "Remote model provider baseUrl must use HTTPS unless localhost is explicitly enabled."
      );
    }

    this.config = Object.freeze({
      baseUrl: baseUrl.toString(),
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxResponseBytes: config.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES,
      defaultHeaders: Object.freeze({ ...(config.defaultHeaders ?? {}) }) as Record<string, string>,
      allowLocalhost: config.allowLocalhost ?? false,
      userAgent: config.userAgent ?? "AgentOS/0.1",
      credential: redactCredentialReference(config.credential),
      credentialHeaderName: config.credentialHeaderName ?? "authorization",
      credentialPrefix: config.credentialPrefix ?? "Bearer ",
    });
    this.fetchImplementation = config.fetchImplementation ?? fetch;
    this.credentialReference = config.credential;
    this.credentialResolver = config.credentialResolver ?? new CredentialResolver();

    if (this.config.timeoutMs <= 0) {
      throw createTransportError(
        "http_model_provider_invalid_config",
        "timeoutMs must be positive."
      );
    }

    if (this.config.maxResponseBytes <= 0) {
      throw createTransportError(
        "http_model_provider_invalid_config",
        "maxResponseBytes must be positive."
      );
    }
  }

  async generate(
    request: ModelGenerationRequest,
    adapter: HTTPModelProviderAdapter
  ): Promise<ModelGenerationResponse> {
    const startedAt = Date.now();
    const built = adapter.buildRequest(request);
    const url = this.resolveRequestUrl(built.path);
    const headers = await this.createHeaders(built.headers);
    const body = built.body === undefined ? undefined : JSON.stringify(built.body);
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(
            createTransportError(
              "http_model_provider_timeout",
              "Remote model provider request exceeded timeout."
            )
          );
        }, this.config.timeoutMs);
      });
      const response = await Promise.race([
        this.fetchImplementation(url, {
          method: built.method ?? "POST",
          headers,
          body,
          redirect: "manual",
          signal: controller.signal,
        }),
        timeout,
      ]);

      if (response.status >= 300 && response.status < 400) {
        throw createTransportError(
          "http_model_provider_redirect_denied",
          "Remote model provider redirects are not allowed.",
          {
            status: response.status,
            url: url.toString(),
          }
        );
      }

      const responseHeaders = safeHeaders(response.headers);
      const contentType = response.headers.get("content-type") ?? "";

      if (!isJsonContentType(contentType)) {
        throw createTransportError(
          "http_model_provider_invalid_content_type",
          "Remote model provider response must be JSON.",
          {
            contentType,
            status: response.status,
          }
        );
      }

      const bodyResult = await readResponseBody(response, this.config.maxResponseBytes);
      let json: unknown;

      try {
        json = JSON.parse(bodyResult.text);
      } catch {
        throw createTransportError(
          "http_model_provider_invalid_json",
          "Remote model provider response was not valid JSON.",
          {
            status: response.status,
            bytesRead: bodyResult.bytesRead,
          }
        );
      }

      if (!response.ok) {
        throw createTransportError(
          "http_model_provider_status_error",
          `Remote model provider returned HTTP ${response.status}.`,
          {
            status: response.status,
            statusText: response.statusText,
          }
        );
      }

      const durationMs = Date.now() - startedAt;
      const parsed = adapter.parseResponse({
        json,
        request,
        status: response.status,
        headers: responseHeaders,
        durationMs,
        metadata: {
          transport: "http",
          adapter: adapter.name,
          bytesRead: bodyResult.bytesRead,
          requestHeaders: redactHeaders(headers),
          responseHeaders,
        },
      });

      return {
        ...parsed,
        durationMs: parsed.durationMs ?? durationMs,
        metadata: {
          ...parsed.metadata,
          transport: "http",
          adapter: adapter.name,
          bytesRead: bodyResult.bytesRead,
        },
      };
    } catch (error) {
      throw normalizeTransportError(error);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  private resolveRequestUrl(path: string): URL {
    const url = new URL(path, this.config.baseUrl);

    if (!isAllowedProtocol(url, this.config.allowLocalhost)) {
      throw createTransportError(
        "http_model_provider_insecure_request_url",
        "Remote model provider request URL must use HTTPS unless localhost is explicitly enabled."
      );
    }

    return url;
  }

  private async createHeaders(
    headers: Record<string, string> | undefined
  ): Promise<Record<string, string>> {
    const credentialHeaders = await this.createCredentialHeaders();

    return {
      ...this.config.defaultHeaders,
      "content-type": "application/json",
      accept: "application/json",
      "user-agent": this.config.userAgent,
      ...(headers ?? {}),
      ...credentialHeaders,
    };
  }

  private async createCredentialHeaders(): Promise<Record<string, string>> {
    if (!this.credentialReference) {
      return {};
    }

    const result = await this.credentialResolver.resolve(this.credentialReference);

    if (!result.success || !result.credential) {
      throw createTransportError(
        "http_model_provider_credential_resolution_failed",
        "Remote model provider credential could not be resolved.",
        {
          errors: result.errors.map((error) => ({
            code: error.code,
            message: error.message,
            metadata: redactMetadata(error.metadata),
          })),
          reference: result.reference,
        }
      );
    }

    const prefix =
      this.credentialReference.type === CredentialType.Static ||
      this.credentialReference.type === CredentialType.Environment
        ? this.config.credentialPrefix
        : "";

    return {
      [this.config.credentialHeaderName]: `${prefix}${result.credential.value}`,
    };
  }
}

class OpenAICompatibleAdapter implements HTTPModelProviderAdapter {
  readonly name = "openai-compatible";

  constructor(private readonly model: string) {}

  buildRequest(request: ModelGenerationRequest): HTTPModelProviderRequest {
    const messages = [
      request.systemPrompt
        ? {
            role: "system",
            content: request.systemPrompt,
          }
        : undefined,
      {
        role: "user",
        content: request.prompt,
      },
    ].filter(Boolean);

    return {
      path: "/v1/chat/completions",
      method: "POST",
      body: {
        model: this.model,
        messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        metadata: request.metadata,
      },
    };
  }

  parseResponse(input: HTTPModelProviderAdapterResponse): ModelGenerationResponse {
    const response = asRecord(input.json);
    const choices = Array.isArray(response.choices) ? response.choices : [];
    const firstChoice = asRecord(choices[0]);
    const message = asRecord(firstChoice.message);
    const content = typeof message.content === "string" ? message.content : "";

    if (!content) {
      throw createTransportError(
        "http_model_provider_invalid_response",
        "OpenAI-compatible response did not include message content."
      );
    }

    return {
      text: content,
      usage: this.normalizeUsage(response.usage),
      finishReason: this.normalizeFinishReason(firstChoice.finish_reason),
      provider: "openai-compatible",
      model: typeof response.model === "string" ? response.model : this.model,
      durationMs: input.durationMs,
      metadata: {
        status: input.status,
        responseId: typeof response.id === "string" ? response.id : undefined,
      },
    };
  }

  normalizeFinishReason(finishReason: unknown): ModelFinishReason | string {
    if (finishReason === "stop") {
      return ModelFinishReason.Stop;
    }

    if (finishReason === "length") {
      return ModelFinishReason.Length;
    }

    if (typeof finishReason === "string") {
      return finishReason;
    }

    return ModelFinishReason.Unknown;
  }

  normalizeUsage(usage: unknown): ModelUsage | undefined {
    const record = asRecord(usage);

    if (!record) {
      return undefined;
    }

    return {
      inputTokens: readOptionalNumber(record.prompt_tokens),
      outputTokens: readOptionalNumber(record.completion_tokens),
      totalTokens: readOptionalNumber(record.total_tokens),
    };
  }
}

class OllamaNativeAdapter implements HTTPModelProviderAdapter {
  readonly name = "ollama-native";

  constructor(private readonly model: string) {}

  buildRequest(request: ModelGenerationRequest): HTTPModelProviderRequest {
    return {
      path: "/api/generate",
      method: "POST",
      body: {
        model: this.model,
        prompt: request.prompt,
        system: request.systemPrompt,
        stream: false,
        options: {
          temperature: request.temperature,
          num_predict: request.maxTokens,
          num_ctx: readOptionalNumber(asRecord(request.metadata).contextWindow),
        },
      },
    };
  }

  parseResponse(input: HTTPModelProviderAdapterResponse): ModelGenerationResponse {
    const response = asRecord(input.json);
    const text = typeof response.response === "string" ? response.response : "";

    if (!text) {
      throw createTransportError(
        "ollama_provider_invalid_response",
        "Ollama response did not include generated text."
      );
    }

    return {
      text,
      usage: this.normalizeUsage(response),
      finishReason: this.normalizeFinishReason(response.done_reason),
      provider: "ollama",
      model: typeof response.model === "string" ? response.model : this.model,
      durationMs: input.durationMs,
      metadata: {
        status: input.status,
        done: typeof response.done === "boolean" ? response.done : undefined,
        totalDurationNs: readOptionalNumber(response.total_duration),
        loadDurationNs: readOptionalNumber(response.load_duration),
        promptEvalDurationNs: readOptionalNumber(response.prompt_eval_duration),
        evalDurationNs: readOptionalNumber(response.eval_duration),
      },
    };
  }

  normalizeFinishReason(finishReason: unknown): ModelFinishReason | string {
    if (finishReason === "stop") {
      return ModelFinishReason.Stop;
    }

    if (finishReason === "length") {
      return ModelFinishReason.Length;
    }

    if (typeof finishReason === "string") {
      return finishReason;
    }

    return ModelFinishReason.Unknown;
  }

  normalizeUsage(response: Record<string, unknown>): ModelUsage | undefined {
    const inputTokens = readOptionalNumber(response.prompt_eval_count);
    const outputTokens = readOptionalNumber(response.eval_count);

    if (inputTokens === undefined && outputTokens === undefined) {
      return undefined;
    }

    return {
      inputTokens,
      outputTokens,
      totalTokens:
        inputTokens !== undefined && outputTokens !== undefined
          ? inputTokens + outputTokens
          : undefined,
      metadata: {
        provider: "ollama",
      },
    };
  }
}

export function createOpenAICompatibleProvider(options: OpenAICompatibleProviderOptions) {
  const transport =
    options.transport instanceof HTTPModelProviderBase
      ? options.transport
      : new HTTPModelProviderBase(options.transport);
  const adapter = new OpenAICompatibleAdapter(options.model);

  return defineModelProvider({
    id: options.id ?? "openai-compatible",
    name: options.name ?? "OpenAI-Compatible Provider",
    description:
      options.description ?? "Provider adapter for OpenAI-compatible chat completion APIs.",
    version: options.version ?? "1.0.0",
    capabilities: options.capabilities ?? [
      ModelProviderCapability.TextGeneration,
      ModelProviderCapability.Reasoning,
      ModelProviderCapability.StructuredOutput,
    ],
    tags: options.tags ?? ["remote", "http", "openai-compatible"],
    metadata: {
      model: options.model,
      remote: true,
      ...options.metadata,
    },
    generate(request) {
      return transport.generate(request, adapter);
    },
  });
}

export function createOllamaProvider(options: OllamaProviderOptions): OllamaProvider {
  const baseUrl = normalizeOllamaBaseUrl(options.baseUrl ?? DEFAULT_OLLAMA_BASE_URL);
  const allowRemote = options.allowRemote ?? false;
  const baseURL = new URL(baseUrl);

  if (!allowRemote && !isLocalhost(baseURL.hostname)) {
    throw createTransportError(
      "ollama_provider_remote_disabled",
      "Ollama remote endpoints require allowRemote: true."
    );
  }

  const transport = new HTTPModelProviderBase({
    baseUrl,
    timeoutMs: options.timeoutMs,
    maxResponseBytes: options.maxResponseBytes,
    allowLocalhost: true,
    credential: options.credential,
    credentialResolver: options.credentialResolver,
    fetchImplementation: options.fetchImplementation,
    userAgent: "AgentOS-OllamaProvider/0.1",
  });
  const adapter = new OllamaNativeAdapter(options.model);
  const provider = defineModelProvider({
    id: options.id ?? "ollama",
    name: options.name ?? "Ollama Provider",
    description: options.description ?? "Native local Ollama provider for AgentOS.",
    version: options.version ?? "1.0.0",
    capabilities: options.capabilities ?? [
      ModelProviderCapability.TextGeneration,
      ModelProviderCapability.Reasoning,
      ModelProviderCapability.StructuredOutput,
      "local",
      "ollama",
    ],
    tags: options.tags ?? ["ollama", "local", "open-models"],
    metadata: {
      model: options.model,
      baseUrl,
      localFirst: !allowRemote,
      remote: !isLocalhost(baseURL.hostname),
      credential: redactCredentialReference(options.credential),
      ...options.metadata,
    },
    generate(request) {
      return transport.generate(request, adapter);
    },
  });

  return Object.freeze({
    ...provider,
    async health(): Promise<OllamaHealthResult> {
      return checkOllamaHealth({
        baseUrl,
        model: options.model,
        timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        maxResponseBytes: options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES,
        fetchImplementation: options.fetchImplementation ?? fetch,
      });
    },
  }) as OllamaProvider;
}

async function checkOllamaHealth(options: {
  baseUrl: string;
  model: string;
  timeoutMs: number;
  maxResponseBytes: number;
  fetchImplementation: HTTPModelProviderFetch;
}): Promise<OllamaHealthResult> {
  const checkedAt = new Date();
  const errors: AgentOSError[] = [];
  let providerVersion: string | undefined;
  let modelAvailable = false;

  try {
    const tags = await fetchOllamaJson({
      ...options,
      path: "/api/tags",
    });
    const tagsRecord = asRecord(tags.json);
    const models: unknown[] = Array.isArray(tagsRecord.models) ? tagsRecord.models : [];
    modelAvailable = models.some((model) => asRecord(model).name === options.model);
  } catch (error) {
    errors.push(normalizeTransportError(error));
  }

  try {
    const version = await fetchOllamaJson({
      ...options,
      path: "/api/version",
    });
    const versionValue = asRecord(version.json).version;
    providerVersion = typeof versionValue === "string" ? versionValue : undefined;
  } catch {
    // Version endpoint is useful when available, but health should not fail hard without it.
  }

  return {
    reachable: errors.length === 0,
    modelAvailable,
    providerVersion,
    checkedAt,
    errors,
    metadata: {
      model: options.model,
      baseUrl: options.baseUrl,
    },
  };
}

async function fetchOllamaJson(options: {
  baseUrl: string;
  path: string;
  timeoutMs: number;
  maxResponseBytes: number;
  fetchImplementation: HTTPModelProviderFetch;
}): Promise<OllamaHTTPResult> {
  const startedAt = Date.now();
  const url = new URL(options.path, options.baseUrl);
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(createTransportError("ollama_provider_timeout", "Ollama request exceeded timeout."));
      }, options.timeoutMs);
    });
    const response = await Promise.race([
      options.fetchImplementation(url, {
        method: "GET",
        redirect: "manual",
        headers: {
          accept: "application/json",
          "user-agent": "AgentOS-OllamaProvider/0.1",
        },
        signal: controller.signal,
      }),
      timeout,
    ]);

    if (response.status >= 300 && response.status < 400) {
      throw createTransportError(
        "ollama_provider_redirect_denied",
        "Ollama redirects are not allowed."
      );
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (!isJsonContentType(contentType)) {
      throw createTransportError(
        "ollama_provider_invalid_content_type",
        "Ollama response must be JSON.",
        {
          contentType,
          status: response.status,
        }
      );
    }

    const body = await readResponseBody(response, options.maxResponseBytes);
    let json: unknown;

    try {
      json = JSON.parse(body.text);
    } catch {
      throw createTransportError(
        "ollama_provider_invalid_json",
        "Ollama response was not valid JSON."
      );
    }

    if (!response.ok) {
      throw createTransportError(
        "ollama_provider_status_error",
        `Ollama returned HTTP ${response.status}.`,
        {
          status: response.status,
          statusText: response.statusText,
        }
      );
    }

    return {
      json,
      status: response.status,
      headers: safeHeaders(response.headers),
      durationMs: Date.now() - startedAt,
      bytesRead: body.bytesRead,
    };
  } catch (error) {
    throw normalizeTransportError(error);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function normalizeOllamaBaseUrl(input: string): string {
  const url = new URL(input);

  if (!isAllowedProtocol(url, true)) {
    throw createTransportError(
      "ollama_provider_insecure_base_url",
      "Ollama baseUrl must use localhost HTTP or HTTPS."
    );
  }

  if (url.username || url.password) {
    throw createTransportError(
      "ollama_provider_credentials_in_url_denied",
      "Ollama baseUrl must not include credentials."
    );
  }

  return url.toString();
}

async function readResponseBody(
  response: Response,
  maxResponseBytes: number
): Promise<HTTPBodyResult> {
  if (!response.body) {
    const buffer = await response.arrayBuffer();

    if (buffer.byteLength > maxResponseBytes) {
      throw createTransportError(
        "http_model_provider_response_too_large",
        "Remote model provider response exceeded maximum response size."
      );
    }

    return {
      text: new TextDecoder().decode(buffer),
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
        throw createTransportError(
          "http_model_provider_response_too_large",
          "Remote model provider response exceeded maximum response size."
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
    text: new TextDecoder().decode(bodyBytes),
    bytesRead,
  };
}

function isAllowedProtocol(url: URL, allowLocalhost: boolean): boolean {
  if (url.protocol === "https:") {
    return true;
  }

  return allowLocalhost && url.protocol === "http:" && isLocalhost(url.hostname);
}

function isLocalhost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");

  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function isJsonContentType(contentType: string): boolean {
  const normalized = contentType.toLowerCase().split(";")[0]?.trim() ?? "";

  return JSON_CONTENT_TYPES.includes(normalized) || normalized.endsWith("+json");
}

function safeHeaders(headers: Headers): Record<string, string> {
  const output: Record<string, string> = {};

  headers.forEach((value, name) => {
    output[name] = SENSITIVE_HEADER_NAMES.has(name.toLowerCase())
      ? "[redacted]"
      : redactSecretValue(value);
  });

  return output;
}

function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const output: Record<string, string> = {};

  for (const [name, value] of Object.entries(headers)) {
    output[name] = SENSITIVE_HEADER_NAMES.has(name.toLowerCase())
      ? "[redacted]"
      : redactSecretValue(value);
  }

  return output;
}

function normalizeTransportError(error: unknown): AgentOSError {
  if (isAgentOSError(error)) {
    return {
      ...error,
      message: redactSecretValue(error.message),
      metadata: redactMetadata(error.metadata),
    };
  }

  if (error instanceof Error && error.name === "AbortError") {
    return createTransportError(
      "http_model_provider_timeout",
      "Remote model provider request exceeded timeout."
    );
  }

  return createTransportError(
    "http_model_provider_network_error",
    error instanceof Error
      ? redactSecretValue(error.message)
      : "Remote model provider request failed."
  );
}

function createTransportError(
  code: string,
  message: string,
  metadata?: AgentOSMetadata
): AgentOSError {
  return {
    code,
    message: redactSecretValue(message),
    recoverable: true,
    metadata: redactMetadata(metadata),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function isAgentOSError(error: unknown): error is AgentOSError {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as AgentOSError).code === "string" &&
    "message" in error &&
    typeof (error as AgentOSError).message === "string"
  );
}
