import { defineModelProvider } from "@agentos/core";
import {
  ModelFinishReason,
  ModelProviderCapability,
  type AgentOSError,
  type AgentOSMetadata,
  type ModelGenerationRequest,
  type ModelGenerationResponse,
  type ModelUsage,
} from "@agentos/types";

export const agentOSProviders = {
  name: "@agentos/providers",
  description: "Provider-agnostic remote model provider foundations for AgentOS.",
} as const;

export type HTTPModelProviderFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface HTTPModelProviderTransportConfig {
  baseUrl: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
  defaultHeaders?: Record<string, string>;
  allowLocalhost?: boolean;
  userAgent?: string;
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

interface HTTPBodyResult {
  text: string;
  bytesRead: number;
}

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_RESPONSE_BYTES = 1024 * 1024;
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
    Required<Omit<HTTPModelProviderTransportConfig, "fetchImplementation">>
  >;

  private readonly fetchImplementation: HTTPModelProviderFetch;

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
    });
    this.fetchImplementation = config.fetchImplementation ?? fetch;

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
    const headers = this.createHeaders(built.headers);
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

  private createHeaders(headers: Record<string, string> | undefined): Record<string, string> {
    return {
      ...this.config.defaultHeaders,
      "content-type": "application/json",
      accept: "application/json",
      "user-agent": this.config.userAgent,
      ...(headers ?? {}),
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

function redactSecretValue(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\bsk-[A-Za-z0-9_-]+\b/g, "sk-[redacted]");
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

function redactMetadata(metadata: AgentOSMetadata | undefined): AgentOSMetadata | undefined {
  if (!metadata) {
    return undefined;
  }

  const output: AgentOSMetadata = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === "string") {
      output[key] = redactSecretValue(value);
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      output[key] = redactMetadata(value as AgentOSMetadata);
    } else {
      output[key] = value;
    }
  }

  return output;
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
