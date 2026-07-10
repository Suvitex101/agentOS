# Live Model Testing

AgentOS supports a live OpenAI-compatible model workflow for manual smoke
testing. Live testing is opt-in only. CI and automated tests remain fully
deterministic and do not require network access or credentials.

## Modes

### Deterministic Mode

Deterministic mode is the default:

```bash
pnpm example:live-model-agent
```

This mode uses:

- mocked OpenAI-compatible HTTP transport
- static development credential
- temporary local filesystem workspace
- `ModelAssistedPlanner`
- `AgentOSRegistry`
- `ModelProviderResolver`
- `CredentialResolver`
- `SimpleExecutionEngine`
- `ToolResolver`
- `FilesystemConnector`
- in-memory memory store

It does not call the internet.

### Live Mode

Live mode is opt-in:

```bash
MODEL_BASE_URL="https://your-openai-compatible-endpoint" \
MODEL_NAME="your-model" \
MODEL_API_KEY="your-token" \
pnpm smoke:live-model
```

If required configuration is missing, the smoke test exits gracefully with a
message such as:

```text
Live example skipped because MODEL_API_KEY is not configured.
```

## Required Environment Variables

- `MODEL_BASE_URL`: HTTPS base URL for an OpenAI-compatible endpoint
- `MODEL_NAME`: model identifier accepted by the endpoint
- `MODEL_API_KEY`: bearer token resolved through the Credential SDK

No secrets are checked into the repository. Do not put real credentials in
examples, docs, test fixtures, traces, or issue reports.

## Workflow

The live model agent demonstrates:

```text
agent.run("Summarize README.md into SUMMARY.md")
  -> ModelAssistedPlanner
  -> ModelProviderResolver
  -> HTTPModelProviderBase
  -> CredentialResolver
  -> OpenAI-compatible endpoint
  -> validated Plan
  -> SimpleExecutionEngine
  -> ToolResolver
  -> FilesystemConnector tools
  -> InMemoryMemoryStore
  -> Result
```

The model generates a plan. The execution engine resolves filesystem tools from
the registry, executes those tools, writes a memory summary, and returns a
structured result.

## Why CI Never Calls Live Providers

CI must be repeatable, fast, and safe. Live provider calls introduce:

- network dependency
- provider availability risk
- rate limits
- credential handling risk
- nondeterministic model output

For that reason, CI uses mocked transports and deterministic providers only.

## Troubleshooting

If the smoke test skips, check that all required environment variables are set.

If the provider returns invalid output, verify that the endpoint supports an
OpenAI-compatible `/v1/chat/completions` response shape and that the model can
return JSON plans.

If execution fails after planning, inspect the generated plan. Filesystem steps
should target these tool ids in the example:

- `tool-live-filesystem-read-file`
- `tool-live-filesystem-write-file`

## Security Guidance

- Use environment credentials for live testing.
- Do not use static credentials for production.
- Do not commit `.env` files.
- Do not paste live tokens into issues or logs.
- Treat live provider output as untrusted input.
- Keep live smoke testing outside CI.
