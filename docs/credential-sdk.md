# Credential SDK

The AgentOS Credential SDK defines how framework components refer to secrets
without embedding secret values in immutable definitions, metadata, traces,
errors, logs, or source code.

It is framework-wide. Connectors, providers, databases, cloud services, and
future plugins should use the same credential reference and resolver model.

## Architecture

```text
Connector / Provider
        |
        v
CredentialReference
        |
        v
CredentialResolver
        |
        +-- EnvironmentCredential
        +-- StaticCredential (development/testing only)
        +-- Future Vaults
        +-- Future Secret Managers
```

Components store references. Resolvers return secret values only at request
time.

## Credential References

Environment credential:

```ts
const credential = {
  type: "environment",
  name: "MODEL_API_KEY",
} as const;
```

Static credential:

```ts
const credential = {
  type: "static",
  value: "development-secret",
} as const;
```

Static credentials are supported for development and tests only. They should not
be used in production examples, public source code, or deployed systems.

## CredentialResolver

```ts
import { CredentialResolver, CredentialType } from "@agentos/sdk";

const resolver = new CredentialResolver({
  environment: process.env,
});

const result = resolver.resolve({
  type: CredentialType.Environment,
  name: "MODEL_API_KEY",
});
```

Resolution returns a typed result:

- `success`
- `credential`
- `errors`
- `warnings`
- redacted `reference`

The resolved credential contains the secret value. Treat it as request-time data
only and do not copy it into definitions, metadata, traces, logs, or errors.

## Provider Integration

`HTTPModelProviderBase` accepts a credential reference and resolver:

```ts
import { CredentialResolver, CredentialType, HTTPModelProviderBase } from "@agentos/sdk";

const transport = new HTTPModelProviderBase({
  baseUrl: "https://api.example.com",
  credential: {
    type: CredentialType.Environment,
    name: "MODEL_API_KEY",
  },
  credentialResolver: new CredentialResolver(),
});
```

The transport resolves the credential at request time and applies it as an
authorization header. The public transport config exposes only a redacted
credential reference.

The live model smoke test uses this path with:

```text
MODEL_API_KEY -> CredentialResolver -> Authorization: Bearer <token>
```

See [Live Model Testing](live-model-testing.md).

## Redaction

AgentOS exports shared redaction helpers:

- `redactSecretValue()`
- `redactMetadata()`
- `redactCredentialReference()`

The current redaction layer handles common secret-bearing fields and token-like
values. It is a safety net, not a replacement for avoiding secret logging in the
first place.

## Current Limitations

- no OAuth
- no encrypted storage
- no Vault integration
- no AWS Secrets Manager, Azure Key Vault, or GCP Secret Manager integration
- no OS keychain integration
- no credential editing UI

These are future integrations. The current goal is to keep credentials
reference-based and resolver-driven so those systems can fit later without
changing component definitions.
