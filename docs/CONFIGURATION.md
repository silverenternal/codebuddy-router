# Configuration

All configuration lives in the user's home directory and is created on first install
from the `config/*.example` templates. **Existing files are never overwritten** by
`install.sh` — edit them in place.

## Files

| File | Purpose |
|---|---|
| `~/.config/codebuddy-router.env` | Router settings: port, gateway URL, **and the fallback provider** (`FALLBACK_BASE` / `FALLBACK_TOKEN` / `FALLBACK_MODELS`) |
| `~/.config/codebuddy2api.env` | Gateway runtime env (e.g. outbound proxy) |
| `~/.claude/settings.json` | Points Claude Code at the router (`env` + generated `modelPicker`). **Backed up** by `install.sh` before it is rewritten |
| `~/codebuddy2api/config.json` | Gateway config — **holds your CodeBuddy `api_key`** |

## Router: `~/.config/codebuddy-router.env`

| Variable | Default | Description |
|---|---|---|
| `ROUTER_PORT` | `8788` | Port the router listens on (localhost only). |
| `CODEBUDDY_URL` | `http://127.0.0.1:8787` | Base URL of the local `codebuddy2api` gateway. |
| `FALLBACK_BASE` | *(none)* | Fallback provider base URL. |
| `FALLBACK_TOKEN` | *(none)* | Fallback provider token. |
| `FALLBACK_MODELS` | *(empty)* | Model ids to advertise for the fallback provider when its `/v1/models` cannot be reached — otherwise the list is discovered live. |
| `CLAUDE_SETTINGS` | `~/.claude/settings.json` | Where the router *would* read the fallback from, if `FALLBACK_*` are not set. |

> The router does **not** need an outbound proxy: it talks to the gateway and the
> fallback provider over ordinary HTTP(S).

### Model aliases

A Claude Code session records the model it was created with, and resuming an old
session can replay an id that no longer exists upstream. The router rewrites these to a
current equivalent before routing:

| Requested id | Rewritten to |
|---|---|
| `deepseek-flash` | `deepseek-v4.1-flash` |

A trailing context-size suffix (`[1m]`, `[200k]`, …) is stripped first, so
`deepseek-v4.1-flash[1m]` resolves too. Ids with no alias are passed through untouched.

Fallback-provider ids (e.g. `MiniMax-M3`) are **never** rewritten — they must reach the
fallback provider so that every model in that subscription stays selectable. To add a
mapping, edit `ALIASES` in `router/lib/models.mjs`.

### Protocol adaptation

The CodeBuddy gateway only translates four content-block types (`text`, `image`,
`tool_use`, `tool_result`). Requests routed to CodeBuddy therefore have `thinking` /
`redacted_thinking` blocks removed; the fallback leg is left untouched (MiniMax, for
one, accepts thinking blocks). See [ARCHITECTURE.md](ARCHITECTURE.md#protocol-adaptation).

### Fallback provider

The fallback (used for any model that is **not** a CodeBuddy model) is configured in the
router env file:

```env
FALLBACK_BASE=https://your-provider.example.com/anthropic
FALLBACK_TOKEN=sk-xxxxxxxxxxxxxxxx
FALLBACK_MODELS=your-model-a,your-model-b
```

`install.sh` fills these in from your previous `settings.json`. They are kept explicit
here because `~/.claude/settings.json` now points at the router — reading the fallback
from there would be a self-reference loop. Restart the router after changing them:

```bash
systemctl --user restart codebuddy-router.service
```

## Gateway: `~/.config/codebuddy2api.env`

| Variable | Description |
|---|---|
| `HTTP_PROXY` / `HTTPS_PROXY` | Outbound proxy for the gateway. **Required** if your host resolves `www.codebuddy.ai` through a proxy or a fake-IP DNS range, otherwise the gateway hangs on connect. |
| `NO_PROXY` | Hosts to bypass the proxy (keep `localhost,127.0.0.1,::1`). |

If you have direct connectivity, leave the proxy lines commented out.

## Claude Code: `~/.claude/settings.json`

`install.sh` backs this file up and rewrites it (via `router/configure-settings.mjs`)
so that plain `claude` routes through the router. Your unrelated keys (e.g.
permissions) are preserved.

- `env` — points Claude Code at the router; every model slot defaults to
  `deepseek-v4.1-flash`: `ANTHROPIC_MODEL`, the three `ANTHROPIC_DEFAULT_*_MODEL`
  slots, and `CLAUDE_CODE_SUBAGENT_MODEL`.
- `modelPicker.options` — **generated**; do not edit by hand. Regenerate with
  `systemctl --user start codebuddy-picker.service`.

To switch a model, use `/model` in a session, or edit `env` directly.

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
