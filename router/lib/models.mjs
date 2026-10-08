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
