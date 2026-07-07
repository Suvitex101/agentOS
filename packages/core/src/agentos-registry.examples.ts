import { CapabilityCategory } from "@agentos/types";
import { createAgentOSRegistryBootstrapExample } from "./agentos-registry";

export function createAgentOSRegistryDiscoveryExample() {
  const registry = createAgentOSRegistryBootstrapExample();
  const messagingCapability = registry.findCapabilityById("capability-messaging");
  const messagingTools = registry.findToolsByCapability("capability-messaging");
  const messagingConnectors = registry.findConnectorsByCapability("capability-messaging");
  const messagingCapabilities = registry.findCapabilitiesByCategory(CapabilityCategory.Messaging);

  return {
    summary: registry.summary(),
    validation: registry.validate(),
    messagingCapability,
    messagingCapabilities,
    messagingConnectors,
    messagingTools,
    channel: registry.findResourceById("resource-discord-builders-channel"),
  };
}
