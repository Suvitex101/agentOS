import {
  type ModelProvider,
  type ModelProviderResolutionRequest,
  type ModelProviderResolutionResult,
  type ModelProviderResolver as ModelProviderResolverContract,
} from "@agentosdev/types";
import type { AgentOSRegistry } from "./agentos-registry";

export interface ModelProviderResolverOptions {
  registry: AgentOSRegistry;
}

export class ModelProviderResolver implements ModelProviderResolverContract {
  private readonly registry: AgentOSRegistry;

  constructor(options: ModelProviderResolverOptions) {
    this.registry = options.registry;
  }

  resolve(request: ModelProviderResolutionRequest = {}): ModelProviderResolutionResult {
    if (request.providerId) {
      const provider = this.registry.findModelProvider(request.providerId);

      if (provider) {
        return createResolution(provider, "matched_provider_id");
      }

      return createMissingProviderResult("model_provider_not_found", "No provider matched id.", {
        providerId: request.providerId,
      });
    }

    const capability = normalizeCapability(request.capability);

    if (capability) {
      const provider = this.findByCapability(capability);

      if (provider) {
        return createResolution(provider, "matched_capability");
      }

      return createMissingProviderResult(
        "model_provider_capability_not_found",
        "No provider matched capability.",
        {
          capability,
        }
      );
    }

    if (request.useDefault !== false) {
      const provider = this.registry.defaultModelProvider();

      if (provider) {
        return createResolution(provider, "matched_default_provider");
      }
    }

    return createMissingProviderResult(
      "model_provider_default_not_found",
      "No default model provider is registered."
    );
  }

  private findByCapability(capability: string): ModelProvider | undefined {
    return this.registry
      .listModelProviders()
      .find((provider) => provider.capabilities.map(normalizeCapability).includes(capability));
  }
}

function createResolution(provider: ModelProvider, reason: string): ModelProviderResolutionResult {
  return {
    success: true,
    provider,
    reason,
    errors: [],
    metadata: {
      providerId: provider.id,
      providerName: provider.name,
      capabilities: provider.capabilities,
    },
  };
}

function createMissingProviderResult(
  code: string,
  message: string,
  metadata: Record<string, unknown> = {}
): ModelProviderResolutionResult {
  return {
    success: false,
    reason: "no_model_provider_matched",
    errors: [
      {
        code,
        message,
        recoverable: true,
        metadata,
      },
    ],
  };
}

function normalizeCapability(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  return value.trim().toLowerCase();
}
