# Connector Author Security Checklist

Use this checklist when creating or reviewing an AgentOS connector.

## Security Profile

- [ ] Connector declares a `security` profile.
- [ ] `riskLevel` reflects worst-case impact.
- [ ] `trustLevel` reflects provenance or review status.
- [ ] `permissions` list only what the connector needs.
- [ ] `requiresUserApproval` is true for sensitive or broad connectors.
- [ ] `networkAccess` matches network permissions.
- [ ] `filesystemAccess` matches file permissions.
- [ ] `secretsAccess` matches secrets permissions.

## Least Privilege

- [ ] Avoid broad permissions when narrower ones work.
- [ ] Avoid secrets access unless required.
- [ ] Avoid command execution unless there is no safer alternative.
- [ ] Avoid network access for local-only connectors.
- [ ] Keep connector resources scoped and explicit.

## Filesystem Safety

- [ ] Require an explicit workspace or root boundary.
- [ ] Reject absolute paths when paths should be relative.
- [ ] Reject traversal outside the configured workspace.
- [ ] Check resolved real paths where symlinks may exist.
- [ ] Avoid following symlinks unless the threat model supports it.
- [ ] Limit search or read size for large files.

## Network Safety

- [ ] Require explicit allowed hosts or origins.
- [ ] Set request timeouts.
- [ ] Limit response size.
- [ ] Redact sensitive headers from logs.
- [ ] Consider SSRF risks before allowing arbitrary URLs.
- [ ] Avoid mutating methods unless explicitly requested.

## Logging And Errors

- [ ] Do not log secrets.
- [ ] Do not return raw provider credentials in errors.
- [ ] Use typed, recoverable errors where possible.
- [ ] Include enough metadata for debugging without leaking sensitive data.

## Review

- [ ] Add unit tests for security metadata.
- [ ] Add tests for unsafe input.
- [ ] Add integration tests for registry bundle behavior.
- [ ] Document current limitations.
- [ ] Mark future enforcement behavior as future work.
