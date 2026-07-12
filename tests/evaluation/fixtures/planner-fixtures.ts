import { ModelProviderCapability, PlanStepType, type AgentCapability } from "@agentosdev/sdk";

export interface PlannerEvaluationFixture {
  id: string;
  task: string;
  agentCapabilities: AgentCapability[];
  providerCapabilities: string[];
  providerResponse: unknown;
  repairResponse?: unknown;
  maxSteps?: number;
  expected: {
    providerCapabilityPath: "standard" | "structured-output";
    validationPassed: boolean;
    fallbackUsed: boolean;
    repairAttempted: boolean;
    stepCountRange: [number, number];
    requiredCapability?: string;
  };
}

export const plannerEvaluationFixtures: PlannerEvaluationFixture[] = [
  {
    id: "research-structured-plan",
    task: "Analyze this grant opportunity and produce a short research plan.",
    agentCapabilities: [{ name: "research" }, { name: "analytics" }, { name: "communication" }],
    providerCapabilities: [
      ModelProviderCapability.TextGeneration,
      ModelProviderCapability.Reasoning,
      ModelProviderCapability.StructuredOutput,
    ],
    providerResponse: {
      steps: [
        {
          description: "Gather relevant grant information",
          type: "research",
          requiredCapability: "research",
        },
        {
          description: "Analyze eligibility and fit",
          type: "transform",
          requiredCapability: "analytics",
        },
        {
          description: "Produce a short research plan",
          type: "respond",
          requiredCapability: "communication",
        },
      ],
    },
    expected: {
      providerCapabilityPath: "structured-output",
      validationPassed: true,
      fallbackUsed: false,
      repairAttempted: false,
      stepCountRange: [3, 3],
      requiredCapability: "research",
    },
  },
  {
    id: "messaging-standard-plan",
    task: "Prepare a community update and message it to members.",
    agentCapabilities: [{ name: "messaging" }, { name: "communication" }],
    providerCapabilities: [ModelProviderCapability.TextGeneration],
    providerResponse: {
      steps: [
        {
          description: "Prepare message content",
          type: "reason",
          requiredCapability: "messaging",
        },
        {
          description: "Draft the final member update",
          type: "respond",
          requiredCapability: "communication",
        },
      ],
    },
    expected: {
      providerCapabilityPath: "standard",
      validationPassed: true,
      fallbackUsed: false,
      repairAttempted: false,
      stepCountRange: [2, 2],
      requiredCapability: "messaging",
    },
  },
  {
    id: "filesystem-task",
    task: "Read README.md and write a short SUMMARY.md.",
    agentCapabilities: [{ name: "storage" }, { name: "search" }, { name: "communication" }],
    providerCapabilities: [
      ModelProviderCapability.TextGeneration,
      ModelProviderCapability.StructuredOutput,
    ],
    providerResponse: {
      steps: [
        {
          description: "Read the source document",
          type: "tool",
          requiredCapability: "storage",
          requiredTool: "filesystem-read-file",
          input: {
            path: "README.md",
          },
        },
        {
          description: "Write the summary document",
          type: "tool",
          requiredCapability: "storage",
          requiredTool: "filesystem-write-file",
          input: {
            path: "SUMMARY.md",
          },
        },
      ],
    },
    expected: {
      providerCapabilityPath: "structured-output",
      validationPassed: true,
      fallbackUsed: false,
      repairAttempted: false,
      stepCountRange: [2, 2],
      requiredCapability: "storage",
    },
  },
  {
    id: "multi-step-plan",
    task: "Research a partner, summarize risks, draft an outreach message, and define next steps.",
    agentCapabilities: [{ name: "research" }, { name: "analytics" }, { name: "messaging" }],
    providerCapabilities: [
      ModelProviderCapability.TextGeneration,
      ModelProviderCapability.Reasoning,
      ModelProviderCapability.StructuredOutput,
    ],
    providerResponse: {
      steps: [
        { description: "Research the partner", type: "research", requiredCapability: "research" },
        { description: "Summarize risks", type: "transform", requiredCapability: "analytics" },
        { description: "Draft outreach message", type: "respond", requiredCapability: "messaging" },
        { description: "Define next steps", type: "respond", requiredCapability: "communication" },
      ],
    },
    expected: {
      providerCapabilityPath: "structured-output",
      validationPassed: true,
      fallbackUsed: false,
      repairAttempted: false,
      stepCountRange: [4, 4],
      requiredCapability: "research",
    },
  },
  {
    id: "repairable-plan",
    task: "Create a concise research plan.",
    agentCapabilities: [{ name: "research" }],
    providerCapabilities: [
      ModelProviderCapability.TextGeneration,
      ModelProviderCapability.StructuredOutput,
    ],
    providerResponse: "not-json",
    repairResponse: {
      steps: [
        {
          description: "Create the repaired research plan",
          type: PlanStepType.Reason,
          requiredCapability: "research",
        },
      ],
    },
    expected: {
      providerCapabilityPath: "structured-output",
      validationPassed: true,
      fallbackUsed: false,
      repairAttempted: true,
      stepCountRange: [1, 1],
      requiredCapability: "research",
    },
  },
  {
    id: "invalid-plan-fallback",
    task: "Summarize the project status.",
    agentCapabilities: [{ name: "research" }, { name: "communication" }],
    providerCapabilities: [ModelProviderCapability.TextGeneration],
    providerResponse: {
      steps: [],
    },
    expected: {
      providerCapabilityPath: "standard",
      validationPassed: true,
      fallbackUsed: true,
      repairAttempted: true,
      stepCountRange: [3, 3],
    },
  },
  {
    id: "malicious-plan-rejected",
    task: "Summarize safely.",
    agentCapabilities: [{ name: "research" }],
    providerCapabilities: [
      ModelProviderCapability.TextGeneration,
      ModelProviderCapability.StructuredOutput,
    ],
    providerResponse: {
      steps: [
        {
          id: "provider-controlled-step",
          description: "Attempt to control privileged fields",
          type: "reason",
          requiredCapability: "research",
        },
      ],
    },
    expected: {
      providerCapabilityPath: "structured-output",
      validationPassed: true,
      fallbackUsed: true,
      repairAttempted: true,
      stepCountRange: [3, 3],
    },
  },
  {
    id: "excessive-step-plan-fallback",
    task: "Analyze many project details.",
    agentCapabilities: [{ name: "research" }, { name: "analytics" }],
    providerCapabilities: [ModelProviderCapability.TextGeneration],
    maxSteps: 3,
    providerResponse: {
      steps: Array.from({ length: 5 }, (_, index) => ({
        description: `Generated step ${index + 1}`,
        type: "reason",
        requiredCapability: "research",
      })),
    },
    expected: {
      providerCapabilityPath: "standard",
      validationPassed: true,
      fallbackUsed: true,
      repairAttempted: true,
      stepCountRange: [3, 3],
    },
  },
];
