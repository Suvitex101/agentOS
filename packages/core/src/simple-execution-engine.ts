import {
  ExecutionEventType,
  PlanStatus,
  PlanStepStatus,
  ResultStatus,
  TaskStatus,
  type Agent,
  type AgentOSError,
  type ExecutionContext,
  type ExecutionControlResult,
  type ExecutionEngine,
  type ExecutionOptions,
  type ExecutionTrace,
  type Plan,
  type PlanStep,
  type Result,
  type Task,
} from "@agentos/types";

export interface SimpleExecutionEngineOptions {
  id?: string;
  name?: string;
}

export class SimpleExecutionEngine implements ExecutionEngine {
  readonly id: string;
  readonly name: string;

  constructor(options: SimpleExecutionEngineOptions = {}) {
    this.id = options.id ?? "simple-execution-engine";
    this.name = options.name ?? "SimpleExecutionEngine";
  }

  executePlan(
    agent: Agent,
    task: Task,
    plan: Plan,
    context: ExecutionContext,
    options?: ExecutionOptions
  ): Result {
    const startedAt = new Date();
    const executionId = createExecutionId(task, plan, startedAt);
    const trace: ExecutionTrace[] = [];
    const errors = validateExecutionInput(task, plan);

    const runningTask: Task = {
      ...task,
      status: TaskStatus.Running,
      updatedAt: startedAt,
    };
    const runningPlan: Plan = {
      ...plan,
      status: PlanStatus.Running,
      updatedAt: startedAt,
    };
    const executionContext: ExecutionContext = {
      ...context,
      agent,
      task: runningTask,
      plan: runningPlan,
    };

    trace.push(
      createTrace(ExecutionEventType.TaskStarted, {
        input: task.input,
        metadata: {
          executionId,
          taskId: task.id,
          engine: this.name,
        },
      })
    );

    if (errors.length > 0) {
      const completedAt = new Date();

      trace.push(
        createTrace(ExecutionEventType.TaskFailed, {
          error: errors[0],
          metadata: {
            executionId,
            taskId: task.id,
            planId: plan.id,
            validationFailed: true,
          },
        })
      );

      return createResult({
        taskId: task.id,
        status: ResultStatus.Failed,
        plan,
        trace,
        errors,
        startedAt,
        completedAt,
        answer: "Execution failed validation.",
        metadata: {
          executionId,
          engine: this.name,
          validationFailed: true,
        },
      });
    }

    trace.push(
      createTrace(ExecutionEventType.PlanStarted, {
        input: runningPlan,
        metadata: {
          executionId,
          taskId: task.id,
          planId: plan.id,
        },
      })
    );

    const completedSteps: PlanStep[] = [];

    try {
      for (const step of runningPlan.steps) {
        trace.push(
          createTrace(ExecutionEventType.StepStarted, {
            stepId: step.id,
            input: step.input ?? step.description,
            metadata: {
              executionId,
              taskId: task.id,
              planId: plan.id,
              order: step.order,
            },
          })
        );

        const completedStep = this.executeStep(
          agent,
          runningTask,
          runningPlan,
          step,
          executionContext,
          options
        );

        completedSteps.push(completedStep);

        trace.push(
          createTrace(ExecutionEventType.StepCompleted, {
            stepId: completedStep.id,
            input: completedStep.input ?? completedStep.description,
            output: completedStep.output,
            metadata: {
              executionId,
              taskId: task.id,
              planId: plan.id,
              order: completedStep.order,
            },
          })
        );
      }

      const completedAt = new Date();
      const completedPlan: Plan = {
        ...runningPlan,
        status: PlanStatus.Completed,
        steps: completedSteps,
        updatedAt: completedAt,
      };

      trace.push(
        createTrace(ExecutionEventType.TaskCompleted, {
          output: completedSteps.map((step) => step.output),
          metadata: {
            executionId,
            taskId: task.id,
            planId: plan.id,
          },
        })
      );

      return createResult({
        taskId: task.id,
        status: ResultStatus.Completed,
        plan: completedPlan,
        trace,
        errors: [],
        startedAt,
        completedAt,
        answer: createAnswer(completedSteps),
        metadata: {
          executionId,
          engine: this.name,
          dryRun: options?.dryRun ?? false,
          simulated: true,
        },
      });
    } catch (error) {
      const completedAt = new Date();
      const agentError = normalizeError(error);

      trace.push(
        createTrace(ExecutionEventType.StepFailed, {
          error: agentError,
          metadata: {
            executionId,
            taskId: task.id,
            planId: plan.id,
          },
        })
      );

      trace.push(
        createTrace(ExecutionEventType.TaskFailed, {
          error: agentError,
          metadata: {
            executionId,
            taskId: task.id,
            planId: plan.id,
          },
        })
      );

      return createResult({
        taskId: task.id,
        status: ResultStatus.Failed,
        plan: {
          ...runningPlan,
          status: PlanStatus.Failed,
          steps: completedSteps,
          updatedAt: completedAt,
        },
        trace,
        errors: [agentError],
        startedAt,
        completedAt,
        answer: "Execution failed during simulated step processing.",
        metadata: {
          executionId,
          engine: this.name,
          simulated: true,
        },
      });
    }
  }

  executeStep(
    _agent: Agent,
    _task: Task,
    _plan: Plan,
    step: PlanStep,
    _context: ExecutionContext,
    _options?: ExecutionOptions
  ): PlanStep {
    return {
      ...step,
      status: PlanStepStatus.Completed,
      output: simulateStepOutput(step),
    };
  }

  pause(executionId: string): ExecutionControlResult {
    return createControlResult(
      executionId,
      "paused",
      "Pause acknowledged for future orchestration."
    );
  }

  resume(executionId: string): ExecutionControlResult {
    return createControlResult(
      executionId,
      "resumed",
      "Resume acknowledged for future orchestration."
    );
  }

  cancel(executionId: string): ExecutionControlResult {
    return createControlResult(
      executionId,
      "cancelled",
      "Cancel acknowledged for future orchestration."
    );
  }

  retry(executionId: string): ExecutionControlResult {
    return createControlResult(
      executionId,
      "retry_requested",
      "Retry acknowledged for future orchestration."
    );
  }
}

interface ResultInput {
  taskId: string;
  status: ResultStatus;
  answer: unknown;
  plan: Plan;
  trace: ExecutionTrace[];
  errors: AgentOSError[];
  startedAt: Date;
  completedAt: Date;
  metadata?: Record<string, unknown>;
}

function validateExecutionInput(task: Task, plan: Plan): AgentOSError[] {
  const errors: AgentOSError[] = [];

  if (plan.taskId !== task.id) {
    errors.push({
      code: "execution_plan_task_mismatch",
      message: `Plan taskId "${plan.taskId}" does not match task id "${task.id}".`,
      recoverable: true,
    });
  }

  if (plan.steps.length === 0) {
    errors.push({
      code: "execution_plan_missing_steps",
      message: "Plan must include at least one step before execution.",
      recoverable: true,
    });
  }

  for (const [index, step] of plan.steps.entries()) {
    if (step.order !== index + 1) {
      errors.push({
        code: "execution_step_order_invalid",
        message: `Step "${step.id}" must have order ${index + 1}.`,
        recoverable: true,
      });
    }
  }

  return errors;
}

function simulateStepOutput(step: PlanStep): string {
  const description = step.description.toLowerCase();

  if (description.includes("gather")) {
    return "Simulated information gathered.";
  }

  if (description.includes("analyze") || description.includes("analysis")) {
    return "Simulated analysis completed.";
  }

  if (description.includes("summary") || description.includes("findings")) {
    return "Simulated summary produced.";
  }

  if (description.includes("message")) {
    return "Simulated message prepared.";
  }

  if (description.includes("payment") || description.includes("invoice")) {
    return "Simulated payment action prepared.";
  }

  return "Simulated step completed.";
}

function createAnswer(steps: PlanStep[]): string {
  return steps
    .map((step) => `${step.order}. ${step.output ?? "Simulated step completed."}`)
    .join("\n");
}

function createTrace(
  event: ExecutionEventType,
  input: Omit<ExecutionTrace, "event" | "timestamp">
): ExecutionTrace {
  return {
    event,
    timestamp: new Date(),
    ...input,
  };
}

function createResult(input: ResultInput): Result {
  return {
    taskId: input.taskId,
    status: input.status,
    answer: input.answer,
    plan: input.plan,
    trace: input.trace,
    toolCalls: [],
    memoryWrites: [],
    errors: input.errors,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    durationMs: input.completedAt.getTime() - input.startedAt.getTime(),
    metadata: input.metadata,
  };
}

function createExecutionId(task: Task, plan: Plan, startedAt: Date): string {
  return `execution-${task.id}-${plan.id}-${startedAt.getTime()}`;
}

function createControlResult(
  executionId: string,
  status: ExecutionControlResult["status"],
  message: string
): ExecutionControlResult {
  return {
    executionId,
    accepted: true,
    status,
    message,
    metadata: {
      simulated: true,
      handledAt: new Date(),
    },
  };
}

function normalizeError(error: unknown): AgentOSError {
  if (error && typeof error === "object" && "message" in error) {
    return {
      code: "execution_step_failed",
      message: String(error.message),
      details: error,
      recoverable: true,
    };
  }

  return {
    code: "execution_step_failed",
    message: "Unknown simulated execution failure.",
    details: error,
    recoverable: true,
  };
}
