import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeBase, parseEnv, extractFallback } from '../router/lib/settings.mjs';

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
