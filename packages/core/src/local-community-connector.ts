import {
  CapabilityCategory,
  ResourceType,
  type Capability,
  type RegisteredTool,
} from "@agentosdev/types";
import { defineConnector } from "./connector-definition";
import { createMockTools } from "./mock-tools";

const CONNECTOR_ID = "local-community";

const capabilities: Capability[] = [
  {
    id: "messaging",
    name: "Messaging",
    description: "Prepare and summarize local community messages.",
    category: CapabilityCategory.Messaging,
    supportedConnectors: [CONNECTOR_ID],
  },
  {
    id: "community",
    name: "Community",
    description: "Work with local community channels, members, messages, and threads.",
    category: CapabilityCategory.Community,
    supportedConnectors: [CONNECTOR_ID],
  },
  {
    id: "search",
    name: "Search",
    description: "Search and analyze local mocked community content.",
    category: CapabilityCategory.Search,
    supportedConnectors: [CONNECTOR_ID],
  },
];

const mockTools = createMockTools();
const prepareMessageTool = requireTool(mockTools, "tool-prepare-message");
const summarizeMessagesTool = requireTool(mockTools, "tool-summarize-messages");
const analyzeTextTool = requireTool(mockTools, "tool-analyze-text");

export const LocalCommunityConnector = defineConnector({
  id: CONNECTOR_ID,
  name: "Local Community Connector",
  description: "Local mocked community connector for validating AgentOS connector bundles.",
  version: "1.0.0",
  capabilities,
  tools: [
    withCapabilityIds(prepareMessageTool, ["messaging", "community"]),
    withCapabilityIds(summarizeMessagesTool, ["messaging", "community", "search"]),
    withCapabilityIds(analyzeTextTool, ["community", "search"]),
  ],
  resources: [
    {
      id: "local-community-main",
      type: ResourceType.Community,
      source: CONNECTOR_ID,
      uri: "local://community/main",
      metadata: {
        name: "Main Local Community",
      },
    },
    {
      id: "local-community-general-channel",
      type: ResourceType.Channel,
      source: CONNECTOR_ID,
      uri: "local://community/main/channels/general",
      metadata: {
        name: "general",
      },
    },
    {
      id: "local-community-member-demo",
      type: ResourceType.Member,
      source: CONNECTOR_ID,
      uri: "local://community/main/members/demo",
      metadata: {
        role: "member",
      },
    },
    {
      id: "local-community-message-demo",
      type: ResourceType.Message,
      source: CONNECTOR_ID,
      uri: "local://community/main/messages/demo",
      metadata: {
        channel: "general",
      },
    },
    {
      id: "local-community-thread-demo",
      type: ResourceType.Thread,
      source: CONNECTOR_ID,
      uri: "local://community/main/threads/demo",
      metadata: {
        channel: "general",
      },
    },
  ],
  tags: ["community", "messaging", "search", "local"],
  health() {
    return {
      healthy: true,
      metadata: {
        mode: "local",
      },
    };
  },
});

function requireTool(tools: RegisteredTool[], toolId: string): RegisteredTool {
  const tool = tools.find((candidate) => candidate.id === toolId);

  if (!tool) {
    throw new Error(`Expected local mock tool "${toolId}" to exist.`);
  }

  return tool;
}

function withCapabilityIds(tool: RegisteredTool, capabilityIds: string[]): RegisteredTool {
  return {
    ...tool,
    capabilityIds,
  };
}
