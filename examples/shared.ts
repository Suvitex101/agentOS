import {
  AgentOSRegistry,
  InMemoryMemoryStore,
  RuleBasedPlanner,
  SimpleExecutionEngine,
  defineAgent,
  type AgentDefinition,
  type AgentOSMetadata,
  type Result,
} from "@agentos/sdk";

interface ExampleAgentInput {
  id: string;
  name: string;
  description: string;
  metadata?: AgentOSMetadata;
  registry?: AgentOSRegistry;
  memoryStore?: InMemoryMemoryStore;
}

interface PrintRunInput {
  title: string;
  agent: AgentDefinition;
  task: string;
  result: Result;
}

export function createExampleAgent(input: ExampleAgentInput): AgentDefinition {
  return defineAgent({
    id: input.id,
    name: input.name,
    description: input.description,
    metadata: input.metadata,
    planner: new RuleBasedPlanner(),
    executionEngine: new SimpleExecutionEngine(),
    registry: input.registry ?? new AgentOSRegistry(),
    memoryStore: input.memoryStore ?? new InMemoryMemoryStore(),
  });
}

export function printRun(input: PrintRunInput): void {
  const memoryReadCount = readNumber(input.result.metadata?.memoryReadCount);
  const steps = input.result.plan?.steps ?? [];

  console.log(`\n=== ${input.title} ===`);
  console.log(`Agent: ${input.agent.name}`);
  console.log(`Task: ${input.task}`);
  console.log(`Status: ${input.result.status}`);
  console.log(`Answer: ${formatValue(input.result.answer)}`);
  console.log(`Trace count: ${input.result.trace.length}`);
  console.log(`Memory read count: ${memoryReadCount}`);

  if (steps.length > 0) {
    console.log("Steps:");

    for (const step of steps) {
      console.log(`  ${step.order}. ${step.description} -> ${formatValue(step.output)}`);
    }
  }
}

function readNumber(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value === undefined) {
    return "None";
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
