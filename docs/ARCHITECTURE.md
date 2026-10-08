# Architecture

## Overview

`codebuddy-router` is a small, dependency-free Node service that presents **one**
Anthropic Messages API endpoint to Claude Code and fans out to **two** upstreams:

- **CodeBuddy** models → the local `codebuddy2api` gateway → `https://www.codebuddy.ai`
- **everything else** → the *fallback* provider, read live from the user's existing
  `~/.claude/settings.json`

This is what lets a single Claude Code session list and switch between both model
families in one `/model` picker. The installer points `~/.claude/settings.json` at the
router (backing it up first), so plain `claude` gets the same setup.

## Components

```
┌──────────────┐   Anthropic Messages API    ┌──────────────────────┐
│  Claude Code │ ──────────────────────────▶ │  codebuddy-router    │
│  (claude /   │   127.0.0.1:8788            │  server.mjs          │
│   claude-cb) │ ◀────────────────────────── │                      │
└──────────────┘                             └───────┬──────┬───────┘
                                                     │      │
                     model ∈ CodeBuddy ? ────────────┘      └──────── 否则
                              │                                        │
                              ▼                                        ▼
                    ┌──────────────────┐                  ┌────────────────────┐
                    │  codebuddy2api   │                  │  fallback provider │
                    │  127.0.0.1:8787  │                  │  (from settings)   │
                    └────────┬─────────┘                  └────────────────────┘
                             ▼
                    https://www.codebuddy.ai
```

| Component | Unit / file | Role |
|---|---|---|
| Launcher | `bin/claude-cb` | Health-checks the router, starts it if down, then `exec claude` |
| Router | `router/server.mjs` | The HTTP endpoint; classifies by model name and proxies |
| Picker sync | `router/gen-picker.mjs` | Regenerates the `/model` list from the live catalog |
| Gateway | `codebuddy2api` (external) | Translates Anthropic ⇄ CodeBuddy and talks to `www.codebuddy.ai` |
| Services | `systemd/*` | Supervise the router, the gateway, and the picker timer |

## Request flow

1. `claude-cb` probes `GET /health`. If unhealthy, it runs
   `systemctl --user reset-failed` + `start codebuddy-router.service`, then waits.
2. Claude Code reads `~/.claude/settings.json`, whose `env` points `ANTHROPIC_BASE_URL`
   at `http://127.0.0.1:8788` (plain `claude` and `claude-cb` behave the same).
3. For each request the router reads the `model` field from the JSON body and decides:
   - `isCodeBuddy(model, cbModels)` → proxy to the gateway (no auth header injected;
     the gateway holds the CodeBuddy key).
   - otherwise → proxy to the fallback base with `Authorization: Bearer <token>`.
4. The response (including streaming SSE) is piped straight back to Claude Code.

The `proxy()` helper strips hop-by-hop headers, rewrites `content-length`, and streams
the upstream response with `pipe()` — so token streaming works end to end.

## Model classification

Two signals, in order (`router/lib/models.mjs`):

1. **Live catalog membership** — the set of ids fetched from the gateway's
   `/v1/models` (refreshed every 60 s, and on every `GET /v1/models`).
2. **Prefix match** — a case-sensitive regex over known CodeBuddy id prefixes
   (`deepseek`, `glm`, `kimi`, `gpt-`, `gemini-`, `minimax-m`, …).

Case sensitivity is deliberate: CodeBuddy ids are lowercase (`minimax-m3`) while a
fallback provider's may not be (`MiniMax-M3`), so the two never collide.

`DENY` lists ids the upstream advertises but which error out; `filterCatalog()` drops
them so they never reach the picker.

## Picker data flow

```
codebuddy2api /v1/models ─┐
                          ├─▶ router GET /v1/models ─▶ gen-picker ─▶ modelPicker.options
fallback (FALLBACK_MODELS)┘        (merged, live)                    (~/.claude/settings.json)
```

`gen-picker.mjs` rewrites **only** the `modelPicker` block, preserving `env`. It is a
no-op if the catalog is unreachable or unchanged, so a transient gateway outage never
wipes the user's picker.

## Module responsibilities

| Module | Responsibility | I/O |
|---|---|---|
| `router/lib/models.mjs` | Classification + deny-list | none (pure) |
| `router/lib/picker.mjs` | Curated labels, `behavesAs`, ordering | none (pure) |
| `router/lib/settings.mjs` | Env parsing + fallback extraction | reads a settings file |
| `router/server.mjs` | HTTP server + streaming proxy | network |
| `router/gen-picker.mjs` | Fetch catalog, write picker | network + file |
| `router/configure-settings.mjs` | Wire Claude Code to the router (run by `install.sh`) | file |

Pure modules are covered by `node:test` (see `test/`).

## Reliability model

- Every service runs under `systemd --user` with `Restart=always` and
  `StartLimitIntervalSec=0`, so a crash burst cannot latch a unit into `failed`.
- `claude-cb` self-heals: it clears `failed`, starts the router, and waits before
  giving up. `codebuddy-router.service` has `Wants=codebuddy2api.service`, so starting
  the router pulls up the gateway too.
- `loginctl enable-linger` keeps the services running after logout / at boot.
- The fallback provider is configured explicitly in `~/.config/codebuddy-router.env`
  (`FALLBACK_BASE` / `FALLBACK_TOKEN`), because `settings.json` now points at the router
  itself. Changing it requires a router restart.

## Design trade-offs

- **One endpoint, name-based routing** rather than two ports: Claude Code's `/model`
  picker is fed by a single `/v1/models`, so both families must live behind one origin.
- **No dependencies**: the whole router is a few hundred lines of Node built-ins,
  which keeps the attack surface and the install footprint small.
- **Refactor over rewrite**: the code was extracted into pure modules so the logic is
  testable, without changing runtime behaviour.
