import test from 'node:test';
import assert from 'node:assert/strict';

import { isCodeBuddy, filterCatalog, normalizeModel } from '../router/lib/models.mjs';

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

test('normalizeModel: rewrites legacy ids to current CodeBuddy ids', () => {
  assert.equal(normalizeModel('deepseek-flash'), 'deepseek-v4.1-flash');
  assert.equal(normalizeModel('MiniMax-M3'), 'minimax-m3');
  assert.equal(normalizeModel('MiniMax-M3.1-Flash-Preview'), 'minimax-m3');
});

test('normalizeModel: strips a trailing context-size suffix before aliasing', () => {
  assert.equal(normalizeModel('MiniMax-M3[1m]'), 'minimax-m3');
  assert.equal(normalizeModel('MiniMax-M3.1-Flash-Preview[1m]'), 'minimax-m3');
});

test('normalizeModel: strips the suffix even without an alias', () => {
  assert.equal(normalizeModel('deepseek-v4.1-flash[1m]'), 'deepseek-v4.1-flash');
});

test('normalizeModel: leaves current and unknown ids untouched', () => {
  assert.equal(normalizeModel('deepseek-v4.1-flash'), 'deepseek-v4.1-flash');
  assert.equal(normalizeModel('minimax-m3'), 'minimax-m3');
  assert.equal(normalizeModel('some-exotic-id'), 'some-exotic-id');
  assert.equal(normalizeModel(''), '');
  assert.equal(normalizeModel(undefined), undefined);
});

test('normalizeModel output for aliased ids classifies as CodeBuddy', () => {
  for (const id of ['deepseek-flash', 'MiniMax-M3', 'MiniMax-M3[1m]', 'MiniMax-M3.1-Flash-Preview']) {
    assert.equal(isCodeBuddy(normalizeModel(id)), true, id);
  }
});
