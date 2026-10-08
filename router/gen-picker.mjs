#!/usr/bin/env node
// Keep the Claude Code /model picker in sync with the live model catalog.
//
// The picker in ~/.claude/codebuddy-proxy.settings.json is otherwise a frozen
// snapshot: when CodeBuddy adds/removes models, it goes stale. This script
// pulls the merged catalog from the router (/v1/models) and rewrites ONLY the
// `modelPicker` block, preserving `env`. It is run by codebuddy-picker.timer.
//
// Safe by construction: if the router is unreachable or returns nothing, the
// existing picker is left untouched.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROUTER = (process.env.ROUTER_URL || 'http://127.0.0.1:8788').replace(/\/+$/, '');
const SETTINGS = process.env.PROXY_SETTINGS || path.join(os.homedir(), '.claude', 'codebuddy-proxy.settings.json');

// Curated presentation for known models; anything new is derived automatically.
const CURATED = {
  'deepseek-v4.1-flash': { label: 'DeepSeek V4.1 Flash', description: 'CodeBuddy · 默认', behavesAs: 'claude-sonnet-4-6' },
  'deepseek-v4.1-flash-sg': { label: 'DeepSeek V4.1 Flash (SG)', behavesAs: 'claude-sonnet-4-6' },
  'glm-5.3': { label: 'GLM 5.3', behavesAs: 'claude-sonnet-4-6' },
  'glm-5.2': { label: 'GLM 5.2', behavesAs: 'claude-sonnet-4-6' },
  'kimi-k3': { label: 'Kimi K3', behavesAs: 'claude-sonnet-4-6' },
  'kimi-k2.6': { label: 'Kimi K2.6', behavesAs: 'claude-sonnet-4-6' },
  'gpt-6-luna': { label: 'GPT-6 Luna', behavesAs: 'claude-opus-4-8' },
  'gpt-6-sol': { label: 'GPT-6 Sol', behavesAs: 'claude-opus-4-8' },
  'gpt-6-astra': { label: 'GPT-6 Astra', behavesAs: 'claude-opus-4-8' },
  'gpt-5.6-sol': { label: 'GPT-5.6 Sol', behavesAs: 'claude-sonnet-4-6' },
  'gpt-5.6-terra': { label: 'GPT-5.6 Terra', behavesAs: 'claude-sonnet-4-6' },
  'gpt-5.6-luna': { label: 'GPT-5.6 Luna', behavesAs: 'claude-sonnet-4-6' },
  'gpt-5.5': { label: 'GPT-5.5', behavesAs: 'claude-sonnet-4-6' },
  'gpt-5.4': { label: 'GPT-5.4', behavesAs: 'claude-sonnet-4-6' },
  'gpt-5.3-codex': { label: 'GPT-5.3 Codex', behavesAs: 'claude-sonnet-4-6' },
  'gemini-3.5-flash': { label: 'Gemini 3.5 Flash', behavesAs: 'claude-sonnet-4-6' },
  'minimax-m3': { label: 'MiniMax M3 (CodeBuddy)', behavesAs: 'claude-sonnet-4-6' },
  'default-model': { label: 'CodeBuddy Default', behavesAs: 'claude-sonnet-4-6' },
  'fast-model': { label: 'CodeBuddy Fast', behavesAs: 'claude-sonnet-4-6' },
  'balanced-model': { label: 'CodeBuddy Balanced', behavesAs: 'claude-sonnet-4-6' },
  'primary-model': { label: 'CodeBuddy Primary', behavesAs: 'claude-sonnet-4-6' },
};

// Models the upstream advertises but which error out — keep them out of the picker.
const DENY = new Set(['deep-model']);

// Preferred ordering; anything unlisted is appended (CodeBuddy first, then fallback).
const ORDER = Object.keys(CURATED);

function deriveLabel(id) {
  return id
    .split(/[-_]/)
    .map((p) => (/^\d/.test(p) || /^[A-Z]/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}
function behavesFor(id) {
  return /gpt-6|opus|gpt-5\.6-(sol|terra)/i.test(id) ? 'claude-opus-4-8' : 'claude-sonnet-4-6';
}
function row(id) {
  const c = CURATED[id] || {};
  const r = { model: id, label: c.label || deriveLabel(id) };
  if (c.description) r.description = c.description;
  r.behavesAs = c.behavesAs || behavesFor(id);
  return r;
}

async function fetchModels() {
  const res = await fetch(ROUTER + '/v1/models', { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const ids = ((await res.json()).data || []).map((m) => m.id).filter((id) => id && !DENY.has(id));
  if (!ids.length) throw new Error('empty catalog');
  return ids;
}

function buildOptions(ids) {
  const rank = (id) => { const i = ORDER.indexOf(id); return i === -1 ? ORDER.length : i; };
  return [...ids].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).map(row);
}

async function main() {
  let ids;
  try { ids = await fetchModels(); }
  catch (e) { console.error('[picker] catalog unavailable, leaving picker unchanged:', e.message); process.exit(0); }

  let settings;
  try { settings = JSON.parse(fs.readFileSync(SETTINGS, 'utf8')); }
  catch (e) { console.error('[picker] cannot read settings:', e.message); process.exit(1); }

  const options = buildOptions(ids);
  if (JSON.stringify(settings.modelPicker?.options) === JSON.stringify(options)) {
    console.log('[picker] up to date (' + options.length + ' models)');
    return;
  }
  settings.modelPicker = { ...(settings.modelPicker || {}), options };

  const tmp = SETTINGS + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(settings, null, 2) + '\n');
  fs.renameSync(tmp, SETTINGS);
  console.log('[picker] updated: ' + options.length + ' models');
}

main();
