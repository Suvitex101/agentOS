import {
  ToolCategory,
  ToolPermissionLevel,
  type AgentOSError,
  type ExecutionContext,
  type RegisteredTool,
  type ToolExecutionResult,
} from "@agentos/types";

type MockToolInput = Record<string, unknown>;

export function createMockTools(): RegisteredTool<unknown, MockToolInput>[] {
  return [
    createMockTool({
      id: "tool-prepare-message",
      name: "PrepareMessageTool",
      description: "Prepares mocked message content for a target channel or recipient.",
      capability: "messaging",
      capabilityIds: ["messaging", "communication"],
      category: ToolCategory.Communication,
      permissionLevel: ToolPermissionLevel.Write,
      output: (input) => ({
        message: `Prepared message for: ${stringifyInput(input.taskInput)}`,
        status: "draft_ready",
      }),
    }),
    createMockTool({
      id: "tool-summarize-messages",
      name: "SummarizeMessagesTool",
      description: "Summarizes mocked message or community content.",
      capability: "communication",
      capabilityIds: ["communication", "messaging", "research"],
      category: ToolCategory.Community,
      permissionLevel: ToolPermissionLevel.Read,
      output: (input) => ({
        summary: `Mock summary created for: ${stringifyInput(input.taskInput)}`,
        findings: ["Top themes identified", "Suggested next action drafted"],
      }),
    }),
    createMockTool({
      id: "tool-analyze-text",
      name: "AnalyzeTextTool",
      description: "Analyzes mocked text and returns simple findings.",
      capability: "analytics",
      capabilityIds: ["analytics", "research"],
      category: ToolCategory.Research,
      permissionLevel: ToolPermissionLevel.Read,
      output: (input) => ({
        analysis: `Mock analysis completed for: ${stringifyInput(input.taskInput)}`,
        signals: ["intent", "priority", "next_steps"],
      }),
    }),
    createMockTool({
      id: "tool-create-invoice",
      name: "CreateInvoiceTool",
      description: "Creates a mocked invoice or payment workflow.",
      capability: "payments",
      capabilityIds: ["payments", "business"],
      category: ToolCategory.Payments,
      permissionLevel: ToolPermissionLevel.Write,
      output: (input) => ({
        invoiceId: "mock-invoice-001",
        paymentStatus: "prepared",
        note: `Mock payment workflow prepared for: ${stringifyInput(input.taskInput)}`,
      }),
    }),
    createMockTool({
      id: "tool-echo",
      name: "EchoTool",
      description: "Echoes the step input for general mocked execution.",
      capability: "general",
      capabilityIds: ["general"],
      category: ToolCategory.System,
      permissionLevel: ToolPermissionLevel.Read,
      output: (input) => ({
        echo: stringifyInput(input.stepDescription ?? input.taskInput),
      }),
    }),
  ];
}

interface MockToolDefinition {
  id: string;
  name: string;
  description: string;
  capability: string;
  capabilityIds: string[];
  category: ToolCategory;
  permissionLevel: ToolPermissionLevel;
  output: (input: MockToolInput, context: ExecutionContext) => MockToolInput;
}

function createMockTool(definition: MockToolDefinition): RegisteredTool<unknown, MockToolInput> {
  return {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    capability: definition.capability,
    category: definition.category,
    inputSchema: {
      type: "object",
    },
    outputSchema: {
      type: "object",
    },
    permissionLevel: definition.permissionLevel,
    capabilityIds: definition.capabilityIds,
    execute: (input, context) => {
      const startedAt = Date.now();
      const normalizedInput = normalizeToolInput(input);

      try {
        return createToolResult({
          success: true,
          output: definition.output(normalizedInput, context),
          durationMs: Date.now() - startedAt,
          metadata: {
            mocked: true,
            toolId: definition.id,
          },
        });
      } catch (error) {
        return createToolResult({
          success: false,
          durationMs: Date.now() - startedAt,
          errors: [normalizeToolError(error)],
          metadata: {
            mocked: true,
            toolId: definition.id,
          },
        });
      }
    },
  };
}

function normalizeToolInput(input: unknown): MockToolInput {
  return input && typeof input === "object" ? { ...input } : { value: input };
}

function createToolResult<Output>(input: {
  success: boolean;
  output?: Output;
  durationMs: number;
  errors?: AgentOSError[];
  metadata?: Record<string, unknown>;
}): ToolExecutionResult<Output> {
  return {
    success: input.success,
    output: input.output,
    durationMs: input.durationMs,
    errors: input.errors ?? [],
    metadata: input.metadata,
  };
}

function normalizeToolError(error: unknown): AgentOSError {
  if (error && typeof error === "object" && "message" in error) {
    return {
      code: "mock_tool_failed",
      message: String(error.message),
      details: error,
      recoverable: true,
    };
  }

  return {
    code: "mock_tool_failed",
    message: "Mock tool failed.",
    details: error,
    recoverable: true,
  };
}

function stringifyInput(input: unknown): string {
  if (typeof input === "string") {
    return input;
  }

  if (input === undefined) {
    return "unspecified input";
  }

  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
}
