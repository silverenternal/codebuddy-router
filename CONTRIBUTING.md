# Contributing

Thanks for your interest in improving `codebuddy-router`!

## Prerequisites

- Node.js ≥ 18 (`.nvmrc` pins 20)
- git
- For full end-to-end testing: Go ≥ 1.25, Claude Code, and systemd

## Getting started

```bash
git clone https://github.com/silverenternal/codebuddy-router.git
cd codebuddy-router
```

There are **no dependencies to install** — the project uses only Node built-ins.

## Running the checks

```bash
npm run check   # node --check on every source file
npm test        # node:test unit tests
npm run lint    # both of the above
```

CI runs the same checks on Node 18 / 20 / 22, plus `shellcheck` on `install.sh`.

## Code style

- ESM (`.mjs`), 2-space indent, single quotes, semicolons.
- Keep **pure logic** in `router/lib/` (no I/O) and cover it with tests.
- Keep the entry points (`router/server.mjs`, `router/gen-picker.mjs`) thin.
- Add JSDoc to exported functions.
- Prefer built-ins; the zero-dependency constraint is intentional.

Editor defaults are enforced by `.editorconfig` (LF, UTF-8, final newline).

## Project layout

```
router/        router + picker entry points
router/lib/    pure, tested logic (models, picker, settings)
bin/           the claude-cb launcher
systemd/       user service + timer templates
config/        *.example config templates
test/          node:test suites
docs/          documentation
```

## Commits and pull requests

- Write clear, imperative commit subjects (e.g. `fix: honor CODEBUDDY_URL override`).
- Keep PRs focused; update `CHANGELOG.md` under `[Unreleased]` for user-visible changes.
- Fill in the pull request template and confirm the checklist.

## Security

**Never commit secrets.** This project reads all credentials from local config at
runtime — see [SECURITY.md](SECURITY.md). If you suspect a leak, follow the reporting
process there rather than opening a public issue.
