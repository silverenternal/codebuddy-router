# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Instead, use GitHub's
private reporting:

<https://github.com/silverenternal/codebuddy-router/security/advisories/new>

Include a description, reproduction steps, and the impact you believe it has. We aim to
acknowledge reports within a few days.

## Credential handling

This project is designed so that **no credentials are ever stored in the repository**.
All secrets are read from local files at runtime:

| Secret | Where it lives | Never in the repo |
|---|---|---|
| CodeBuddy API key (`ck_…`) | `~/codebuddy2api/config.json` | ✔ |
| Fallback token (e.g. `sk-…`) | `~/.claude/settings.json` | ✔ |
| Router/gateway env | `~/.config/*.env` | ✔ |

The router itself holds **no** upstream key: CodeBuddy requests are forwarded to the
local gateway (which owns the key), and the fallback token is injected from your
existing Claude Code settings.

### If you contribute

- Do not paste tokens, keys, or `.env` contents into issues, PRs, logs, or commit
  messages. Redact them.
- `.gitignore` blocks `*.env`, `config.json`, and `*.settings.json`; only
  `*.example` templates are tracked. Keep it that way.
- Run a quick check before pushing:
  ```bash
  git grep -nE 'sk-[A-Za-z0-9]{20,}|ck_[A-Za-z0-9]{8,}' $(git rev-list --all) || true
  ```

## Trust boundary

The router listens on `127.0.0.1` only. It does not authenticate inbound requests —
anything that can reach the loopback port can use your configured upstreams. Do not
expose it to a network interface.

## Supported versions

Only the latest release on `main` is supported with security fixes.
