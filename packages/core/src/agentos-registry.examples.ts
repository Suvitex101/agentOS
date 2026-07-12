import { CapabilityCategory } from "@agentosdev/types";
import { createAgentOSRegistryBootstrapExample } from "./agentos-registry";

export function createAgentOSRegistryDiscoveryExample() {
  const registry = createAgentOSRegistryBootstrapExample();
  const messagingCapability = registry.findCapabilityById("messaging");
  const messagingTools = registry.findToolsByCapability("messaging");
  const messagingConnectors = registry.findConnectorsByCapability("messaging");
  const messagingCapabilities = registry.findCapabilitiesByCategory(CapabilityCategory.Messaging);

  return {
    summary: registry.summary(),
    validation: registry.validate(),
    messagingCapability,
    messagingCapabilities,
    messagingConnectors,
    messagingTools,
    channel: registry.findResourceById("resource-local-demo-channel"),
  };
}
