# Configuration

All configuration lives in the user's home directory and is created on first install
from the `config/*.example` templates. **Existing files are never overwritten** by
`install.sh` — edit them in place.

## Files

| File | Purpose |
|---|---|
| `~/.config/codebuddy-router.env` | Router settings (port, gateway URL, optional fallback overrides) |
| `~/.config/codebuddy2api.env` | Gateway runtime env (e.g. outbound proxy) |
| `~/.claude/codebuddy-proxy.settings.json` | Settings passed to Claude Code via `--settings` (`env` + generated `modelPicker`) |
| `~/codebuddy2api/config.json` | Gateway config — **holds your CodeBuddy `api_key`** |
| `~/.claude/settings.json` | Your existing Claude Code config (used as the fallback provider) |

## Router: `~/.config/codebuddy-router.env`

| Variable | Default | Description |
|---|---|---|
| `ROUTER_PORT` | `8788` | Port the router listens on (localhost only). |
| `CODEBUDDY_URL` | `http://127.0.0.1:8787` | Base URL of the local `codebuddy2api` gateway. |
| `FALLBACK_BASE` | *(settings.json)* | Override the fallback provider base URL. |
| `FALLBACK_TOKEN` | *(settings.json)* | Override the fallback provider token. |
| `FALLBACK_MODELS` | *(empty)* | Comma-separated model ids to advertise for the fallback provider in the picker. |
| `CLAUDE_SETTINGS` | `~/.claude/settings.json` | Where to read the fallback provider from. |

> The router does **not** need an outbound proxy: it talks to the gateway and the
> fallback provider over ordinary HTTP(S).

### Fallback resolution order

For each of base URL and token, the router uses, in order:

1. `FALLBACK_BASE` / `FALLBACK_TOKEN` from the env file (if set).
2. The value in `~/.claude/settings.json` (`env.ANTHROPIC_BASE_URL` / `env.ANTHROPIC_AUTH_TOKEN`).

The settings file is re-read whenever it changes, so edits apply without a restart.

## Gateway: `~/.config/codebuddy2api.env`

| Variable | Description |
|---|---|
| `HTTP_PROXY` / `HTTPS_PROXY` | Outbound proxy for the gateway. **Required** if your host resolves `www.codebuddy.ai` through a proxy or a fake-IP DNS range, otherwise the gateway hangs on connect. |
| `NO_PROXY` | Hosts to bypass the proxy (keep `localhost,127.0.0.1,::1`). |

If you have direct connectivity, leave the proxy lines commented out.

## Claude Code: `~/.claude/codebuddy-proxy.settings.json`

Written by `install.sh` (from the example) and maintained by the picker timer.

- `env` — points Claude Code at the router and sets the default/subagent models.
- `modelPicker.options` — **generated**; do not edit by hand. Regenerate with
  `systemctl --user start codebuddy-picker.service`.

## Gateway key: `~/codebuddy2api/config.json`

Holds the CodeBuddy `api_key` used by the gateway. **This file is local and must never
be committed.** See [SECURITY.md](../SECURITY.md).

## Example: override the fallback provider

```env
# ~/.config/codebuddy-router.env
ROUTER_PORT=8788
CODEBUDDY_URL=http://127.0.0.1:8787
FALLBACK_BASE=https://your-provider.example.com/anthropic
FALLBACK_TOKEN=sk-xxxxxxxxxxxxxxxx
FALLBACK_MODELS=your-model-a,your-model-b
```

Then restart the router:

```bash
systemctl --user restart codebuddy-router.service
```
