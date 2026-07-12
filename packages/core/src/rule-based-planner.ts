import {
  PlanStatus,
  PlanStepStatus,
  PlanStepType,
  PlannerStrategyType,
  type Agent,
  type AgentOSError,
  type ExecutionContext,
  type Plan,
  type PlanComplexityEstimate,
  type Planner,
  type PlannerOptions,
  type PlanStep,
  type PlanValidationResult,
  type RuleBasedPlannerStrategy,
  type Task,
} from "@agentosdev/types";

type RuleMatch = "analysis" | "message" | "payment" | "default";

interface StepTemplate {
  description: string;
  type: PlanStepType;
  requiredCapability?: string;
}

const ANALYSIS_KEYWORDS = ["summarize", "summary", "analyze", "analyse", "analysis"];
const MESSAGE_KEYWORDS = ["send", "notify", "message", "email"];
const PAYMENT_KEYWORDS = ["payment", "invoice", "paystack", "flutterwave"];

const RULE_STEPS: Record<RuleMatch, StepTemplate[]> = {
  analysis: [
    {
      description: "Gather relevant information",
      type: PlanStepType.Reason,
      requiredCapability: "research",
    },
    {
      description: "Analyze content",
      type: PlanStepType.Transform,
      requiredCapability: "analytics",
    },
    {
      description: "Produce summary or findings",
      type: PlanStepType.Respond,
      requiredCapability: "communication",
    },
  ],
  message: [
    {
      description: "Prepare message content",
      type: PlanStepType.Transform,
      requiredCapability: "communication",
    },
    {
      description: "Identify recipient or channel",
      type: PlanStepType.Reason,
      requiredCapability: "messaging",
    },
    {
      description: "Send or schedule message",
      type: PlanStepType.UseTool,
      requiredCapability: "messaging",
    },
  ],
  payment: [
    {
      description: "Validate payment request",
      type: PlanStepType.Validate,
      requiredCapability: "payments",
    },
    {
      description: "Create payment or invoice action",
      type: PlanStepType.UseTool,
      requiredCapability: "payments",
    },
    {
      description: "Return payment status or link",
      type: PlanStepType.Respond,
      requiredCapability: "payments",
    },
  ],
  default: [
    {
      description: "Understand task",
      type: PlanStepType.Reason,
    },
    {
      description: "Determine required capability",
      type: PlanStepType.Reason,
    },
    {
      description: "Produce response",
      type: PlanStepType.Respond,
    },
  ],
};

export interface RuleBasedPlannerOptions {
  id?: string;
  name?: string;
}

export class RuleBasedPlanner implements Planner {
  readonly id: string;
  readonly name: string;
  readonly strategy: RuleBasedPlannerStrategy;

  constructor(options: RuleBasedPlannerOptions = {}) {
    this.id = options.id ?? "rule-based-planner";
    this.name = options.name ?? "RuleBasedPlanner";
    this.strategy = {
      id: "rule-based",
      name: "Rule-based planning",
      type: PlannerStrategyType.RuleBased,
      description: "Deterministic keyword-based planning for simple AgentOS tasks.",
    };
  }

  plan(_agent: Agent, task: Task, _context: ExecutionContext, options?: PlannerOptions): Plan {
    return this.createPlan(task, options);
  }

  replan(
    _agent: Agent,
    task: Task,
    _context: ExecutionContext,
    previousPlan: Plan,
    options?: PlannerOptions
  ): Plan {
    return this.createPlan(task, options, previousPlan.id);
  }

  validatePlan(plan: Plan): PlanValidationResult {
    const errors: AgentOSError[] = [];
    const stepIds = new Set<string>();

    if (!plan.taskId) {
      errors.push({
        code: "plan_missing_task_id",
        message: "Plan must include a taskId.",
        recoverable: true,
      });
    }

    if (plan.steps.length === 0) {
      errors.push({
        code: "plan_missing_steps",
        message: "Plan must include at least one step.",
        recoverable: true,
      });
    }

    for (const [index, step] of plan.steps.entries()) {
      if (stepIds.has(step.id)) {
        errors.push({
          code: "plan_duplicate_step_id",
          message: `Step id "${step.id}" must be unique.`,
          recoverable: true,
        });
      }

      stepIds.add(step.id);

      if (step.order !== index + 1) {
        errors.push({
          code: "plan_step_order_invalid",
          message: `Step "${step.id}" must have order ${index + 1}.`,
          recoverable: true,
        });
      }

      if (step.description.trim().length === 0) {
        errors.push({
          code: "plan_step_missing_description",
          message: `Step "${step.id}" must include a description.`,
          recoverable: true,
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
      metadata: {
        validator: this.name,
        checkedAt: new Date(),
      },
    };
  }

  estimateComplexity(task: Task, _options?: PlannerOptions): PlanComplexityEstimate {
    const text = stringifyTaskInput(task.input);
    const words = text.split(/\s+/).filter(Boolean);
    const keywordCount = countKeywordMatches(text);
    const multiStepSignals = countMultiStepSignals(text);
    const score = words.length + keywordCount * 8 + multiStepSignals * 10;

    let level: PlanComplexityEstimate["level"] = "low";

    if (score >= 55 || multiStepSignals >= 2) {
      level = "high";
    } else if (score >= 25 || keywordCount >= 2 || multiStepSignals === 1) {
      level = "medium";
    }

    return {
      score,
      level,
      estimatedSteps: 3,
      metadata: {
        keywordCount,
        wordCount: words.length,
        multiStepSignals,
      },
    };
  }

  private createPlan(task: Task, options?: PlannerOptions, previousPlanId?: string): Plan {
    const ruleMatched = matchRule(task.input);
    const complexity = this.estimateComplexity(task, options);
    const createdAt = new Date();
    const planId = previousPlanId
      ? `plan-${task.id}-replan-${toIdSegment(previousPlanId)}`
      : `plan-${task.id}`;

    return {
      id: planId,
      taskId: task.id,
      steps: createSteps(planId, RULE_STEPS[ruleMatched], ruleMatched),
      status: PlanStatus.Ready,
      createdAt,
      updatedAt: createdAt,
      metadata: {
        plannerName: this.name,
        plannerStrategy: this.strategy.type,
        estimatedComplexity: complexity,
        generatedAt: createdAt,
        ruleMatched,
        previousPlanId,
      },
    };
  }
}

function createSteps(
  planId: string,
  templates: StepTemplate[],
  ruleMatched: RuleMatch
): PlanStep[] {
  return templates.map((template, index) => {
    const order = index + 1;

    return {
      id: `${planId}-step-${order}`,
      order,
      type: template.type,
      description: template.description,
      status: PlanStepStatus.Pending,
      metadata: {
        ruleMatched,
        requiredCapability: template.requiredCapability,
      },
    };
  });
}

function matchRule(input: unknown): RuleMatch {
  const text = stringifyTaskInput(input);

  if (hasKeyword(text, ANALYSIS_KEYWORDS)) {
    return "analysis";
  }

  if (hasKeyword(text, PAYMENT_KEYWORDS)) {
    return "payment";
  }

  if (hasKeyword(text, MESSAGE_KEYWORDS)) {
    return "message";
  }

  return "default";
}

function stringifyTaskInput(input: unknown): string {
  if (typeof input === "string") {
    return input.toLowerCase();
  }

  if (input === null || input === undefined) {
    return "";
  }

  try {
    return JSON.stringify(input).toLowerCase();
  } catch {
    return String(input).toLowerCase();
  }
}

function hasKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => new RegExp(`\\b${keyword}\\b`, "i").test(text));
}

function countKeywordMatches(text: string): number {
  return [...ANALYSIS_KEYWORDS, ...MESSAGE_KEYWORDS, ...PAYMENT_KEYWORDS].filter((keyword) =>
    new RegExp(`\\b${keyword}\\b`, "i").test(text)
  ).length;
}

function countMultiStepSignals(text: string): number {
  const signals = [",", " and ", " then ", " after ", " before ", "\n"];

  return signals.filter((signal) => text.includes(signal)).length;
}

function toIdSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
