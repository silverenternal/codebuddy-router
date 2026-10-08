import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeBase, parseEnv, extractFallback, buildRouterSettings, ROUTER_ENV_DEFAULTS } from '../router/lib/settings.mjs';

test('normalizeBase: strips trailing slashes', () => {
  assert.equal(normalizeBase('https://x/y///'), 'https://x/y');
});

test('parseEnv: sane defaults', () => {
  const c = parseEnv({});
  assert.equal(c.port, 8788);
  assert.equal(c.codebuddyBase, 'http://127.0.0.1:8787');
  assert.equal(c.fallbackBase, 'https://api.anthropic.com');
  assert.equal(c.fallbackToken, '');
  assert.deepEqual(c.fallbackModels, []);
  assert.match(c.settingsPath, /\.claude[/\\]settings\.json$/);
});

test('parseEnv: overrides and model-list parsing', () => {
  const c = parseEnv({
    ROUTER_PORT: '9000',
    CODEBUDDY_URL: 'http://h:1/',
    FALLBACK_BASE: 'https://p/a/',
    FALLBACK_TOKEN: 'tok',
    FALLBACK_MODELS: ' a , b ,, c ',
  });
  assert.equal(c.port, 9000);
  assert.equal(c.codebuddyBase, 'http://h:1');
  assert.equal(c.fallbackBase, 'https://p/a');
  assert.equal(c.fallbackToken, 'tok');
  assert.deepEqual(c.fallbackModels, ['a', 'b', 'c']);
});

test('extractFallback: pulls base + token from settings env', () => {
  const f = extractFallback({
    env: { ANTHROPIC_BASE_URL: 'https://api.example.com/anthropic/', ANTHROPIC_AUTH_TOKEN: 'sk-x' },
  });
  assert.deepEqual(f, { base: 'https://api.example.com/anthropic', token: 'sk-x' });
});

test('extractFallback: missing env -> empty object', () => {
  assert.deepEqual(extractFallback({}), {});
  assert.deepEqual(extractFallback({ env: {} }), {});
});

test('ROUTER_ENV_DEFAULTS: every model slot defaults to deepseek', () => {
  const slots = [
    'ANTHROPIC_MODEL',
    'ANTHROPIC_DEFAULT_SONNET_MODEL',
    'ANTHROPIC_DEFAULT_OPUS_MODEL',
    'ANTHROPIC_DEFAULT_HAIKU_MODEL',
    'CLAUDE_CODE_SUBAGENT_MODEL',
  ];
  for (const k of slots) assert.equal(ROUTER_ENV_DEFAULTS[k], 'deepseek-v4.1-flash', k);
  assert.equal(ROUTER_ENV_DEFAULTS.ANTHROPIC_BASE_URL, 'http://127.0.0.1:8788');
});

test('buildRouterSettings: preserves unrelated keys, sets env + empty picker', () => {
  const out = buildRouterSettings({ skipDangerousModePermissionPrompt: true, env: { OLD: 'x' } });
  assert.equal(out.skipDangerousModePermissionPrompt, true);
  assert.deepEqual(out.env, ROUTER_ENV_DEFAULTS);
  assert.deepEqual(out.modelPicker, { options: [] });
});

test('buildRouterSettings: keeps an existing modelPicker', () => {
  const out = buildRouterSettings({ modelPicker: { options: [{ model: 'x' }] } });
  assert.deepEqual(out.modelPicker.options, [{ model: 'x' }]);
});
