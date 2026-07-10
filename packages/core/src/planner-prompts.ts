import {
  ModelProviderCapability,
  PlanSchemaVersion,
  PlanStepType,
  PlannerPromptVersion,
  type Agent,
  type AgentOSMetadata,
  type ModelProvider,
  type Plan,
  type PlanValidationIssue,
  type RegisteredTool,
  type Task,
} from "@agentos/types";

export const PLANNER_PROMPT_VERSION = PlannerPromptVersion.V1;

export const PLANNER_PROMPT_METADATA = Object.freeze({
  id: "agentos-model-assisted-planner",
  version: PLANNER_PROMPT_VERSION,
  schemaVersion: PlanSchemaVersion.V1,
  description: "Default AgentOS model-assisted planning prompt.",
});

export const DEFAULT_PLANNING_SYSTEM_PROMPT = Object.freeze(
  [
    "You are a planning component inside AgentOS.",
    "Return JSON only.",
    "Do not return Markdown.",
    "Do not use code fences.",
    "Do not include explanations.",
    "Do not include comments.",
    "Do not execute tools.",
    "Do not return tool results.",
    "Do not mutate registries or memory.",
  ].join(" ")
);

export const REPAIR_SYSTEM_PROMPT = Object.freeze(
  [
    "You repair invalid AgentOS plan JSON.",
    "Return JSON only.",
    "Do not return Markdown, code fences, explanations, or comments.",
    "Never include privileged fields.",
  ].join(" ")
);

export interface PlannerPromptBuildInput {
  agent: Agent;
  task: Task;
  provider: ModelProvider;
  previousPlan?: Plan;
  maxSteps: number;
}

export interface PlannerRepairPromptBuildInput {
  task: Task;
  provider: ModelProvider;
  originalResponse: string;
  issues: PlanValidationIssue[];
  error?: {
    code: string;
    message: string;
  };
  maxSteps: number;
}

export interface PlannerPromptBuildResult {
  prompt: string;
  systemPrompt: string;
  metadata: PlannerPromptMetadata;
}

export interface PlannerPromptMetadata {
  promptVersion: PlannerPromptVersion;
  promptSize: number;
  providerCapabilityPath: "structured-output" | "standard";
  schemaVersion: PlanSchemaVersion;
  includedToolCount: number;
  includedCapabilityCount: number;
}

const MINIMAL_VALID_JSON_EXAMPLE = Object.freeze({
  steps: [
    {
      description: "Gather relevant information",
      type: PlanStepType.Reason,
      requiredCapability: "research",
      input: {},
    },
  ],
});

export function buildPlanningPrompt(input: PlannerPromptBuildInput): PlannerPromptBuildResult {
  const providerCapabilityPath = providerSupportsStructuredOutput(input.provider)
    ? "structured-output"
    : "standard";
  const tools = readAvailableTools(input.agent);
  const capabilities = readAgentCapabilities(input.agent);
  const payload = {
    promptVersion: PLANNER_PROMPT_VERSION,
    taskObjective: stringifyTaskInput(input.task.input),
    maxSteps: input.maxSteps,
    supportedSchemaVersion: PlanSchemaVersion.V1,
    supportedStepTypes: Object.values(PlanStepType),
    agentCapabilities: capabilities,
    availableTools: tools,
    providerCapabilityPath,
    jsonOnlyInstructions: [
      "Return JSON only.",
      "No Markdown.",
      "No code fences.",
      "No explanations.",
      "No comments.",
    ],
    forbiddenFields: [
      "id",
      "taskId",
      "status",
      "createdAt",
      "updatedAt",
      "metadata",
      "output",
      "toolOutput",
      "toolResult",
      "registryMutation",
      "memoryMutation",
      "execute",
    ],
    expectedShape: {
      steps: [
        {
          description: "string",
          type: "one supported step type",
          requiredTool: "optional registered tool id",
          requiredCapability: "optional capability name",
          input: "optional plain object",
        },
      ],
    },
    minimalValidJsonExample: MINIMAL_VALID_JSON_EXAMPLE,
    previousPlan: input.previousPlan
      ? {
          steps: input.previousPlan.steps.map((step) => ({
            order: step.order,
            description: step.description,
            status: step.status,
          })),
          reasonForReplanning: "Create a safer updated plan for the same task.",
        }
      : undefined,
  };
  const guidance =
    providerCapabilityPath === "structured-output"
      ? "The provider declares structured-output. Produce strict JSON matching the expected shape."
      : "Produce compact JSON matching the expected shape.";
  const prompt = [
    "Create a minimal AgentOS plan for this task.",
    guidance,
    "Do not include AgentOS-owned ids, task ids, statuses, timestamps, metadata, tool outputs, registry mutations, memory mutations, or executable fields.",
    JSON.stringify(payload),
  ].join("\n");

  return {
    prompt,
    systemPrompt: DEFAULT_PLANNING_SYSTEM_PROMPT,
    metadata: Object.freeze({
      promptVersion: PLANNER_PROMPT_VERSION,
      promptSize: prompt.length,
      providerCapabilityPath,
      schemaVersion: PlanSchemaVersion.V1,
      includedToolCount: tools.length,
      includedCapabilityCount: capabilities.length,
    }),
  };
}

export function buildRepairPrompt(input: PlannerRepairPromptBuildInput): PlannerPromptBuildResult {
  const providerCapabilityPath = providerSupportsStructuredOutput(input.provider)
    ? "structured-output"
    : "standard";
  const payload = {
    promptVersion: PLANNER_PROMPT_VERSION,
    taskObjective: stringifyTaskInput(input.task.input),
    maxSteps: input.maxSteps,
    supportedSchemaVersion: PlanSchemaVersion.V1,
    supportedStepTypes: Object.values(PlanStepType),
    providerCapabilityPath,
    validationError: input.error,
    validationIssues: input.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      path: issue.path,
    })),
    originalResponse: input.originalResponse.slice(0, 12000),
    minimalValidJsonExample: MINIMAL_VALID_JSON_EXAMPLE,
  };
  const prompt = [
    "Repair the AgentOS plan JSON.",
    "Return corrected JSON only.",
    "No Markdown. No code fences. No explanations. No comments.",
    "Preserve the user's intent.",
    "Do not include ids, task ids, statuses, timestamps, metadata mutations, tool outputs, registry mutations, memory mutations, or executable fields.",
    JSON.stringify(payload),
  ].join("\n");

  return {
    prompt,
    systemPrompt: REPAIR_SYSTEM_PROMPT,
    metadata: Object.freeze({
      promptVersion: PLANNER_PROMPT_VERSION,
      promptSize: prompt.length,
      providerCapabilityPath,
      schemaVersion: PlanSchemaVersion.V1,
      includedToolCount: 0,
      includedCapabilityCount: 0,
    }),
  };
}

function providerSupportsStructuredOutput(provider: ModelProvider): boolean {
  return provider.capabilities
    .map((capability) => capability.trim().toLowerCase())
    .includes(ModelProviderCapability.StructuredOutput);
}

function readAgentCapabilities(agent: Agent): string[] {
  return (agent.capabilities ?? [])
    .map((capability) => capability.name)
    .filter((capability) => capability.trim().length > 0)
    .slice(0, 20);
}

function readAvailableTools(agent: Agent): Array<{
  id: string;
  name: string;
  capability?: string;
  description?: string;
}> {
  return ((agent.tools ?? []) as RegisteredTool[])
    .map((tool) => ({
      id: tool.id,
      name: tool.name,
      capability: tool.capability,
      description: tool.description,
    }))
    .slice(0, 20);
}

function stringifyTaskInput(input: unknown): string {
  if (typeof input === "string") {
    return input;
  }

  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
}

export function createPlannerPromptMetadata(metadata: PlannerPromptMetadata): AgentOSMetadata {
  return {
    promptVersion: metadata.promptVersion,
    promptSize: metadata.promptSize,
    providerCapabilityPath: metadata.providerCapabilityPath,
    schemaVersion: metadata.schemaVersion,
    includedToolCount: metadata.includedToolCount,
    includedCapabilityCount: metadata.includedCapabilityCount,
  };
}
