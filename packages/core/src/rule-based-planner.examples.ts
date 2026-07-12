import {
  MemoryScope,
  MemoryType,
  ToolPermissionLevel,
  type Agent,
  type ExecutionContext,
  type Plan,
  type Task,
} from "@agentosdev/types";
import { createTask } from "./index";
import { RuleBasedPlanner } from "./rule-based-planner";

const exampleAgent: Agent = {
  id: "agent-example",
  name: "Example Agent",
  description: "Demonstrates rule-based planning without executing tools.",
  version: "0.1.0",
  capabilities: [{ name: "planning" }],
  tools: [],
  memoryPolicy: {
    enabled: false,
    scopes: [MemoryScope.Task],
    readableTypes: [MemoryType.Summary],
    writableTypes: [MemoryType.Summary],
  },
  permissions: [
    {
      resource: "plans",
      level: ToolPermissionLevel.Read,
    },
  ],
};

const exampleInputs = [
  "Summarize the top complaints in our Discord community this week",
  "Send an email update to the partner program members",
  "Create a payment invoice with Paystack",
  "Help me prepare for tomorrow's community call",
];

export function createRuleBasedPlannerExamples(): Plan[] {
  const planner = new RuleBasedPlanner();

  return exampleInputs.map((input, index) => {
    const task = createTask({
      id: `example-task-${index + 1}`,
      input,
      source: {
        type: "example",
        name: "rule-based-planner.examples",
      },
    });

    return planner.plan(exampleAgent, task, createExampleContext(task));
  });
}

function createExampleContext(task: Task): ExecutionContext {
  return {
    agent: exampleAgent,
    task,
    memory: [],
    resources: [],
    variables: {},
    environment: {},
  };
}
