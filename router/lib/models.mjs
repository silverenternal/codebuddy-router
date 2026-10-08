/**
 * CodeBuddy model classification.
 *
 * A request is routed to the CodeBuddy gateway when its model id is either
 * present in the live catalog (fetched from the gateway's `/v1/models`) or
 * matches a known CodeBuddy prefix. Everything else goes to the fallback
 * provider. Kept pure and dependency-free so it is trivial to unit-test.
 */

/**
 * Known CodeBuddy model-id prefixes.
 *
 * Case-sensitive on purpose: CodeBuddy's ids are lowercase, while a fallback
 * provider's ids may not be — so a differently-cased id is never misrouted.
 * @type {RegExp}
 */
export const CB_PREFIX =
  /^(deepseek|glm|kimi|gpt-|gemini-|minimax-m|default-model|fast-model|balanced-model|primary-model|deep-model)/;

/**
 * Model ids the upstream advertises but which error out — never list them.
 * @type {ReadonlySet<string>}
 */
export const DENY = new Set(['deep-model']);

/**
 * Decide whether a model id belongs to CodeBuddy.
 * @param {string} model  Model id taken from the request body.
 * @param {Set<string>|ReadonlySet<string>} [catalog]  Live CodeBuddy model ids.
 * @returns {boolean} `true` if the request should go to the CodeBuddy gateway.
 */
export function isCodeBuddy(model, catalog) {
  if (!model) return false;
  if (catalog && catalog.has(model)) return true;
  return CB_PREFIX.test(model);
}

/**
 * Drop empty and denied ids from a raw catalog, preserving order.
 * @param {Iterable<string>} ids  Model ids as reported by the gateway.
 * @returns {string[]} Usable model ids.
 */
export function filterCatalog(ids) {
  return [...ids].filter((id) => id && !DENY.has(id));
}

/**
 * Pull model ids out of a `/v1/models` response. Both the Anthropic-style and
 * OpenAI-style bodies use `{ data: [{ id }] }`, so one reader covers both.
 * @param {unknown} json  Parsed response body.
 * @returns {string[]} Model ids (empty when the shape is unexpected).
 */
export function extractModelIds(json) {
  const data = json && Array.isArray(json.data) ? json.data : [];
  return data.map((m) => m && m.id).filter((id) => typeof id === 'string' && id);
}

/**
 * Retired CodeBuddy ids → their current equivalent.
 *
 * A Claude Code session records the model it was created with, and `--resume`
 * replays that id verbatim. Ids that no longer exist upstream would 400; rewrite
 * them so an old session keeps working.
 *
 * Note: fallback-provider ids (e.g. `MiniMax-M3`) are deliberately **not** listed
 * here — they must reach the fallback provider, so that the models in that
 * subscription stay selectable and usable.
 * @type {ReadonlyMap<string, string>}
 */
export const ALIASES = new Map([
  ['deepseek-flash', 'deepseek-v4.1-flash'],
]);

/** Trailing context-size hint Claude Code appends, e.g. `[1m]`, `[200k]`. */
const CONTEXT_SUFFIX = /\[[^\]]*\]$/;

/**
 * Rewrite a requested model id to a current one, when we know a mapping.
 * A trailing `[1m]`-style suffix is stripped first, so `MiniMax-M3[1m]`
 * resolves through the same alias as `MiniMax-M3`.
 * @param {string} model  Model id taken from the request body.
 * @returns {string} The id to send upstream (unchanged when there is no alias).
 */
export function normalizeModel(model) {
  if (!model || typeof model !== 'string') return model;
  const base = model.replace(CONTEXT_SUFFIX, '');
  const alias = ALIASES.get(base);
  if (alias) return alias;
  return base !== model ? base : model;
}

/**
 * Content-block types the CodeBuddy gateway cannot translate. It only handles
 * `text` / `image` / `tool_use` / `tool_result` and rejects anything else with
 * `400 不支持的内容块类型`. Claude Code replays `thinking` blocks whenever
 * extended thinking is on, so a session built on a thinking-capable provider
 * would 400 the moment it is routed to CodeBuddy.
 * @type {ReadonlySet<string>}
 */
export const CB_UNSUPPORTED_BLOCKS = new Set(['thinking', 'redacted_thinking']);

/**
 * Remove content blocks the CodeBuddy gateway rejects, mutating `body` in place.
 * An assistant message left with no blocks at all is dropped entirely.
 * @param {{messages?: Array<{content?: unknown}>}} body  Parsed request body.
 * @returns {boolean} `true` if anything was removed.
 */
export function stripUnsupportedBlocks(body) {
  if (!body || !Array.isArray(body.messages)) return false;
  const kept = [];
  let changed = false;
  for (const msg of body.messages) {
    if (msg && Array.isArray(msg.content)) {
      const blocks = msg.content.filter((b) => !(b && CB_UNSUPPORTED_BLOCKS.has(b.type)));
      if (blocks.length !== msg.content.length) {
        changed = true;
        if (blocks.length === 0) continue; // message was only unsupported blocks
        msg.content = blocks;
      }
    }
    kept.push(msg);
  }
  if (changed) body.messages = kept;
  return changed;
}
