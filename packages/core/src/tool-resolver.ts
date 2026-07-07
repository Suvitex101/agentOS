import {
  PlanStepType,
  type RegisteredTool,
  type ToolResolutionRequest,
  type ToolResolutionResult,
  type ToolResolver as ToolResolverContract,
} from "@agentos/types";
import type { AgentOSRegistry } from "./agentos-registry";

export interface ToolResolverOptions {
  registry: AgentOSRegistry;
}

export class ToolResolver implements ToolResolverContract {
  private readonly registry: AgentOSRegistry;

  constructor(options: ToolResolverOptions) {
    this.registry = options.registry;
  }

  resolve(request: ToolResolutionRequest): ToolResolutionResult {
    const explicitToolId = request.toolId ?? request.step?.requiredTool;

    if (explicitToolId) {
      const tool = this.registry.findToolById(explicitToolId);

      if (tool) {
        return createResolution(tool, "matched_explicit_tool_id");
      }
    }

    const descriptionTool = this.findByDescription(request);

    if (descriptionTool) {
      return createResolution(descriptionTool, "matched_step_description");
    }

    const capability = normalizeCapability(request.capability ?? request.capabilityId);

    if (capability) {
      const tool = this.findByCapability(capability);

      if (tool) {
        return createResolution(tool, "matched_capability");
      }
    }

    const tool = this.findByStep(request);

    if (tool) {
      return createResolution(tool, "matched_step");
    }

    return {
      success: false,
      reason: "no_tool_matched",
      errors: [
        {
          code: "tool_not_found",
          message: "No registered tool matched the requested step.",
          recoverable: true,
          metadata: {
            capability,
            stepType: request.stepType ?? request.step?.type,
            stepId: request.step?.id,
          },
        },
      ],
    };
  }

  private findByCapability(capability: string): RegisteredTool | undefined {
    return this.registry.listTools().find((tool) => {
      const capabilityIds = tool.capabilityIds.map(normalizeCapability);

      return (
        normalizeCapability(tool.capability) === capability ||
        capabilityIds.includes(capability) ||
        tool.capabilityIds.some((capabilityId) => capabilityId.endsWith(`-${capability}`))
      );
    });
  }

  private findByStep(request: ToolResolutionRequest): RegisteredTool | undefined {
    const stepType = request.stepType ?? request.step?.type;

    if (stepType === PlanStepType.Respond) {
      return this.findByCapability("communication") ?? this.findByCapability("general");
    }

    if (stepType === PlanStepType.Transform) {
      return this.findByCapability("analytics") ?? this.findByCapability("general");
    }

    if (stepType === PlanStepType.UseTool) {
      return this.findByCapability("general");
    }

    return this.findByCapability("general");
  }

  private findByDescription(request: ToolResolutionRequest): RegisteredTool | undefined {
    const description = request.step?.description.toLowerCase() ?? "";

    if (description.includes("invoice") || description.includes("payment")) {
      return this.registry.findToolById("tool-create-invoice") ?? this.findByCapability("payments");
    }

    if (description.includes("message") || description.includes("recipient")) {
      return (
        this.registry.findToolById("tool-prepare-message") ??
        this.findByCapability("messaging") ??
        this.findByCapability("communication")
      );
    }

    if (
      description.includes("summary") ||
      description.includes("summarize") ||
      description.includes("findings")
    ) {
      return (
        this.registry.findToolById("tool-summarize-messages") ??
        this.findByCapability("communication") ??
        this.findByCapability("research")
      );
    }

    if (description.includes("analyze") || description.includes("analysis")) {
      return (
        this.registry.findToolById("tool-analyze-text") ??
        this.findByCapability("analytics") ??
        this.findByCapability("research")
      );
    }

    return undefined;
  }
}

function createResolution(tool: RegisteredTool, reason: string): ToolResolutionResult {
  return {
    success: true,
    tool,
    reason,
    errors: [],
    metadata: {
      toolId: tool.id,
      toolName: tool.name,
      capability: tool.capability,
    },
  };
}

function normalizeCapability(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/^capability-/, "");
}
