#!/usr/bin/env node
// Anthropic-API router for Claude Code.
//
// One endpoint, two providers: requests whose model belongs to CodeBuddy are
// forwarded to the local codebuddy2api gateway; everything else is forwarded to
// the "fallback" provider — whatever the user's normal Claude Code config
// (~/.claude/settings.json) already points at. This lets a single Claude Code
// session list and switch between both model families.
//
// Config (env, see ~/.config/codebuddy-router.env):
//   ROUTER_PORT      listen port                (default 8788)
//   CODEBUDDY_URL    codebuddy2api base         (default http://127.0.0.1:8787)
//   FALLBACK_BASE    override fallback base     (default: settings.json ANTHROPIC_BASE_URL)
//   FALLBACK_TOKEN   override fallback token    (default: settings.json ANTHROPIC_AUTH_TOKEN)
//   FALLBACK_MODELS  comma list for the picker  (default: none)
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';

import { isCodeBuddy } from './lib/models.mjs';
import { parseEnv, readFallback } from './lib/settings.mjs';

const cfg = parseEnv();

// Fallback provider = the user's existing Claude Code config, kept in sync:
// re-read whenever ~/.claude/settings.json changes, so no restart is needed.
let fallbackBase = cfg.fallbackBase;
let fallbackToken = cfg.fallbackToken;
function loadFallback() {
  try {
    const f = readFallback(cfg.settingsPath);
    if (!process.env.FALLBACK_BASE && f.base) fallbackBase = f.base;
    if (!process.env.FALLBACK_TOKEN && f.token) fallbackToken = f.token;
  } catch (e) {
    console.error('[router] could not read fallback config:', e.message);
  }
}
loadFallback();
try { fs.watchFile(cfg.settingsPath, { interval: 5000 }, loadFallback); } catch { /* best effort */ }

// --- CodeBuddy model catalog -------------------------------------------------
let cbModels = new Set();
async function refreshCbModels() {
  try {
    const r = await fetch(cfg.codebuddyBase + '/v1/models', { signal: AbortSignal.timeout(3000) });
    const j = await r.json();
    cbModels = new Set((j.data || []).map((m) => m.id));
  } catch { /* keep previous set */ }
}
await refreshCbModels();
setInterval(refreshCbModels, 60_000).unref();

// --- generic streaming proxy -------------------------------------------------
function proxy(req, res, base, body, bearer) {
  let u;
  try { u = new URL(base); } catch (e) { return fail(res, 502, 'bad upstream base: ' + e.message); }
  const isHttps = u.protocol === 'https:';
  const mod = isHttps ? https : http;
  const headers = { ...req.headers };
  delete headers.host;
  delete headers.connection;
  delete headers['content-length'];
  delete headers['transfer-encoding'];
  if (bearer) { delete headers['x-api-key']; headers.authorization = bearer; }

  const target = u.pathname.replace(/\/+$/, '') + req.url;
  const opts = {
    protocol: u.protocol,
    hostname: u.hostname,
    port: u.port || (isHttps ? 443 : 80),
    path: target,
    method: req.method,
    headers: { ...headers, 'content-length': Buffer.byteLength(body) },
  };

  const pr = mod.request(opts, (pres) => {
    res.writeHead(pres.statusCode, pres.headers);
    pres.pipe(res);
  });
  pr.on('error', (e) => fail(res, 502, 'upstream error: ' + e.message));
  pr.end(body);
}

function fail(res, code, msg) {
  if (res.headersSent) return res.end();
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ type: 'error', error: { type: 'router_error', message: msg } }));
}

// --- server ------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    let cb = false;
    try { cb = (await fetch(cfg.codebuddyBase + '/health', { signal: AbortSignal.timeout(2000) })).ok; } catch {}
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, codebuddy: cb, fallback: fallbackBase, fallback_models: cfg.fallbackModels }));
  }

  if (req.method === 'GET' && (req.url === '/v1/models' || req.url === '/models')) {
    await refreshCbModels();
    const data = [...cbModels, ...cfg.fallbackModels].map((id) => ({ id, object: 'model' }));
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ object: 'list', data }));
  }

  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);

  let model = '';
  try { model = JSON.parse(body.toString('utf8')).model || ''; } catch { /* non-JSON body */ }

  const useCb = isCodeBuddy(model, cbModels);
  const base = useCb ? cfg.codebuddyBase : fallbackBase;
  const bearer = useCb ? null : (fallbackToken ? 'Bearer ' + fallbackToken : null);
  console.log(`[router] ${req.method} ${req.url} model=${model || '-'} -> ${useCb ? 'codebuddy' : 'fallback'}`);
  proxy(req, res, base, body, bearer);
});

server.listen(cfg.port, '127.0.0.1', () => {
  console.log(`[router] listening on 127.0.0.1:${cfg.port} | codebuddy=${cfg.codebuddyBase} fallback=${fallbackBase}`);
});
