# Troubleshooting

## First stop: `claude-cb doctor`

```bash
claude-cb doctor
```

It prints the router unit state, the gateway unit state, the router `/health` JSON,
and a real one-token upstream probe. If the probe is not `OK (HTTP 200)`, the problem is
almost always upstream (gateway or network), not Claude Code.

## Where the logs are

```bash
journalctl --user -u codebuddy-router -n 50    # the router
journalctl --user -u codebuddy2api   -n 50     # the gateway
systemctl --user status codebuddy-router.service
```

## Gateway hangs / cannot reach the upstream

**Symptom:** requests take 60–90 s and return 502; `claude-cb doctor` shows the probe
failing.

**Cause:** the gateway cannot reach `https://www.codebuddy.ai` — typically because the
host resolves it to a fake-IP that is only routable through a local proxy, but the proxy
is not set for the gateway.

**Fix:** set the proxy in `~/.config/codebuddy2api.env` and restart:

```env
HTTP_PROXY=http://127.0.0.1:<your-proxy-port>
HTTPS_PROXY=http://127.0.0.1:<your-proxy-port>
NO_PROXY=localhost,127.0.0.1,::1
```

```bash
systemctl --user restart codebuddy2api.service
```

## `/model` list is empty or missing models

1. Regenerate it manually:
   ```bash
   systemctl --user start codebuddy-picker.service
   ```
2. If it stays stale, the router's `/v1/models` is probably empty — check
   `curl -s http://127.0.0.1:8788/v1/models | head`.
3. Fallback models only appear if `FALLBACK_MODELS` is set (in the env file) or if the
   gateway advertises them. See [CONFIGURATION.md](CONFIGURATION.md).

## A specific model errors out

Some ids the upstream advertises are broken. Add the id to the `DENY` set in
`router/lib/models.mjs` to keep it out of the picker, then regenerate the picker.

## The service will not start

- **Port already in use:** `ss -ltnp | grep 8788` — change `ROUTER_PORT` if needed.
- **Latched `failed` state:** `systemctl --user reset-failed codebuddy-router.service`.
- **Node not found:** the unit uses an absolute `node` path resolved at install time;
  re-run `./install.sh` after changing your Node install.

## Does this affect my normal `claude`?

No. The proxy settings are passed only via `--settings` for the `claude-cb` session.
Plain `claude` keeps using `~/.claude/settings.json` unchanged.

## Uninstall

```bash
./install.sh --uninstall
```

This stops and removes the services and the `claude-cb` launcher. Your env files and
`~/.claude/codebuddy-proxy.settings.json` are left in place.
