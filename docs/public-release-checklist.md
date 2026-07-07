# Public Release Checklist

Use this checklist before making AgentOS public on GitHub or submitting grant
materials.

## Repository Basics

- [x] `LICENSE` exists.
- [x] README explains what AgentOS is.
- [x] README links to vision, positioning, architecture, API reference, roadmap,
      contributing, and license.
- [x] Repository has a code of conduct.
- [x] Repository has contributing guidance.
- [x] Repository has issue templates.
- [x] Repository has a pull request template.

## Examples

- [x] Basic agent example.
- [x] Community manager example.
- [x] Business assistant example.
- [x] Research assistant example.
- [x] Memory demo.
- [x] Custom tool example.
- [x] Research connector example.
- [x] Community connector bundle example.

## Quality

- [x] `pnpm format:check`
- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm test`
- [x] `pnpm build`
- [x] `pnpm test:examples`
- [x] GitHub Actions CI exists.

## Documentation

- [x] Vision document.
- [x] Positioning document.
- [x] Architecture document.
- [x] Architecture diagram.
- [x] API reference starter.
- [x] Roadmap.
- [x] First contribution guide.
- [x] Grant readiness docs.
- [x] Public limitations documented.

## GitHub Repository Setup

- [ ] Add concise repository description.
- [ ] Add topics/tags such as `ai-agents`, `typescript`, `agent-framework`,
      `open-source`, `tooling`, `agent-infrastructure`.
- [ ] Confirm default branch protection expectations.
- [ ] Confirm issues and discussions settings.
- [ ] Confirm public visibility timing.

## Demo And Grant Submission

- [ ] Record short demo video.
- [ ] Review `docs/grant/demo-script.md`.
- [ ] Select grant milestone proposal.
- [ ] Confirm application answers align with current implementation.
- [ ] Do not claim production readiness.
- [ ] Do not claim real provider integrations.

## Known Limitations To Disclose

- [ ] Runtime is local-first.
- [ ] Connectors are currently local/mock.
- [ ] No production external provider integrations yet.
- [ ] No persistent database-backed memory yet.
- [ ] No vector memory yet.
- [ ] Dashboard is not production-ready yet.
- [ ] Execution controls are placeholders.
