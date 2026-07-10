# Plan Validation

AgentOS treats model-generated plans as untrusted input.

Before a model-assisted plan can reach execution, it must pass deterministic
validation. If validation fails and repair is enabled, the planner may make one
repair request to the provider. The repaired output is treated exactly like new
untrusted provider output and must pass validation again.

## Flow

```text
Provider Output
  -> Parse JSON
  -> Build Candidate Plan
  -> PlanValidator
  -> Valid Plan
  -> Execution
```

With repair enabled:

```text
Validate
  -> invalid
  -> one repair request
  -> validate repaired output
  -> accept, fallback, or fail
```

Repair never recurses and never retries indefinitely.

## Schema Versioning

Model-generated plans include:

```ts
metadata: {
  schemaVersion: "v1";
}
```

`PlanSchemaVersion.V1` is the current supported schema version. Future schema
versions can coexist by extending `PlanValidator` without changing execution.

Plans without a schema version are allowed with a warning for backward
compatibility with deterministic planners. Unsupported explicit schema versions
are rejected.

## Validation Rules

`PlanValidator` checks:

- plan is a plain object
- supported schema version
- task id exists
- steps array exists
- step count is greater than zero
- step count does not exceed the configured maximum
- step ids are present and unique
- step ordering is sequential
- descriptions are non-empty
- step types are supported
- tool ids and capability names use safe identifiers
- step input is a plain object when provided
- metadata size limits
- total plan size limits
- string length limits

Validation returns all issues together instead of failing on the first issue.

## Security Protections

The validator rejects dangerous or privileged fields, including:

- `__proto__`
- `constructor`
- `prototype`
- `execute`
- `registryMutation`
- `memoryMutation`
- `toolOutput`
- `toolResult`
- execution metadata such as `executionId`

This prevents prototype pollution, hidden executable fields, provider-controlled
execution state, and registry or memory mutation attempts from reaching the
execution engine.

## Typed Issues

Validation issues include:

- `code`
- `message`
- `severity`
- `path`
- redacted `offendingValue`

Secrets and token-like values are redacted before being attached to issues.

## Fallback Behavior

`ModelAssistedPlanner` respects existing fallback configuration:

- `fallback: "rule-based"` returns a deterministic rule-based plan when provider
  planning or repair fails.
- `fallback: "fail"` throws a typed planning error.

Plan metadata records:

- `schemaVersion`
- `validationDurationMs`
- `validationIssueCount`
- `repairAttempted`
- `repairSucceeded`
- `repairDurationMs`
- `fallbackUsed`
- `fallbackReason`

Raw provider responses are not included unless `includeRawResponse: true` is
explicitly set.

## Current Limitations

- validation is structural and deterministic
- no external JSON Schema dependency is used
- repair quality depends on the configured provider
- semantic correctness of a plan still depends on the planner and available
  tools
- execution remains responsible for resolving tools and handling tool failures
