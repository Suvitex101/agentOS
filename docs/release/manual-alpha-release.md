# Manual Alpha Release

This guide describes the manual release process for `0.1.0-alpha.1`.

Do not use this guide to publish from a dirty working tree, an unverified build,
or an unreviewed commit.

## Preconditions

- Current branch is `main`.
- Remote repository is `https://github.com/Suvitex101/agentOS.git`.
- Working tree is clean.
- `CHANGELOG.md` includes `0.1.0-alpha.1`.
- Package versions are aligned to `0.1.0-alpha.1`.
- Publishable packages have README, LICENSE, export maps, and built `dist/`
  output.
- CI is passing on the release commit.

## Local Release Gate

```bash
pnpm install
pnpm release:npm-preflight
pnpm release:check
pnpm test:package-install
```

## Publication Order

Publish packages in dependency-aware order:

```text
1. @agentos/types
2. @agentos/memory
3. @agentos/core
4. @agentos/providers
5. @agentos/connectors
6. @agentos/sdk
```

`@agentos/core` depends on `@agentos/memory`, so memory must be published before
core. `@agentos/sdk` should be published last because it is the public aggregate
entry point.

## Manual npm Publish Commands

Run from the repository root after the release gate passes:

```bash
pnpm --dir packages/types publish --access public --tag alpha
pnpm --dir packages/memory publish --access public --tag alpha
pnpm --dir packages/core publish --access public --tag alpha
pnpm --dir packages/providers publish --access public --tag alpha
pnpm --dir packages/connectors publish --access public --tag alpha
pnpm --dir packages/sdk publish --access public --tag alpha
```

Do not publish private packages:

- `@agentos/tools`
- `@agentos/config`
- `@agentos/web`

## Post-Publish Verification

Run the npm smoke test:

```bash
open docs/release/npm-post-publish-smoke-test.md
```

Then verify npm metadata:

```bash
npm view @agentos/sdk@alpha version
npm view @agentos/sdk@alpha dist-tags
```

## Stop Conditions

Stop and do not publish if:

- The working tree is dirty.
- The current branch is not `main`.
- The remote URL is not `https://github.com/Suvitex101/agentOS.git`.
- `pnpm release:npm-preflight` fails.
- `pnpm release:check` fails.
- Any packed package contains `workspace:` dependencies.
- Any publishable package lacks `README.md`, `LICENSE`, or built `dist/`
  entries.
- Any package version already exists on npm.

## GitHub Release

After npm smoke tests pass, use `docs/release/github-release.md` as the GitHub
Release body for `v0.1.0-alpha.1`.
