import test from 'node:test';
import assert from 'node:assert/strict';

import { isCodeBuddy, filterCatalog } from '../router/lib/models.mjs';

test('isCodeBuddy: false for empty / missing model', () => {
  assert.equal(isCodeBuddy(''), false);
  assert.equal(isCodeBuddy(undefined), false);
});

test('isCodeBuddy: matches known CodeBuddy prefixes', () => {
  const ids = [
    'deepseek-v4.1-flash', 'glm-5.3', 'kimi-k3', 'gpt-6-luna',
    'gemini-3.5-flash', 'minimax-m3', 'default-model', 'fast-model',
  ];
  for (const id of ids) assert.equal(isCodeBuddy(id), true, id);
});

test('isCodeBuddy: non-CodeBuddy ids fall through to fallback', () => {
  for (const id of ['MiniMax-M3', 'claude-sonnet-4-6', 'foo']) {
    assert.equal(isCodeBuddy(id), false, id);
  }
});

test('isCodeBuddy: catalog membership wins even without a prefix match', () => {
  assert.equal(isCodeBuddy('some-exotic-id', new Set(['some-exotic-id'])), true);
});

test('isCodeBuddy: classification is case-sensitive', () => {
  assert.equal(isCodeBuddy('minimax-m3'), true);
  assert.equal(isCodeBuddy('MiniMax-M3'), false);
});

test('filterCatalog: drops empty and denied ids, preserves order', () => {
  assert.deepEqual(filterCatalog(['deep-model', 'glm-5.3', '', 'kimi-k3']), ['glm-5.3', 'kimi-k3']);
});
