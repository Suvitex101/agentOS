import { InMemoryMemoryStore } from "@agentosdev/memory";
import { createAgentOSRegistryBootstrapExample } from "./agentos-registry";
import { defineAgent } from "./agent-definition";
import { RuleBasedPlanner } from "./rule-based-planner";
import { SimpleExecutionEngine } from "./simple-execution-engine";

export async function createAgentRuntimeExamples() {
  const communityManager = defineAgent({
    id: "community-manager",
    name: "Community Manager",
    description: "Manages online communities.",
    planner: new RuleBasedPlanner(),
    executionEngine: new SimpleExecutionEngine(),
    registry: createAgentOSRegistryBootstrapExample(),
    memoryStore: new InMemoryMemoryStore(),
  });

  const businessAssistant = defineAgent({
    id: "business-assistant",
    name: "Business Assistant",
    description: "Supports business operations.",
    planner: new RuleBasedPlanner(),
    executionEngine: new SimpleExecutionEngine(),
    registry: createAgentOSRegistryBootstrapExample(),
    memoryStore: new InMemoryMemoryStore(),
  });

  const researchAssistant = defineAgent({
    id: "research-assistant",
    name: "Research Assistant",
    description: "Helps with lightweight research tasks.",
    planner: new RuleBasedPlanner(),
    executionEngine: new SimpleExecutionEngine(),
    registry: createAgentOSRegistryBootstrapExample(),
    memoryStore: new InMemoryMemoryStore(),
  });

  const memoryEnabled = await communityManager.run(
    "Summarize the top complaints in our Discord community this week"
  );
  const memoryDisabled = await communityManager.run("Send a community update email", {
    memory: false,
  });

  return {
    communityManager: await communityManager.run(
      "Summarize the top complaints in our Discord community this week"
    ),
    businessAssistant: await businessAssistant.run("Create a payment invoice for a customer"),
    researchAssistant: await researchAssistant.run("Analyze recent notes about AgentOS"),
    memoryEnabled,
    memoryDisabled,
  };
}
