import { MemoryScope, MemoryType, ToolPermissionLevel } from "@agentos/types";
import { InMemoryMemoryStore } from "@agentos/memory";
import { AgentOSRegistry, createAgentOSRegistryBootstrapExample } from "./agentos-registry";
import { defineAgent } from "./agent-definition";
import { RuleBasedPlanner } from "./rule-based-planner";
import { SimpleExecutionEngine } from "./simple-execution-engine";

export function createAgentDefinitionExamples() {
  const communityRegistry = createAgentOSRegistryBootstrapExample();
  const researchRegistry = new AgentOSRegistry();
  const businessRegistry = new AgentOSRegistry();

  const communityManager = defineAgent({
    id: "community-manager",
    name: "Community Manager",
    description: "Manages online communities.",
    planner: new RuleBasedPlanner(),
    executionEngine: new SimpleExecutionEngine(),
    registry: communityRegistry,
    memoryStore: new InMemoryMemoryStore(),
    capabilities: [{ name: "community-management" }],
    permissions: [
      {
        resource: "messages",
        level: ToolPermissionLevel.Read,
      },
    ],
    metadata: {
      example: true,
    },
  });

  const researchAgent = defineAgent({
    id: "research-agent",
    name: "Research Agent",
    description: "Composes research-focused AgentOS dependencies.",
    planner: new RuleBasedPlanner({ id: "research-rule-planner", name: "Research Rule Planner" }),
    executionEngine: new SimpleExecutionEngine({
      id: "research-simple-execution",
      name: "Research Simple Execution",
    }),
    registry: researchRegistry,
    memoryStore: new InMemoryMemoryStore({
      policy: {
        enabled: true,
        scopes: [MemoryScope.Project, MemoryScope.Task, MemoryScope.Global],
        readableTypes: [MemoryType.Fact, MemoryType.Summary, MemoryType.Document],
        writableTypes: [MemoryType.Fact, MemoryType.Summary, MemoryType.Document],
      },
    }),
    capabilities: [{ name: "research" }],
  });

  const businessAssistant = defineAgent({
    id: "business-assistant",
    name: "Business Assistant",
    description: "Composes business operations dependencies.",
    planner: new RuleBasedPlanner({
      id: "business-rule-planner",
      name: "Business Rule Planner",
    }),
    executionEngine: new SimpleExecutionEngine({
      id: "business-simple-execution",
      name: "Business Simple Execution",
    }),
    registry: businessRegistry,
    memoryStore: new InMemoryMemoryStore(),
    capabilities: [{ name: "business-operations" }],
    permissions: [
      {
        resource: "business-records",
        level: ToolPermissionLevel.Read,
      },
    ],
  });

  return {
    communityManager,
    researchAgent,
    businessAssistant,
    summaries: [communityManager.summary(), researchAgent.summary(), businessAssistant.summary()],
    inspections: [communityManager.inspect(), researchAgent.inspect(), businessAssistant.inspect()],
  };
}
