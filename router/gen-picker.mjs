#!/usr/bin/env node
// Keep the Claude Code /model picker in sync with the live model catalog.
//
// The picker in ~/.claude/settings.json is otherwise a frozen snapshot: when
// CodeBuddy adds/removes models, it goes stale. This script pulls the merged
// catalog from the router (/v1/models) and rewrites ONLY the `modelPicker`
// block, preserving every other key. It is run by codebuddy-picker.timer.
//
// Safe by construction: if the router is unreachable or returns nothing, the
// existing picker is left untouched.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { filterCatalog } from './lib/models.mjs';
import { buildOptions } from './lib/picker.mjs';

const ROUTER = (process.env.ROUTER_URL || 'http://127.0.0.1:8788').replace(/\/+$/, '');
const SETTINGS = process.env.CLAUDE_SETTINGS || path.join(os.homedir(), '.claude', 'settings.json');

/** Fetch the merged model catalog from the router. Throws on failure. */
async function fetchModels() {
  const res = await fetch(ROUTER + '/v1/models', { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const ids = filterCatalog(((await res.json()).data || []).map((m) => m.id));
  if (!ids.length) throw new Error('empty catalog');
  return ids;
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
