#!/usr/bin/env bash
# install.sh — set up the CodeBuddy-in-Claude-Code model router.
#
# Idempotent: safe to re-run. Existing env files are kept, and Claude Code's
# settings.json is backed up before being rewritten to point at the router.
#
#   ./install.sh                     # install (bootstraps the gateway too)
#   ./install.sh --skip-gateway      # don't clone/build codebuddy2api
#   ./install.sh --gateway-dir=/path # use a specific gateway checkout
#   ./install.sh --uninstall         # remove services + symlink (keeps config)
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATEWAY_DIR="${GATEWAY_DIR:-$HOME/codebuddy2api}"
GATEWAY_REPO="${GATEWAY_REPO:-https://github.com/isyntop/codebuddy2api.git}"
SKIP_GATEWAY=0
UNINSTALL=0

UNIT_DIR="$HOME/.config/systemd/user"
BIN_DIR="$HOME/.local/bin"
CONF_DIR="$HOME/.config"
CLAUDE_DIR="$HOME/.claude"
CLAUDE_SETTINGS="$CLAUDE_DIR/settings.json"

for arg in "$@"; do
  case "$arg" in
    --gateway-dir=*) GATEWAY_DIR="${arg#*=}" ;;
    --skip-gateway)  SKIP_GATEWAY=1 ;;
    --uninstall)     UNINSTALL=1 ;;
    -h|--help)
      sed -n '2,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

find_go() {
  command -v go 2>/dev/null && return 0
  for c in "$HOME/.local/share/go/bin/go" "$HOME/go/bin/go" /usr/local/go/bin/go; do
    [ -x "$c" ] && { echo "$c"; return 0; }
  done
  return 1
}

# --- uninstall ----------------------------------------------------------------
if [ "$UNINSTALL" = 1 ]; then
  log "Stopping and disabling services"
  systemctl --user disable --now \
    codebuddy-router.service codebuddy2api.service codebuddy-picker.timer 2>/dev/null || true
  rm -f "$UNIT_DIR/codebuddy-router.service" \
        "$UNIT_DIR/codebuddy2api.service" \
        "$UNIT_DIR/codebuddy-picker.service" \
        "$UNIT_DIR/codebuddy-picker.timer"
  rm -f "$BIN_DIR/claude-cb"
  systemctl --user daemon-reload 2>/dev/null || true
  log "Uninstalled. Your env files and $CLAUDE_SETTINGS were left in place."
  exit 0
fi

# --- prerequisites ------------------------------------------------------------
NODE_BIN="$(command -v node || true)"
[ -n "$NODE_BIN" ] || die "node is required (>= 18). Install Node.js and re-run."
command -v systemctl >/dev/null || die "systemctl is required (systemd --user)."

if ! command -v claude >/dev/null; then
  warn "Claude Code ('claude') not found on PATH — install it before using claude-cb."
fi

# --- gateway (codebuddy2api) --------------------------------------------------
if [ "$SKIP_GATEWAY" = 0 ]; then
  if [ ! -x "$GATEWAY_DIR/codebuddy2api" ]; then
    GO_BIN="$(find_go || true)"
    [ -n "$GO_BIN" ] || die "Go (>= 1.25) is required to build the gateway. Install Go or pass --skip-gateway."
    command -v git >/dev/null || die "git is required to clone the gateway. Install git or pass --skip-gateway."
    if [ ! -d "$GATEWAY_DIR/.git" ]; then
      log "Cloning gateway into $GATEWAY_DIR"
      git clone --depth 1 "$GATEWAY_REPO" "$GATEWAY_DIR"
    fi
    log "Building gateway (go build)"
    ( cd "$GATEWAY_DIR" && "$GO_BIN" build -o codebuddy2api ./cmd/server )
  fi
  if [ -f "$GATEWAY_DIR/config.json.example" ] && [ ! -f "$GATEWAY_DIR/config.json" ]; then
    cp "$GATEWAY_DIR/config.json.example" "$GATEWAY_DIR/config.json"
    warn "Created $GATEWAY_DIR/config.json — put your CodeBuddy api_key in it."
  fi
else
  log "Skipping gateway bootstrap (--skip-gateway)"
fi

# --- install launcher ---------------------------------------------------------
mkdir -p "$BIN_DIR" "$UNIT_DIR" "$CONF_DIR" "$CLAUDE_DIR"
install -m 0755 "$REPO/bin/claude-cb" "$BIN_DIR/claude-cb"
log "Installed launcher: $BIN_DIR/claude-cb"

# --- install systemd units (substitute paths) ---------------------------------
for u in codebuddy2api.service codebuddy-router.service codebuddy-picker.service codebuddy-picker.timer; do
  sed -e "s|@REPO@|$REPO|g" \
      -e "s|@GATEWAY_DIR@|$GATEWAY_DIR|g" \
      -e "s|@NODE@|$NODE_BIN|g" \
      "$REPO/systemd/$u" > "$UNIT_DIR/$u"
done
log "Installed systemd units into $UNIT_DIR"

# --- seed config (never overwrite) --------------------------------------------
seed() { # seed <example> <dest>
  if [ ! -f "$2" ]; then cp "$1" "$2"; log "Created $2"; else log "Kept existing $2"; fi
}
seed "$REPO/config/codebuddy-router.env.example" "$CONF_DIR/codebuddy-router.env"
seed "$REPO/config/codebuddy2api.env.example"   "$CONF_DIR/codebuddy2api.env"

# --- wire Claude Code to the router (plain `claude` included) -----------------
log "Wiring Claude Code to the router"
"$NODE_BIN" "$REPO/router/configure-settings.mjs"

# --- activate -----------------------------------------------------------------
systemctl --user daemon-reload
log "Enabling services"
systemctl --user enable --now codebuddy2api.service codebuddy-router.service
systemctl --user enable --now codebuddy-picker.timer
systemctl --user start codebuddy-picker.service 2>/dev/null || true

# Best-effort: keep user services running after logout / at boot.
if ! loginctl show-user "$USER" 2>/dev/null | grep -q 'Linger=yes'; then
  loginctl enable-linger "$USER" 2>/dev/null \
    || warn "Could not enable linger (needs privileges). Run: sudo loginctl enable-linger $USER"
fi

echo
log "Done. Next steps:"
echo "  1. Set the CodeBuddy api_key in $GATEWAY_DIR/config.json, then:"
echo "       systemctl --user restart codebuddy2api.service"
echo "  2. Verify:  claude-cb doctor"
echo "  3. Launch:  claude     (then use /model to switch models)"
