# Public API Surface

This document defines the intended `@agentos/sdk` public API for
`0.1.0-alpha.1`.

The SDK is the primary public entry point. It re-exports selected APIs from
`@agentos/core`, `@agentos/types`, `@agentos/memory`, `@agentos/connectors`, and
`@agentos/providers`.

## Agent Composition and Runtime

- `defineAgent`
- `AgentDefinition`
- `AgentRunInput`
- `AgentRunOptions`
- `createTask`

## Planners

- `RuleBasedPlanner`
- `ModelAssistedPlanner`
- `PlanValidator`
- `createPlanValidator`
- `buildPlanningPrompt`
- `buildRepairPrompt`
- `PLANNER_PROMPT_VERSION`
- `PLANNER_PROMPT_METADATA`
- `DEFAULT_PLANNING_SYSTEM_PROMPT`
- `REPAIR_SYSTEM_PROMPT`

## Execution

- `SimpleExecutionEngine`
- `ToolResolver`

## Registry

- `AgentOSRegistry`
- `createAgentOSRegistryBootstrapExample`
- `LocalCommunityConnector`

## Tool Authoring

- `defineTool`
- `defineMessagingTool`
- `defineResearchTool`
- `defineBusinessTool`
- `validateToolDefinitionConfig`

## Connector Authoring

- `defineConnector`
- `defineMessagingConnector`
- `defineResearchConnector`
- `defineBusinessConnector`
- `validateConnectorDefinitionConfig`

## Connectors

- `createFilesystemConnector`
- `createHttpConnector`
- `createGitHubConnector`

## Memory

- `InMemoryMemoryStore`
- `MemoryStore`

## Model Providers

- `defineModelProvider`
- `MockModelProvider`
- `EchoModelProvider`
- `ModelProviderResolver`
- `HTTPModelProviderBase`
- `createOpenAICompatibleProvider`
- `createOllamaProvider`

## Credentials and Security

- `CredentialResolver`
- `validateCredentialReference`
- `redactCredentialReference`
- `redactMetadata`
- `redactSecretValue`
- `SecurityPolicyEngine`

## Types and Enums

The SDK re-exports `@agentos/types`. Important public types include:

- `Agent`
- `Task`
- `Plan`
- `PlanStep`
- `Result`
- `ExecutionContext`
- `ExecutionTrace`
- `ToolExecutionResult`
- `ConnectorSecurityProfile`
- `SecurityPolicyConfig`
- `CredentialReference`
- `ModelProvider`
- `ModelGenerationRequest`
- `ModelGenerationResponse`
- `PlannerPromptVersion`
- `PlanSchemaVersion`

## Findings From the Surface Audit

- README examples are aligned with `@agentos/sdk` as the public import path.
- API reference exports are available from `@agentos/sdk`.
- The SDK intentionally re-exports broad type coverage during alpha to keep
  examples simple.
- `@agentos/tools` remains private because it is currently a placeholder.
- Internal implementation files are not exposed through package export maps.

## Known Alpha Concerns

- The public surface is still broad. It may need tightening before beta.
- Some names are intentionally verbose for clarity.
- Provider and connector APIs are alpha-stage and may evolve with real-world
  integrations.
