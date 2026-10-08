#!/usr/bin/env node
// Wire Claude Code to the router.
//
// Makes plain `claude` route through codebuddy-router:
//   1. read the user's existing ~/.claude/settings.json and capture its provider
//      (base URL + token) as the router's *fallback*;
//   2. write that fallback into ~/.config/codebuddy-router.env;
//   3. rewrite ~/.claude/settings.json to point at the router (preserving the
//      user's unrelated keys), with every model slot defaulting to deepseek.
//
// Idempotent and safe: backs up settings.json, and never overwrites values that
// are already present in the router env file.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { extractFallback, buildRouterSettings, ROUTER_ENV_DEFAULTS } from './lib/settings.mjs';

const SETTINGS = process.env.CLAUDE_SETTINGS || path.join(os.homedir(), '.claude', 'settings.json');
const ROUTER_ENV = process.env.ROUTER_ENV_FILE || path.join(os.homedir(), '.config', 'codebuddy-router.env');

/** Read + parse JSON, or undefined if missing/invalid. */
function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return undefined; }
}

/** Parse a simple KEY=VALUE env file into an object. */
function parseEnvFile(p) {
  const out = {};
  try {
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m) out[m[1]] = m[2];
    }
  } catch { /* missing file is fine */ }
  return out;
}

/** True if a base URL points back at the router itself. */
const isRouterBase = (base) => !!base && base.includes('127.0.0.1:8788');

function main() {
  const existing = readJson(SETTINGS) || {};

  // Capture the user's current provider as the fallback -- but only if it is not
  // already the router (that would create a self-reference loop).
  const prev = extractFallback(existing);
  const keep = !isRouterBase(prev.base);

  // Merge into the router env file, preserving anything already configured.
  const e = parseEnvFile(ROUTER_ENV);
  e.ROUTER_PORT = e.ROUTER_PORT || '8788';
  e.CODEBUDDY_URL = e.CODEBUDDY_URL || 'http://127.0.0.1:8787';
  if (keep && prev.base && !e.FALLBACK_BASE) e.FALLBACK_BASE = prev.base;
  if (keep && prev.token && !e.FALLBACK_TOKEN) e.FALLBACK_TOKEN = prev.token;

  const lines = [
    '# Environment for the Anthropic model router (systemd --user).',
    `ROUTER_PORT=${e.ROUTER_PORT}`,
    `CODEBUDDY_URL=${e.CODEBUDDY_URL}`,
    '',
    '# Fallback provider (non-CodeBuddy models). Kept explicit because',
    '# ~/.claude/settings.json points at the router itself.',
  ];
  if (e.FALLBACK_BASE) lines.push(`FALLBACK_BASE=${e.FALLBACK_BASE}`);
  if (e.FALLBACK_TOKEN) lines.push(`FALLBACK_TOKEN=${e.FALLBACK_TOKEN}`);
  if (e.FALLBACK_MODELS) lines.push(`FALLBACK_MODELS=${e.FALLBACK_MODELS}`);
  fs.mkdirSync(path.dirname(ROUTER_ENV), { recursive: true });
  fs.writeFileSync(ROUTER_ENV, lines.join('\n') + '\n');
  fs.chmodSync(ROUTER_ENV, 0o600);
  console.log('[configure] wrote', ROUTER_ENV);

  // Rewrite settings.json to point at the router.
  if (fs.existsSync(SETTINGS)) {
    const bak = `${SETTINGS}.bak-${Date.now()}`;
    fs.copyFileSync(SETTINGS, bak);
    console.log('[configure] backup', bak);
  }
  const env = { ...ROUTER_ENV_DEFAULTS, ANTHROPIC_BASE_URL: `http://127.0.0.1:${e.ROUTER_PORT}` };
  fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
  fs.writeFileSync(SETTINGS, JSON.stringify(buildRouterSettings(existing, env), null, 2) + '\n');
  console.log('[configure] wrote', SETTINGS);
}

main();
