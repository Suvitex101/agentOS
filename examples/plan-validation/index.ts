import {
  AgentOSRegistry,
  ModelAssistedPlanner,
  ModelProviderCapability,
  ModelProviderResolver,
  PlanSchemaVersion,
  PlanStatus,
  PlanStepStatus,
  PlanStepType,
  PlanValidator,
  RuleBasedPlanner,
  createTask,
  defineModelProvider,
  type Agent,
  type ExecutionContext,
} from "@agentosdev/sdk";

const agent: Agent = {
  id: "plan-validation-agent",
  name: "Plan Validation Agent",
  description: "Demonstrates model-generated plan validation and repair.",
  version: "0.1.0",
  capabilities: [{ name: "research" }, { name: "storage" }],
  tools: [],
  memoryPolicy: {
    enabled: false,
    scopes: [],
    readableTypes: [],
    writableTypes: [],
  },
  permissions: [],
};
const task = createTask({
  id: "plan-validation-task",
  input: "Summarize README.md into SUMMARY.md",
});
const context: ExecutionContext = {
  agent,
  task,
  memory: [],
  resources: [],
  variables: {},
  environment: {},
};
let providerCounter = 0;

async function main() {
  const validator = new PlanValidator();
  const valid = validator.validate({
    id: "plan-demo",
    taskId: task.id,
    status: PlanStatus.Ready,
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {
      schemaVersion: PlanSchemaVersion.V1,
    },
    steps: [
      {
        id: "plan-demo-step-1",
        order: 1,
        type: PlanStepType.UseTool,
        description: "Read README.md",
        requiredTool: "tool-filesystem-read-file",
        status: PlanStepStatus.Pending,
        input: {
          path: "README.md",
        },
        metadata: {
          requiredCapability: "storage",
        },
      },
    ],
  });
  const oversized = new PlanValidator({ maxPlanBytes: 200 }).validate({
    id: "plan-large",
    taskId: task.id,
    status: PlanStatus.Ready,
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {
      schemaVersion: PlanSchemaVersion.V1,
    },
    steps: [
      {
        id: "plan-large-step-1",
        order: 1,
        type: PlanStepType.Reason,
        description: "x".repeat(400),
        status: PlanStepStatus.Pending,
      },
    ],
  });
  const malicious = validator.validate({
    id: "plan-malicious",
    taskId: task.id,
    status: PlanStatus.Ready,
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {
      schemaVersion: PlanSchemaVersion.V1,
      executionId: "provider-controlled",
    },
    steps: [
      {
        id: "plan-malicious-step-1",
        order: 1,
        type: PlanStepType.UseTool,
        description: "Mutate registry",
        status: PlanStepStatus.Pending,
        input: {
          constructor: {
            prototype: {
              polluted: true,
            },
          },
          registryMutation: true,
        },
      },
    ],
  });
  const repairedPlan = await createPlanner({
    text: "not-json",
    repairText: JSON.stringify({
      steps: [
        {
          description: "Read README.md",
          type: "tool",
          requiredTool: "tool-filesystem-read-file",
          requiredCapability: "storage",
          input: {
            path: "README.md",
          },
        },
      ],
    }),
    fallback: "fail",
  }).plan(agent, task, context);
  const fallbackPlan = await createPlanner({
    text: "not-json",
    fallback: "rule-based",
  }).plan(agent, task, context);
  let failedValidation = "none";

  try {
    await createPlanner({
      text: JSON.stringify({
        steps: [
          {
            description: "Bad step",
            type: "tool",
            input: "README.md",
          },
        ],
      }),
      repairText: "still-not-json",
      fallback: "fail",
    }).plan(agent, task, context);
  } catch (error) {
    failedValidation =
      error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
  }

  console.log("\n=== Plan Validation ===");
  console.log(`Valid plan: ${valid.valid}`);
  console.log(`Repaired plan: ${String(repairedPlan.metadata?.repairSucceeded)}`);
  console.log(`Fallback used: ${String(fallbackPlan.metadata?.fallbackUsed)}`);
  console.log(`Failed validation code: ${failedValidation}`);
  console.log(`Oversized issues: ${oversized.issues?.map((issue) => issue.code).join(", ")}`);
  console.log(`Malicious issues: ${malicious.issues?.map((issue) => issue.code).join(", ")}`);
}

function createPlanner(input: {
  text: string;
  repairText?: string;
  fallback: "rule-based" | "fail";
}) {
  let calls = 0;
  providerCounter += 1;

  const provider = defineModelProvider({
    id: `plan-validation-provider-${providerCounter}`,
    name: "Plan Validation Provider",
    version: "1.0.0",
    capabilities: [
      ModelProviderCapability.TextGeneration,
      ModelProviderCapability.Reasoning,
      ModelProviderCapability.StructuredOutput,
    ],
    generate() {
      calls += 1;

      return {
        text: calls > 1 && input.repairText !== undefined ? input.repairText : input.text,
      };
    },
  });
  const registry = new AgentOSRegistry();

  registry.registerModelProvider(provider);

  return new ModelAssistedPlanner({
    providerResolver: new ModelProviderResolver({ registry }),
    fallbackPlanner: new RuleBasedPlanner(),
    options: {
      fallback: input.fallback,
    },
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
