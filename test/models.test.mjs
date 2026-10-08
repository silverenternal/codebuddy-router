import test from 'node:test';
import assert from 'node:assert/strict';

import { isCodeBuddy, filterCatalog, normalizeModel, stripUnsupportedBlocks, extractModelIds } from '../router/lib/models.mjs';

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

test('extractModelIds: reads Anthropic/OpenAI {data:[{id}]} shapes', () => {
  assert.deepEqual(
    extractModelIds({ data: [{ id: 'MiniMax-M3' }, { id: 'MiniMax-M2.7' }] }),
    ['MiniMax-M3', 'MiniMax-M2.7'],
  );
  assert.deepEqual(extractModelIds({ data: [{ id: 'a' }, { id: '' }, {}, null] }), ['a']);
});

test('extractModelIds: tolerates unexpected bodies', () => {
  assert.deepEqual(extractModelIds(null), []);
  assert.deepEqual(extractModelIds({}), []);
  assert.deepEqual(extractModelIds({ data: 'nope' }), []);
});

test('normalizeModel: rewrites retired CodeBuddy ids to current ones', () => {
  assert.equal(normalizeModel('deepseek-flash'), 'deepseek-v4.1-flash');
});

test('normalizeModel: strips a trailing context-size suffix', () => {
  assert.equal(normalizeModel('deepseek-v4.1-flash[1m]'), 'deepseek-v4.1-flash');
  assert.equal(normalizeModel('MiniMax-M3[1m]'), 'MiniMax-M3');
});

test('normalizeModel: leaves current and unknown ids untouched', () => {
  assert.equal(normalizeModel('deepseek-v4.1-flash'), 'deepseek-v4.1-flash');
  assert.equal(normalizeModel('minimax-m3'), 'minimax-m3');
  assert.equal(normalizeModel('some-exotic-id'), 'some-exotic-id');
  assert.equal(normalizeModel(''), '');
  assert.equal(normalizeModel(undefined), undefined);
});

test('normalizeModel: fallback-provider ids are never rewritten to CodeBuddy', () => {
  for (const id of ['MiniMax-M3', 'MiniMax-M3.1-Flash-Preview', 'MiniMax-M2.7-highspeed']) {
    assert.equal(normalizeModel(id), id, id);
    assert.equal(isCodeBuddy(normalizeModel(id)), false, id);
  }
});

test('normalizeModel: retired ids classify as CodeBuddy', () => {
  assert.equal(isCodeBuddy(normalizeModel('deepseek-flash')), true);
});

test('stripUnsupportedBlocks: removes thinking / redacted_thinking from assistant turns', () => {
  const body = {
    messages: [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: [
        { type: 'thinking', thinking: '...', signature: 'sig' },
        { type: 'redacted_thinking', data: 'x' },
        { type: 'text', text: 'Hello' },
      ] },
      { role: 'user', content: 'ok' },
    ],
  };
  assert.equal(stripUnsupportedBlocks(body), true);
  assert.deepEqual(body.messages[1].content, [{ type: 'text', text: 'Hello' }]);
});

test('stripUnsupportedBlocks: drops an assistant message left with no blocks', () => {
  const body = {
    messages: [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: [{ type: 'thinking', thinking: '...', signature: 'sig' }] },
      { role: 'user', content: 'ok' },
    ],
  };
  assert.equal(stripUnsupportedBlocks(body), true);
  assert.deepEqual(body.messages.map((m) => m.role), ['user', 'user']);
});

test('stripUnsupportedBlocks: keeps tool_use alongside a stripped thinking block', () => {
  const body = {
    messages: [
      { role: 'assistant', content: [
        { type: 'thinking', thinking: '...', signature: 'sig' },
        { type: 'tool_use', id: 't1', name: 'Bash', input: {} },
      ] },
    ],
  };
  assert.equal(stripUnsupportedBlocks(body), true);
  assert.deepEqual(body.messages[0].content, [{ type: 'tool_use', id: 't1', name: 'Bash', input: {} }]);
});

test('stripUnsupportedBlocks: no-op for supported blocks, string content, and bad input', () => {
  assert.equal(stripUnsupportedBlocks({ messages: [
    { role: 'user', content: 'plain' },
    { role: 'assistant', content: [{ type: 'text', text: 'ok' }] },
  ] }), false);
  assert.equal(stripUnsupportedBlocks({}), false);
  assert.equal(stripUnsupportedBlocks(null), false);
  assert.equal(stripUnsupportedBlocks({ messages: 'nope' }), false);
});
