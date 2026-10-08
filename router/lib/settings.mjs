/**
 * Configuration loading for the router.
 *
 * Two sources feed the router: its own environment variables
 * (`~/.config/codebuddy-router.env`) and the user's existing Claude Code
 * settings, whose provider is reused as the "fallback". The pure helpers here
 * are unit-tested; the file read is a thin wrapper around them.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Strip trailing slashes from a base URL.
 * @param {string} url  Raw URL.
 * @returns {string} URL without a trailing slash.
 */
export function normalizeBase(url) {
  return String(url).replace(/\/+$/, '');
}

/**
 * Parse the router's environment into a plain config object.
 * @param {Record<string, string|undefined>} [env]  Environment (defaults to `process.env`).
 * @returns {{
 *   port: number,
 *   codebuddyBase: string,
 *   fallbackBase: string,
 *   fallbackToken: string,
 *   fallbackModels: string[],
 *   settingsPath: string
 * }} Router configuration.
 */
export function parseEnv(env = process.env) {
  return {
    port: parseInt(env.ROUTER_PORT || '8788', 10),
    codebuddyBase: normalizeBase(env.CODEBUDDY_URL || 'http://127.0.0.1:8787'),
    fallbackBase: normalizeBase(env.FALLBACK_BASE || 'https://api.anthropic.com'),
    fallbackToken: env.FALLBACK_TOKEN || '',
    fallbackModels: (env.FALLBACK_MODELS || '').split(',').map((s) => s.trim()).filter(Boolean),
    settingsPath: env.CLAUDE_SETTINGS || path.join(os.homedir(), '.claude', 'settings.json'),
  };
}

/**
 * Pull the fallback provider's base URL and token out of a parsed Claude Code
 * settings object. Pure: takes an already-parsed object, returns `{}` if absent.
 * @param {{env?: Record<string, string>}} settings  Parsed settings object.
 * @returns {{base?: string, token?: string}} Extracted fallback fields (possibly empty).
 */
export function extractFallback(settings) {
  const env = (settings && settings.env) || {};
  /** @type {{base?: string, token?: string}} */
  const out = {};
  if (env.ANTHROPIC_BASE_URL) out.base = normalizeBase(env.ANTHROPIC_BASE_URL);
  if (env.ANTHROPIC_AUTH_TOKEN) out.token = env.ANTHROPIC_AUTH_TOKEN;
  return out;
}

/**
 * Read and parse a Claude Code settings file, then extract the fallback fields.
 * Throws if the file is missing or malformed; callers decide how to react.
 * @param {string} settingsPath  Path to `settings.json`.
 * @returns {{base?: string, token?: string}} Extracted fallback fields.
 */
export function readFallback(settingsPath) {
  return extractFallback(JSON.parse(fs.readFileSync(settingsPath, 'utf8')));
}
