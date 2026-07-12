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
  type RegisteredTool,
  type Result,
  type Task,
  type ToolCallRecord,
  type ToolExecutionResult,
} from "@agentosdev/types";

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

  async executePlan(
    agent: Agent,
    task: Task,
    plan: Plan,
    context: ExecutionContext,
    options?: ExecutionOptions
  ): Promise<Result> {
    const startedAt = new Date();
    const executionId = createExecutionId(task, plan, startedAt);
    const trace: ExecutionTrace[] = [];
    const errors = validateExecutionInput(task, plan);
    const toolCalls: ToolCallRecord[] = [];

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
        toolCalls,
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
    const executionErrors: AgentOSError[] = [];

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

      const stepExecution = await executeStepWithResolver({
        agent,
        task: runningTask,
        plan: runningPlan,
        step,
        context: executionContext,
        options,
        executionId,
        engineName: this.name,
      });

      completedSteps.push(stepExecution.step);
      trace.push(...stepExecution.trace);
      toolCalls.push(...stepExecution.toolCalls);
      executionErrors.push(...stepExecution.errors);
    }

    const completedAt = new Date();
    const failed = executionErrors.length > 0;
    const completedPlan: Plan = {
      ...runningPlan,
      status: failed ? PlanStatus.Failed : PlanStatus.Completed,
      steps: completedSteps,
      updatedAt: completedAt,
    };

    trace.push(
      createTrace(failed ? ExecutionEventType.TaskFailed : ExecutionEventType.TaskCompleted, {
        output: completedSteps.map((step) => step.output),
        error: executionErrors[0],
        metadata: {
          executionId,
          taskId: task.id,
          planId: plan.id,
          toolCallCount: toolCalls.length,
        },
      })
    );

    return createResult({
      taskId: task.id,
      status: failed ? ResultStatus.Failed : ResultStatus.Completed,
      plan: completedPlan,
      trace,
      toolCalls,
      errors: executionErrors,
      startedAt,
      completedAt,
      answer: createAnswer(completedSteps),
      metadata: {
        executionId,
        engine: this.name,
        dryRun: options?.dryRun ?? false,
        simulated: false,
        localMockTools: true,
        toolCallCount: toolCalls.length,
      },
    });
  }

  async executeStep(
    agent: Agent,
    task: Task,
    plan: Plan,
    step: PlanStep,
    context: ExecutionContext,
    options?: ExecutionOptions
  ): Promise<PlanStep> {
    const execution = await executeStepWithResolver({
      agent,
      task,
      plan,
      step,
      context,
      options,
      executionId: createExecutionId(task, plan, new Date()),
      engineName: this.name,
    });

    return execution.step;
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

interface StepExecutionInput {
  agent: Agent;
  task: Task;
  plan: Plan;
  step: PlanStep;
  context: ExecutionContext;
  options?: ExecutionOptions;
  executionId: string;
  engineName: string;
}

interface StepExecutionOutput {
  step: PlanStep;
  trace: ExecutionTrace[];
  toolCalls: ToolCallRecord[];
  errors: AgentOSError[];
}

interface ResultInput {
  taskId: string;
  status: ResultStatus;
  answer: unknown;
  plan: Plan;
  trace: ExecutionTrace[];
  toolCalls: ToolCallRecord[];
  errors: AgentOSError[];
  startedAt: Date;
  completedAt: Date;
  metadata?: Record<string, unknown>;
}

async function executeStepWithResolver(input: StepExecutionInput): Promise<StepExecutionOutput> {
  const trace: ExecutionTrace[] = [];
  const toolCalls: ToolCallRecord[] = [];
  const errors: AgentOSError[] = [];
  const requiredCapability = getRequiredCapability(input.step);

  trace.push(
    createTrace(ExecutionEventType.ToolRequested, {
      stepId: input.step.id,
      input: {
        capability: requiredCapability,
        toolId: input.step.requiredTool,
        stepType: input.step.type,
      },
      metadata: {
        executionId: input.executionId,
        taskId: input.task.id,
        planId: input.plan.id,
      },
    })
  );

  if (!input.options?.toolResolver) {
    const error = createExecutionError(
      "execution_missing_tool_resolver",
      "Execution requires a ToolResolver."
    );

    trace.push(createFailedToolTrace(input, error), createFailedStepTrace(input, error));
    errors.push(error);

    return {
      step: failStep(input.step, error),
      trace,
      toolCalls,
      errors,
    };
  }

  const resolution = input.options.toolResolver.resolve({
    capability: requiredCapability,
    toolId: input.step.requiredTool,
    stepType: input.step.type,
    step: input.step,
    task: input.task,
  });

  if (!resolution.success || !resolution.tool) {
    const error =
      resolution.errors[0] ??
      createExecutionError("execution_tool_not_found", "No registered tool matched the step.");

    trace.push(createFailedToolTrace(input, error), createFailedStepTrace(input, error));
    errors.push(error);

    return {
      step: failStep(input.step, error),
      trace,
      toolCalls,
      errors,
    };
  }

  const tool = resolution.tool;

  trace.push(
    createTrace(ExecutionEventType.ToolResolved, {
      stepId: input.step.id,
      output: {
        toolId: tool.id,
        toolName: tool.name,
        reason: resolution.reason,
      },
      metadata: {
        executionId: input.executionId,
        taskId: input.task.id,
        planId: input.plan.id,
        capability: requiredCapability,
      },
    })
  );

  const toolInput = createToolInput(input, tool);
  const toolStartedAt = new Date();
  const toolCallId = `tool-call-${input.step.id}-${toolStartedAt.getTime()}`;

  trace.push(
    createTrace(ExecutionEventType.ToolStarted, {
      stepId: input.step.id,
      input: toolInput,
      metadata: {
        executionId: input.executionId,
        taskId: input.task.id,
        planId: input.plan.id,
        toolId: tool.id,
        toolName: tool.name,
      },
    })
  );

  const toolResult = await executeTool(tool, toolInput, input.context);
  const toolCompletedAt = new Date();
  const toolCall = createToolCall({
    id: toolCallId,
    tool,
    step: input.step,
    input: toolInput,
    result: toolResult,
    startedAt: toolStartedAt,
    completedAt: toolCompletedAt,
  });

  toolCalls.push(toolCall);

  if (!toolResult.success) {
    const error =
      toolResult.errors[0] ??
      createExecutionError("execution_tool_failed", `Tool "${tool.name}" failed.`);

    trace.push(
      createTrace(ExecutionEventType.ToolFailed, {
        stepId: input.step.id,
        input: toolInput,
        output: toolResult.output,
        error,
        metadata: {
          executionId: input.executionId,
          taskId: input.task.id,
          planId: input.plan.id,
          toolId: tool.id,
          toolName: tool.name,
          durationMs: toolResult.durationMs,
        },
      })
    );
    trace.push(
      createTrace(ExecutionEventType.StepFailed, {
        stepId: input.step.id,
        error,
        metadata: {
          executionId: input.executionId,
          taskId: input.task.id,
          planId: input.plan.id,
        },
      })
    );
    errors.push(error);

    return {
      step: failStep(input.step, error, toolResult.output, toolCall),
      trace,
      toolCalls,
      errors,
    };
  }

  trace.push(
    createTrace(ExecutionEventType.ToolCompleted, {
      stepId: input.step.id,
      input: toolInput,
      output: toolResult.output,
      metadata: {
        executionId: input.executionId,
        taskId: input.task.id,
        planId: input.plan.id,
        toolId: tool.id,
        toolName: tool.name,
        durationMs: toolResult.durationMs,
      },
    })
  );

  const completedStep: PlanStep = {
    ...input.step,
    status: PlanStepStatus.Completed,
    output: toolResult.output,
    metadata: {
      ...input.step.metadata,
      resolvedToolId: tool.id,
      resolvedToolName: tool.name,
      toolCallId,
      toolDurationMs: toolResult.durationMs,
    },
  };

  trace.push(
    createTrace(ExecutionEventType.StepCompleted, {
      stepId: completedStep.id,
      input: completedStep.input ?? completedStep.description,
      output: completedStep.output,
      metadata: {
        executionId: input.executionId,
        taskId: input.task.id,
        planId: input.plan.id,
        order: completedStep.order,
        toolId: tool.id,
        toolName: tool.name,
      },
    })
  );

  return {
    step: completedStep,
    trace,
    toolCalls,
    errors,
  };
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

async function executeTool(
  tool: RegisteredTool,
  input: Record<string, unknown>,
  context: ExecutionContext
): Promise<ToolExecutionResult> {
  try {
    return await tool.execute(input, context);
  } catch (error) {
    return {
      success: false,
      durationMs: 0,
      errors: [normalizeError(error)],
    };
  }
}

function createToolInput(input: StepExecutionInput, tool: RegisteredTool): Record<string, unknown> {
  const stepInput =
    input.step.input && typeof input.step.input === "object" && !Array.isArray(input.step.input)
      ? (input.step.input as Record<string, unknown>)
      : {};

  return {
    taskId: input.task.id,
    taskInput: input.task.input,
    planId: input.plan.id,
    stepId: input.step.id,
    stepType: input.step.type,
    stepDescription: input.step.description,
    stepInput: input.step.input,
    requiredCapability: getRequiredCapability(input.step),
    toolId: tool.id,
    toolName: tool.name,
    agentId: input.agent.id,
    ...stepInput,
  };
}

function createToolCall(input: {
  id: string;
  tool: RegisteredTool;
  step: PlanStep;
  input: unknown;
  result: ToolExecutionResult;
  startedAt: Date;
  completedAt: Date;
}): ToolCallRecord {
  return {
    id: input.id,
    toolId: input.tool.id,
    toolName: input.tool.name,
    stepId: input.step.id,
    input: input.input,
    output: input.result.output,
    success: input.result.success,
    error: input.result.errors[0],
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    durationMs: input.result.durationMs,
    metadata: {
      capability: input.tool.capability,
      outputSummary: summarizeOutput(input.result.output),
    },
  };
}

function createAnswer(steps: PlanStep[]): string {
  return steps
    .map((step) => `${step.order}. ${summarizeOutput(step.output ?? step.error?.message)}`)
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
    toolCalls: input.toolCalls,
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
      localOnly: true,
      handledAt: new Date(),
    },
  };
}

function createFailedToolTrace(input: StepExecutionInput, error: AgentOSError): ExecutionTrace {
  return createTrace(ExecutionEventType.ToolFailed, {
    stepId: input.step.id,
    error,
    metadata: {
      executionId: input.executionId,
      taskId: input.task.id,
      planId: input.plan.id,
    },
  });
}

function createFailedStepTrace(input: StepExecutionInput, error: AgentOSError): ExecutionTrace {
  return createTrace(ExecutionEventType.StepFailed, {
    stepId: input.step.id,
    error,
    metadata: {
      executionId: input.executionId,
      taskId: input.task.id,
      planId: input.plan.id,
    },
  });
}

function failStep(
  step: PlanStep,
  error: AgentOSError,
  output?: unknown,
  toolCall?: ToolCallRecord
): PlanStep {
  return {
    ...step,
    status: PlanStepStatus.Failed,
    output,
    error,
    metadata: {
      ...step.metadata,
      toolCallId: toolCall?.id,
      failedByTool: Boolean(toolCall),
    },
  };
}

function getRequiredCapability(step: PlanStep): string | undefined {
  const capability = step.metadata?.requiredCapability;

  return typeof capability === "string" ? capability : undefined;
}

function summarizeOutput(output: unknown): string {
  if (typeof output === "string") {
    return output;
  }

  if (output === undefined) {
    return "No output.";
  }

  if (output && typeof output === "object") {
    const values = Object.values(output);
    const firstText = values.find((value): value is string => typeof value === "string");

    if (firstText) {
      return firstText;
    }
  }

  try {
    return JSON.stringify(output);
  } catch {
    return String(output);
  }
}

function normalizeError(error: unknown): AgentOSError {
  if (error && typeof error === "object" && "message" in error) {
    return {
      code: "execution_tool_failed",
      message: String(error.message),
      details: error,
      recoverable: true,
    };
  }

  return createExecutionError("execution_tool_failed", "Unknown tool execution failure.", error);
}

function createExecutionError(code: string, message: string, details?: unknown): AgentOSError {
  return {
    code,
    message,
    details,
    recoverable: true,
  };
}
