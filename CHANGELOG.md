# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Model-id aliasing: retired CodeBuddy ids replayed when resuming old sessions are
  rewritten to their current equivalent (`deepseek-flash` → `deepseek-v4.1-flash`), and
  a trailing `[1m]`-style context suffix is stripped first. Fallback-provider ids
  (e.g. `MiniMax-M3`) are deliberately **not** rewritten, so the models in the fallback
  subscription stay selectable.
- Protocol adaptation: requests routed to CodeBuddy have `thinking` / `redacted_thinking`
  blocks removed, since the gateway only translates `text` / `image` / `tool_use` /
  `tool_result` and otherwise returns `400 不支持的内容块类型`. Fixes sessions built on a
  thinking-capable provider (e.g. MiniMax) erroring once routed to the gateway.
- The fallback provider's models are now discovered live from its `/v1/models`, so every
  model in the fallback subscription appears in the `/model` picker. `FALLBACK_MODELS`
  is only used when that endpoint is unreachable.

### Changed

- Plain `claude` now routes through the router. `install.sh` backs up
  `~/.claude/settings.json`, points it at the router, and moves the previous provider
  into `FALLBACK_BASE` / `FALLBACK_TOKEN` in the router env (avoiding a self-reference
  loop). Every model slot defaults to `deepseek-v4.1-flash`.
- `claude-cb` is now a thin health-check wrapper around `claude`.
- The `/model` picker is written to `~/.claude/settings.json` (previously a separate
  `codebuddy-proxy.settings.json`). Added `router/configure-settings.mjs` to do the wiring.

## [1.0.0] - 2026-10-08

### Added

- Local Anthropic-API router (`router/server.mjs`) that classifies requests by model
  name: CodeBuddy models go to the local `codebuddy2api` gateway, everything else to the
  fallback provider read live from `~/.claude/settings.json`.
- `claude-cb` launcher: health-checks the router, self-heals the service, and offers
  `claude-cb doctor` for diagnostics.
- Dynamic `/model` picker sync (`router/gen-picker.mjs`) driven by a systemd timer.
- systemd `--user` services and portable unit templates.
- Idempotent `install.sh` with `--skip-gateway`, `--gateway-dir`, and `--uninstall`.
- Pure modules under `router/lib/` with `node:test` unit tests.
- Documentation: architecture, configuration, and troubleshooting guides.

[Unreleased]: https://github.com/silverenternal/codebuddy-router/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/silverenternal/codebuddy-router/releases/tag/v1.0.0
