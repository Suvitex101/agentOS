# Release Checklist

This checklist is for a future controlled public alpha release. It does not
publish packages by itself.

## Repository State

- [ ] Working tree is clean.
- [ ] Release branch is reviewed.
- [ ] `CHANGELOG.md` is updated.
- [ ] Version is aligned across publishable packages.
- [ ] Package audit decisions are still accurate.

## Local Verification

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm format:check`
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm test:evaluation`
- [ ] `pnpm build`
- [ ] `pnpm test:examples`
- [ ] `pnpm test:package-install`
- [ ] `pnpm release:check`

## Package Verification

- [ ] `main`, `types`, and `exports` point to `dist`.
- [ ] `files` does not expose source internals.
- [ ] `pnpm pack:packages` succeeds.
- [ ] Packed tarballs install in a temporary external consumer project.
- [ ] External consumer imports from `@agentos/sdk`.
- [ ] External consumer executes a deterministic task.

## npm Metadata Review

- [ ] Package names are correct.
- [ ] Package descriptions are accurate.
- [ ] License is `Apache-2.0`.
- [ ] Repository metadata is correct.
- [ ] Homepage and issue URLs are correct.
- [ ] Keywords are relevant.
- [ ] No fake maintainers or adoption claims are included.

## Documentation

- [ ] README is concise and current.
- [ ] API reference is current.
- [ ] Architecture docs are current.
- [ ] Release notes are drafted.
- [ ] GitHub release draft is current.
- [ ] Announcement drafts are current.
- [ ] Known limitations are explicit.
- [ ] License is present.
- [ ] Package-level READMEs are present for publishable packages.
- [ ] Package tarballs include license files.

## Known Non-Blocking Warnings

- [ ] Next.js currently reports that the Next.js ESLint plugin is not detected
      during `next build`. The dashboard app is private and not part of the npm
      alpha package set. Do not hide the warning; fix it later by adding the
      correct Next ESLint configuration when dashboard work resumes.

## Publishing Preparation

- [ ] npm provenance decision is made.
- [ ] npm organization/package access is confirmed.
- [ ] Publishing account permissions are confirmed.
- [ ] Dry-run package contents are reviewed.
- [ ] `docs/release/github-release.md` is ready to copy into GitHub.
- [ ] `docs/release/announcement.md` is reviewed for public announcement use.
- [ ] Git tag plan is confirmed.
- [ ] GitHub release notes are prepared.

## Post-Release Smoke Test

- [ ] Create a fresh project outside the monorepo.
- [ ] Run `npm install @agentos/sdk`.
- [ ] Import the public SDK.
- [ ] Define an agent.
- [ ] Run a deterministic task.
- [ ] Confirm docs and examples match published behavior.
