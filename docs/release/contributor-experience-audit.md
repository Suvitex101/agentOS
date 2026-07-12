# Contributor Experience Audit

This audit records the first-alpha contributor flow from the perspective of a
new developer.

## Verified Flow

Expected first-time flow:

```bash
git clone https://github.com/Suvitex101/agentOS.git
cd agentOS
pnpm install
pnpm build
pnpm test
pnpm test:examples
pnpm test:package-install
```

The release gate is:

```bash
pnpm release:check
```

## What Is Clear

- README explains the task-centric architecture and links to deeper docs.
- `@agentos/sdk` is documented as the primary public entry point.
- Examples cover basic agent usage, memory, connectors, providers, planner
  prompts, plan validation, GitHub, and Ollama.
- Package install verification creates an external consumer project and imports
  from packed tarballs.
- Known limitations are documented instead of hidden.

## Potential Friction

- The public SDK surface is intentionally broad for alpha and may feel large.
- The dashboard app is present but explicitly not production-ready.
- `next build` reports a known non-blocking ESLint plugin warning.
- Live provider examples are opt-in and require local/environment setup.
- Some examples use mocked transport by design, which should be explained when
  demonstrating live behavior.

## Small Fixes Completed In This Pass

- Corrected publishable package repository metadata.
- Added package-level READMEs.
- Updated changelog and release docs to include GitHub and Ollama.
- Added release announcement and GitHub release draft.

## Recommendation

AgentOS is ready for first-alpha publication from a contributor onboarding
perspective once `pnpm release:check` passes on the release branch.
