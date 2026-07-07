import {
  MemoryScope,
  MemoryType,
  ToolPermissionLevel,
  type Agent,
  type ExecutionContext,
  type Plan,
  type Result,
  type Task,
} from "@agentos/types";
import { createTask } from "./index";
import { createAgentOSRegistryBootstrapExample } from "./agentos-registry";
import { RuleBasedPlanner } from "./rule-based-planner";
import { SimpleExecutionEngine } from "./simple-execution-engine";
import { ToolResolver } from "./tool-resolver";

const exampleAgent: Agent = {
  id: "agent-execution-example",
  name: "Execution Example Agent",
  description: "Demonstrates simulated execution without real tools.",
  version: "0.1.0",
  capabilities: [{ name: "planning" }, { name: "execution" }],
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

export interface SimpleExecutionEngineExampleResult {
  task: Task;
  plan: Plan;
  result: Result;
  failedValidationResult: Result;
}

export async function createSimpleExecutionEngineExample(): Promise<SimpleExecutionEngineExampleResult> {
  const planner = new RuleBasedPlanner();
  const registry = createAgentOSRegistryBootstrapExample();
  const engine = new SimpleExecutionEngine();
  const toolResolver = new ToolResolver({ registry });
  const task = createTask({
    id: "execution-example-task",
    input: "Summarize the top complaints in our Discord community this week",
    source: {
      type: "example",
      name: "simple-execution-engine.examples",
    },
  });
  const context = createExampleContext(task);
  const plan = planner.plan(exampleAgent, task, context);
  const result = await engine.executePlan(exampleAgent, task, plan, context, {
    toolResolver,
  });
  const invalidPlan: Plan = {
    ...plan,
    taskId: "different-task-id",
  };
  const failedValidationResult = await engine.executePlan(
    exampleAgent,
    task,
    invalidPlan,
    context,
    {
      toolResolver,
    }
  );

  return {
    task,
    plan,
    result,
    failedValidationResult,
  };
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
