import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveLabel, behavesFor, row, buildOptions } from '../router/lib/picker.mjs';

test('deriveLabel: keeps version numbers intact (no split on ".")', () => {
  assert.equal(deriveLabel('MiniMax-M3.1-Flash-Preview'), 'MiniMax M3.1 Flash Preview');
  assert.equal(deriveLabel('gpt-5.6-sol'), 'Gpt 5.6 Sol');
  assert.equal(deriveLabel('deepseek-v4.1-flash'), 'Deepseek V4.1 Flash');
});

test('behavesFor: strong families map to the opus profile', () => {
  assert.equal(behavesFor('gpt-6-luna'), 'claude-opus-4-8');
  assert.equal(behavesFor('gpt-5.6-sol'), 'claude-opus-4-8');
  assert.equal(behavesFor('glm-5.3'), 'claude-sonnet-4-6');
});

test('row: curated label wins, otherwise derived', () => {
  assert.deepEqual(row('gpt-6-luna'), {
    model: 'gpt-6-luna', label: 'GPT-6 Luna', behavesAs: 'claude-opus-4-8',
  });
  const r = row('unknown-model-x');
  assert.equal(r.label, 'Unknown Model X');
  assert.equal(r.behavesAs, 'claude-sonnet-4-6');
});

test('row: carries a curated description when present', () => {
  assert.equal(row('deepseek-v4.1-flash').description, 'CodeBuddy · 默认');
});

test('buildOptions: curated ids first, the rest appended alphabetically', () => {
  const opts = buildOptions(['zzz-model', 'glm-5.3', 'aaa-model']);
  assert.deepEqual(opts.map((o) => o.model), ['glm-5.3', 'aaa-model', 'zzz-model']);
});
