# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
