import {
  ToolCategory,
  ToolPermissionLevel,
  type AgentOSError,
  type ToolExecutionResult,
} from "@agentosdev/types";
import { defineBusinessTool, defineMessagingTool, defineResearchTool } from "./tool-definition";

type MockToolInput = Record<string, unknown>;

export function createMockTools() {
  return [
    defineMessagingTool<unknown, MockToolInput>({
      id: "tool-prepare-message",
      name: "PrepareMessageTool",
      description: "Prepares mocked message content for a target channel or recipient.",
      version: "1.0.0",
      capabilityIds: ["messaging", "communication"],
      tags: ["messaging", "mock"],
      permissionLevel: ToolPermissionLevel.Write,
      execute: ({ input }) => {
        const startedAt = Date.now();
        const normalizedInput = normalizeToolInput(input);

        return createToolResult({
          success: true,
          output: {
            message: `Prepared message for: ${stringifyInput(normalizedInput.taskInput)}`,
            status: "draft_ready",
          },
          durationMs: Date.now() - startedAt,
          metadata: {
            mocked: true,
            toolId: "tool-prepare-message",
          },
        });
      },
    }),
    defineMessagingTool<unknown, MockToolInput>({
      id: "tool-summarize-messages",
      name: "SummarizeMessagesTool",
      description: "Summarizes mocked message or community content.",
      version: "1.0.0",
      capability: "communication",
      category: ToolCategory.Community,
      capabilityIds: ["communication", "messaging", "research"],
      tags: ["community", "summary", "mock"],
      permissionLevel: ToolPermissionLevel.Read,
      execute: ({ input }) => {
        const startedAt = Date.now();
        const normalizedInput = normalizeToolInput(input);

        return createToolResult({
          success: true,
          output: {
            summary: `Mock summary created for: ${stringifyInput(normalizedInput.taskInput)}`,
            findings: ["Top themes identified", "Suggested next action drafted"],
          },
          durationMs: Date.now() - startedAt,
          metadata: {
            mocked: true,
            toolId: "tool-summarize-messages",
          },
        });
      },
    }),
    defineResearchTool<unknown, MockToolInput>({
      id: "tool-analyze-text",
      name: "AnalyzeTextTool",
      description: "Analyzes mocked text and returns simple findings.",
      version: "1.0.0",
      capability: "analytics",
      category: ToolCategory.Research,
      capabilityIds: ["analytics", "research"],
      tags: ["analysis", "research", "mock"],
      permissionLevel: ToolPermissionLevel.Read,
      execute: ({ input }) => {
        const startedAt = Date.now();
        const normalizedInput = normalizeToolInput(input);

        return createToolResult({
          success: true,
          output: {
            analysis: `Mock analysis completed for: ${stringifyInput(normalizedInput.taskInput)}`,
            signals: ["intent", "priority", "next_steps"],
          },
          durationMs: Date.now() - startedAt,
          metadata: {
            mocked: true,
            toolId: "tool-analyze-text",
          },
        });
      },
    }),
    defineBusinessTool<unknown, MockToolInput>({
      id: "tool-create-invoice",
      name: "CreateInvoiceTool",
      description: "Creates a mocked invoice or payment workflow.",
      version: "1.0.0",
      capability: "payments",
      category: ToolCategory.Payments,
      capabilityIds: ["payments", "business"],
      tags: ["payments", "invoice", "mock"],
      permissionLevel: ToolPermissionLevel.Write,
      execute: ({ input }) => {
        const startedAt = Date.now();
        const normalizedInput = normalizeToolInput(input);

        return createToolResult({
          success: true,
          output: {
            invoiceId: "mock-invoice-001",
            paymentStatus: "prepared",
            note: `Mock payment workflow prepared for: ${stringifyInput(normalizedInput.taskInput)}`,
          },
          durationMs: Date.now() - startedAt,
          metadata: {
            mocked: true,
            toolId: "tool-create-invoice",
          },
        });
      },
    }),
    defineResearchTool<unknown, MockToolInput>({
      id: "tool-echo",
      name: "EchoTool",
      description: "Echoes the step input for general mocked execution.",
      version: "1.0.0",
      capability: "general",
      category: ToolCategory.System,
      capabilityIds: ["general"],
      tags: ["general", "mock"],
      permissionLevel: ToolPermissionLevel.Read,
      execute: ({ input }) => {
        const startedAt = Date.now();
        const normalizedInput = normalizeToolInput(input);

        return createToolResult({
          success: true,
          output: {
            echo: stringifyInput(normalizedInput.stepDescription ?? normalizedInput.taskInput),
          },
          durationMs: Date.now() - startedAt,
          metadata: {
            mocked: true,
            toolId: "tool-echo",
          },
        });
      },
    }),
  ];
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
