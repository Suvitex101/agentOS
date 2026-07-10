import {
  ModelFinishReason,
  ModelProviderCapability,
  PlanStatus,
  PlanStepStatus,
  PlanStepType,
  PlannerStrategyType,
  type Agent,
  type AgentOSError,
  type ExecutionContext,
  type ModelAssistedPlannerOptions,
  type ModelGenerationResponse,
  type ModelProvider,
  type Plan,
  type PlanComplexityEstimate,
  type Planner,
  type PlannerProviderRequest,
  type PlanStep,
  type PlanValidationResult,
  type Task,
} from "@agentos/types";
import { ModelProviderResolver } from "./model-provider-resolver";
import { RuleBasedPlanner } from "./rule-based-planner";

export interface ModelAssistedPlannerConstructorOptions {
  id?: string;
  name?: string;
  providerResolver: ModelProviderResolver;
  fallbackPlanner?: Planner;
  options?: ModelAssistedPlannerOptions;
}

interface ProviderPlanStep {
  description?: unknown;
  type?: unknown;
  requiredTool?: unknown;
  requiredCapability?: unknown;
}

interface ProviderPlanPayload {
  steps?: unknown;
}

interface NormalizedProviderPlan {
  steps: Array<{
    description: string;
    type: PlanStepType;
    requiredTool?: string;
    requiredCapability?: string;
  }>;
  parsingStatus: "parsed";
}

const DEFAULT_MAX_STEPS = 8;
const REQUIRED_CAPABILITIES = [ModelProviderCapability.TextGeneration];
const PREFERRED_CAPABILITIES = [
  ModelProviderCapability.Reasoning,
  ModelProviderCapability.StructuredOutput,
];

const STEP_TYPE_ALIASES: Record<string, PlanStepType> = {
  ask_user: PlanStepType.AskUser,
  askuser: PlanStepType.AskUser,
  capability: PlanStepType.UseTool,
  execute: PlanStepType.UseTool,
  reason: PlanStepType.Reason,
  reasoning: PlanStepType.Reason,
  research: PlanStepType.Reason,
  respond: PlanStepType.Respond,
  response: PlanStepType.Respond,
  summarize: PlanStepType.Respond,
  tool: PlanStepType.UseTool,
  transform: PlanStepType.Transform,
  use_tool: PlanStepType.UseTool,
  usetool: PlanStepType.UseTool,
  validate: PlanStepType.Validate,
  validation: PlanStepType.Validate,
};

const PRIVILEGED_PROVIDER_FIELDS = new Set([
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
  "execute",
]);

export class ModelAssistedPlanner implements Planner {
  readonly id: string;
  readonly name: string;
  readonly strategy = {
    id: "model-assisted",
    name: "Model-assisted planning",
    type: PlannerStrategyType.Hybrid,
    description: "Uses a resolved local model provider to generate structured AgentOS plans.",
  };

  private readonly providerResolver: ModelProviderResolver;
  private readonly fallbackPlanner: Planner;
  private readonly defaultOptions: ModelAssistedPlannerOptions;

  constructor(options: ModelAssistedPlannerConstructorOptions) {
    this.id = options.id ?? "model-assisted-planner";
    this.name = options.name ?? "ModelAssistedPlanner";
    this.providerResolver = options.providerResolver;
    this.fallbackPlanner = options.fallbackPlanner ?? new RuleBasedPlanner();
    this.defaultOptions = Object.freeze({
      fallback: "rule-based",
      maxSteps: DEFAULT_MAX_STEPS,
      ...options.options,
    });
  }

  async plan(
    agent: Agent,
    task: Task,
    context: ExecutionContext,
    options?: ModelAssistedPlannerOptions
  ): Promise<Plan> {
    return this.createProviderPlan(agent, task, context, this.mergeOptions(options));
  }

  async replan(
    agent: Agent,
    task: Task,
    context: ExecutionContext,
    previousPlan: Plan,
    options?: ModelAssistedPlannerOptions
  ): Promise<Plan> {
    return this.createProviderPlan(agent, task, context, this.mergeOptions(options), previousPlan);
  }

  validatePlan(plan: Plan): PlanValidationResult | Promise<PlanValidationResult> {
    return this.fallbackPlanner.validatePlan(plan);
  }

  estimateComplexity(task: Task): PlanComplexityEstimate | Promise<PlanComplexityEstimate> {
    return this.fallbackPlanner.estimateComplexity(task);
  }

  private async createProviderPlan(
    agent: Agent,
    task: Task,
    context: ExecutionContext,
    options: ModelAssistedPlannerOptions,
    previousPlan?: Plan
  ): Promise<Plan> {
    try {
      validatePlannerOptions(options);

      const provider = this.resolveProvider(options.provider);
      const prompt = buildProviderPrompt(agent, task, context, previousPlan, options.maxSteps);
      const generationStartedAt = Date.now();
      const response = await provider.generate({
        prompt,
        systemPrompt: options.systemPrompt ?? defaultSystemPrompt(),
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        metadata: {
          plannerId: this.id,
          taskId: task.id,
          previousPlanId: previousPlan?.id,
          ...options.metadata,
        },
      });
      const providerDurationMs = response.durationMs ?? Date.now() - generationStartedAt;
      const normalized = parseProviderPlan(response, options.maxSteps ?? DEFAULT_MAX_STEPS);
      const plan = createPlanFromProviderSteps({
        planner: this,
        agent,
        task,
        provider,
        response,
        providerDurationMs,
        normalized,
        previousPlan,
        includeRawResponse: options.includeRawResponse === true,
      });
      const validation = await this.validatePlan(plan);

      if (!validation.valid) {
        throw createPlannerError(
          "model_planner_invalid_plan_structure",
          "Model-assisted planner produced an invalid AgentOS plan.",
          {
            validation,
          }
        );
      }

      return plan;
    } catch (error) {
      if (options.fallback === "rule-based") {
        return this.createFallbackPlan(agent, task, context, options, previousPlan, error);
      }

      throw normalizePlannerError(error);
    }
  }

  private resolveProvider(request: PlannerProviderRequest | undefined): ModelProvider {
    const providerRequest = normalizeProviderRequest(request);

    if (providerRequest.providerId) {
      const explicit = this.providerResolver.resolve({
        providerId: providerRequest.providerId,
      });

      if (!explicit.success || !explicit.provider) {
        throw createPlannerError(
          "model_planner_provider_not_found",
          "Requested model provider was not found.",
          {
            providerId: providerRequest.providerId,
            resolution: explicit,
          }
        );
      }

      assertRequiredCapabilities(explicit.provider, providerRequest.requiredCapabilities);

      return explicit.provider;
    }

    for (const capability of [
      ...providerRequest.preferredCapabilities,
      ...providerRequest.requiredCapabilities,
    ]) {
      const resolution = this.providerResolver.resolve({
        capability,
      });

      if (resolution.success && resolution.provider) {
        assertRequiredCapabilities(resolution.provider, providerRequest.requiredCapabilities);

        return resolution.provider;
      }
    }

    if (providerRequest.allowDefaultProvider !== false) {
      const resolution = this.providerResolver.resolve();

      if (resolution.success && resolution.provider) {
        assertRequiredCapabilities(resolution.provider, providerRequest.requiredCapabilities);

        return resolution.provider;
      }
    }

    throw createPlannerError(
      "model_planner_provider_not_found",
      "No model provider matched the planner requirements.",
      {
        providerRequest,
      }
    );
  }

  private createFallbackPlan(
    agent: Agent,
    task: Task,
    context: ExecutionContext,
    options: ModelAssistedPlannerOptions,
    previousPlan: Plan | undefined,
    error: unknown
  ): Plan {
    const fallback =
      previousPlan && "replan" in this.fallbackPlanner
        ? this.fallbackPlanner.replan(agent, task, context, previousPlan, options)
        : this.fallbackPlanner.plan(agent, task, context, options);

    if (fallback instanceof Promise) {
      throw createPlannerError(
        "model_planner_async_fallback_unsupported",
        "Asynchronous fallback planners are not supported in this phase."
      );
    }

    return {
      ...fallback,
      metadata: {
        ...fallback.metadata,
        fallbackUsed: true,
        fallbackReason: normalizePlannerError(error).code,
        modelAssistedPlanner: this.name,
        generatedAt: fallback.metadata?.generatedAt ?? new Date(),
      },
    };
  }

  private mergeOptions(options?: ModelAssistedPlannerOptions): ModelAssistedPlannerOptions {
    return {
      ...this.defaultOptions,
      ...options,
      provider: {
        ...this.defaultOptions.provider,
        ...options?.provider,
      },
      metadata: {
        ...this.defaultOptions.metadata,
        ...options?.metadata,
      },
    };
  }
}

function normalizeProviderRequest(
  request: PlannerProviderRequest | undefined
): Required<Omit<PlannerProviderRequest, "providerId" | "metadata">> &
  Pick<PlannerProviderRequest, "providerId" | "metadata"> {
  return {
    providerId: request?.providerId,
    requiredCapabilities: [
      ...new Set([...(request?.requiredCapabilities ?? []), ...REQUIRED_CAPABILITIES]),
    ],
    preferredCapabilities: [
      ...new Set([...(request?.preferredCapabilities ?? []), ...PREFERRED_CAPABILITIES]),
    ],
    allowDefaultProvider: request?.allowDefaultProvider ?? true,
    metadata: request?.metadata,
  };
}

function assertRequiredCapabilities(
  provider: ModelProvider,
  requiredCapabilities: readonly string[]
): void {
  const providerCapabilities = provider.capabilities.map(normalizeCapability);
  const missing = requiredCapabilities.filter(
    (capability) => !providerCapabilities.includes(normalizeCapability(capability))
  );

  if (missing.length > 0) {
    throw createPlannerError(
      "model_planner_provider_capability_mismatch",
      `Model provider "${provider.id}" is missing required capabilities: ${missing.join(", ")}.`,
      {
        providerId: provider.id,
        requiredCapabilities,
        providerCapabilities: provider.capabilities,
      }
    );
  }
}

function validatePlannerOptions(options: ModelAssistedPlannerOptions): void {
  if (options.temperature !== undefined && (options.temperature < 0 || options.temperature > 2)) {
    throw createPlannerError(
      "model_planner_invalid_options",
      "temperature must be between 0 and 2."
    );
  }

  if (options.maxTokens !== undefined && options.maxTokens <= 0) {
    throw createPlannerError("model_planner_invalid_options", "maxTokens must be greater than 0.");
  }

  if (options.maxSteps !== undefined && (options.maxSteps <= 0 || options.maxSteps > 20)) {
    throw createPlannerError("model_planner_invalid_options", "maxSteps must be between 1 and 20.");
  }
}

function buildProviderPrompt(
  agent: Agent,
  task: Task,
  context: ExecutionContext,
  previousPlan: Plan | undefined,
  maxSteps: number | undefined
): string {
  const payload = {
    taskObjective: stringifyTaskInput(task.input),
    agentCapabilities: agent.capabilities.map((capability) => capability.name),
    memoryCount: context.memory.length,
    resourceCount: context.resources?.length ?? 0,
    maxSteps: maxSteps ?? DEFAULT_MAX_STEPS,
    previousPlan: previousPlan
      ? {
          id: previousPlan.id,
          steps: previousPlan.steps.map((step) => ({
            order: step.order,
            description: step.description,
            status: step.status,
          })),
          reasonForReplanning: "Create a safer updated plan for the same task.",
        }
      : undefined,
    expectedSchema: {
      steps: [
        {
          description: "Gather relevant information",
          type: "research",
          requiredCapability: "search",
        },
      ],
    },
  };

  return [
    "Create a minimal JSON plan for this AgentOS task.",
    "Return only JSON. Do not include ids, task ids, statuses, timestamps, tool outputs, or registry mutations.",
    JSON.stringify(payload),
  ].join("\n");
}

function defaultSystemPrompt(): string {
  return [
    "You are a planning component inside AgentOS.",
    "Return only a JSON object with a steps array.",
    "Each step must include a short description and may include type, requiredTool, or requiredCapability.",
    "Do not execute tools. Do not return tool results. Do not mutate registries.",
  ].join(" ");
}

function parseProviderPlan(
  response: ModelGenerationResponse,
  maxSteps: number
): NormalizedProviderPlan {
  let parsed: unknown;

  try {
    parsed = JSON.parse(response.text);
  } catch {
    throw createPlannerError(
      "model_planner_invalid_json",
      "Model provider response was not valid JSON."
    );
  }

  if (!isRecord(parsed)) {
    throw createPlannerError(
      "model_planner_invalid_plan_structure",
      "Model provider response must be a JSON object."
    );
  }

  rejectPrivilegedFields(parsed, "plan");

  const payload = parsed as ProviderPlanPayload;

  if (!Array.isArray(payload.steps)) {
    throw createPlannerError(
      "model_planner_missing_steps",
      "Model provider response must include a steps array."
    );
  }

  if (payload.steps.length === 0) {
    throw createPlannerError(
      "model_planner_empty_steps",
      "Model provider response must include at least one step."
    );
  }

  if (payload.steps.length > maxSteps) {
    throw createPlannerError(
      "model_planner_excessive_step_count",
      `Model provider returned ${payload.steps.length} steps, exceeding maxSteps ${maxSteps}.`
    );
  }

  const steps = payload.steps.map((step, index) => normalizeProviderStep(step, index));

  return {
    steps,
    parsingStatus: "parsed",
  };
}

function normalizeProviderStep(
  step: unknown,
  index: number
): NormalizedProviderPlan["steps"][number] {
  if (!isRecord(step)) {
    throw createPlannerError(
      "model_planner_invalid_plan_structure",
      `Step ${index + 1} must be a JSON object.`
    );
  }

  rejectPrivilegedFields(step, `step ${index + 1}`);

  const providerStep = step as ProviderPlanStep;
  const description =
    typeof providerStep.description === "string" ? providerStep.description.trim() : "";

  if (!description) {
    throw createPlannerError(
      "model_planner_invalid_plan_structure",
      `Step ${index + 1} must include a non-empty description.`
    );
  }

  const requiredTool =
    providerStep.requiredTool === undefined
      ? undefined
      : readProviderString(providerStep.requiredTool, "requiredTool", index);
  const requiredCapability =
    providerStep.requiredCapability === undefined
      ? undefined
      : readProviderString(providerStep.requiredCapability, "requiredCapability", index);

  return {
    description,
    type: normalizeStepType(providerStep.type),
    requiredTool,
    requiredCapability,
  };
}

function createPlanFromProviderSteps(input: {
  planner: ModelAssistedPlanner;
  agent: Agent;
  task: Task;
  provider: ModelProvider;
  response: ModelGenerationResponse;
  providerDurationMs: number;
  normalized: NormalizedProviderPlan;
  previousPlan?: Plan;
  includeRawResponse: boolean;
}): Plan {
  const createdAt = new Date();
  const planId = input.previousPlan
    ? `plan-${input.task.id}-model-replan-${sanitizeIdSegment(input.previousPlan.id)}`
    : `plan-${input.task.id}-model`;

  return {
    id: planId,
    taskId: input.task.id,
    status: PlanStatus.Ready,
    createdAt,
    updatedAt: createdAt,
    steps: input.normalized.steps.map((step, index) =>
      createPlanStep(planId, step, index, input.provider.id)
    ),
    metadata: {
      plannerName: input.planner.name,
      plannerStrategy: input.planner.strategy.type,
      providerId: input.provider.id,
      providerName: input.provider.name,
      providerModel: input.response.model,
      providerDurationMs: input.providerDurationMs,
      finishReason: input.response.finishReason ?? ModelFinishReason.Unknown,
      fallbackUsed: false,
      generatedAt: createdAt,
      responseParsingStatus: input.normalized.parsingStatus,
      previousPlanId: input.previousPlan?.id,
      rawProviderResponse: input.includeRawResponse ? input.response.text : undefined,
    },
  };
}

function createPlanStep(
  planId: string,
  step: NormalizedProviderPlan["steps"][number],
  index: number,
  providerId: string
): PlanStep {
  const order = index + 1;

  return {
    id: `${planId}-step-${order}`,
    order,
    type: step.type,
    description: step.description,
    requiredTool: step.requiredTool,
    status: PlanStepStatus.Pending,
    metadata: {
      requiredCapability: step.requiredCapability,
      generatedByProvider: providerId,
    },
  };
}

function normalizeStepType(type: unknown): PlanStepType {
  if (typeof type !== "string") {
    return PlanStepType.Reason;
  }

  const normalized = type
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");

  return STEP_TYPE_ALIASES[normalized] ?? PlanStepType.Reason;
}

function rejectPrivilegedFields(record: Record<string, unknown>, location: string): void {
  const privileged = Object.keys(record).filter((key) => PRIVILEGED_PROVIDER_FIELDS.has(key));

  if (privileged.length > 0) {
    throw createPlannerError(
      "model_planner_privileged_fields",
      `Model provider returned privileged fields in ${location}: ${privileged.join(", ")}.`
    );
  }
}

function readProviderString(value: unknown, field: string, index: number): string {
  if (typeof value !== "string") {
    throw createPlannerError(
      "model_planner_invalid_plan_structure",
      `Step ${index + 1} field "${field}" must be a string.`
    );
  }

  return value.trim();
}

function createPlannerError(
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

function normalizePlannerError(error: unknown): AgentOSError {
  if (isAgentOSError(error)) {
    return error;
  }

  return createPlannerError(
    "model_planner_generation_failed",
    error instanceof Error ? error.message : "Model-assisted planning failed."
  );
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeCapability(value: string): string {
  return value.trim().toLowerCase();
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

function sanitizeIdSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 60);
}
