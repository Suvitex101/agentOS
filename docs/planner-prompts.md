# Planner Prompts

AgentOS treats prompts used for model-assisted planning as versioned
architecture assets, not incidental strings inside planner code.

This keeps the planning contract easier to review, test, and evolve without
changing the provider abstraction or the execution engine.

## Philosophy

Planner prompts should be:

- task-centric
- provider-agnostic
- deterministic to build
- explicit about JSON-only output
- small enough to inspect
- free of secrets, credentials, traces, and unnecessary registry data

The prompt system is intentionally scoped to planning. AgentOS does not include
a generic prompt framework in this phase.

## Prompt Assets

The prompt assets live in `packages/core/src/planner-prompts.ts`.

They expose:

- `PLANNER_PROMPT_VERSION`
- `PLANNER_PROMPT_METADATA`
- `DEFAULT_PLANNING_SYSTEM_PROMPT`
- `REPAIR_SYSTEM_PROMPT`
- `buildPlanningPrompt()`
- `buildRepairPrompt()`
- `createPlannerPromptMetadata()`

The assets are exported through `@agentos/sdk`.

## Versioning

Current version:

```ts
PlannerPromptVersion.V1;
```

Generated model-assisted plans record the prompt version in metadata:

```ts
plan.metadata.promptVersion;
```

Future prompt versions should be added alongside the current version instead of
silently changing old behavior.

## Planning Prompt Builder

`buildPlanningPrompt()` assembles the prompt from structured pieces:

- task objective
- agent capabilities
- available tools
- supported step types
- supported plan schema version
- maximum step count
- minimal valid JSON example

It avoids sending:

- credentials
- environment variables
- execution history
- raw memory contents
- unnecessary registry state

## JSON Output Guidance

Planning prompts instruct providers to return:

- JSON only
- no Markdown
- no code fences
- no explanations
- no comments

They include one intentionally small valid JSON example.

The model output is still treated as untrusted. It must pass
`PlanValidator` before execution.

## Structured Output Support

If a model provider declares `structured-output`, the prompt builder records the
`structured-output` capability path and includes stronger strict-JSON guidance.

If the provider does not declare that capability, the prompt builder uses the
standard path.

The selected path is recorded in plan metadata:

```ts
plan.metadata.providerCapabilityPath;
```

## Repair Prompts

`buildRepairPrompt()` is used by `ModelAssistedPlanner` after first-pass
validation fails and repair is enabled.

The repair prompt includes:

- validation issue summaries
- the original provider response, truncated to a bounded size
- supported step types
- schema version
- JSON-only instructions

Repair is limited to one attempt. The repaired output is validated again before
it can be accepted.

## Metadata

`ModelAssistedPlanner` records:

- `promptVersion`
- `promptSize`
- `providerCapabilityPath`
- `firstPassValidationSucceeded`
- `repairRequired`
- `fallbackRequired`

The full prompt is not stored by default. Passing `debugPrompt: true` to the
planner exposes it in plan metadata for local debugging.

Do not enable prompt debugging in logs or production traces that may contain
sensitive task context.

## Example

Run:

```bash
pnpm example:planner-prompts
```

The example demonstrates:

- standard provider prompt generation
- structured-output provider prompt generation
- generated plan prompt metadata
- optional debug prompt exposure

## Current Limitations

- no provider-specific prompt variants
- no generic prompt registry
- no prompt marketplace
- no runtime prompt optimization
- no automatic prompt evaluation loop

Future revisions should preserve the separation between prompts, providers,
validation, and execution.
