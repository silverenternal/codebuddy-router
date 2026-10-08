/**
 * Pure presentation logic for the Claude Code `/model` picker.
 *
 * Everything here is deterministic and free of I/O so it can be unit-tested
 * directly. The I/O half lives in `gen-picker.mjs`.
 */

/**
 * Curated presentation for known models. Anything not listed here still appears
 * in the picker — its label and capability are derived automatically.
 * @type {Record<string, {label: string, description?: string, behavesAs: string}>}
 */
export const CURATED = {
  'deepseek-v4.1-flash': { label: 'DeepSeek V4.1 Flash', description: 'CodeBuddy · 默认', behavesAs: 'claude-sonnet-4-6' },
  'deepseek-v4.1-flash-sg': { label: 'DeepSeek V4.1 Flash (SG)', behavesAs: 'claude-sonnet-4-6' },
  'glm-5.3': { label: 'GLM 5.3', behavesAs: 'claude-sonnet-4-6' },
  'glm-5.2': { label: 'GLM 5.2', behavesAs: 'claude-sonnet-4-6' },
  'kimi-k3': { label: 'Kimi K3', behavesAs: 'claude-sonnet-4-6' },
  'kimi-k2.6': { label: 'Kimi K2.6', behavesAs: 'claude-sonnet-4-6' },
  'gpt-6-luna': { label: 'GPT-6 Luna', behavesAs: 'claude-opus-4-8' },
  'gpt-6-sol': { label: 'GPT-6 Sol', behavesAs: 'claude-opus-4-8' },
  'gpt-6-astra': { label: 'GPT-6 Astra', behavesAs: 'claude-opus-4-8' },
  'gpt-5.6-sol': { label: 'GPT-5.6 Sol', behavesAs: 'claude-sonnet-4-6' },
  'gpt-5.6-terra': { label: 'GPT-5.6 Terra', behavesAs: 'claude-sonnet-4-6' },
  'gpt-5.6-luna': { label: 'GPT-5.6 Luna', behavesAs: 'claude-sonnet-4-6' },
  'gpt-5.5': { label: 'GPT-5.5', behavesAs: 'claude-sonnet-4-6' },
  'gpt-5.4': { label: 'GPT-5.4', behavesAs: 'claude-sonnet-4-6' },
  'gpt-5.3-codex': { label: 'GPT-5.3 Codex', behavesAs: 'claude-sonnet-4-6' },
  'gemini-3.5-flash': { label: 'Gemini 3.5 Flash', behavesAs: 'claude-sonnet-4-6' },
  'minimax-m3': { label: 'MiniMax M3 (CodeBuddy)', behavesAs: 'claude-sonnet-4-6' },
  'default-model': { label: 'CodeBuddy Default', behavesAs: 'claude-sonnet-4-6' },
  'fast-model': { label: 'CodeBuddy Fast', behavesAs: 'claude-sonnet-4-6' },
  'balanced-model': { label: 'CodeBuddy Balanced', behavesAs: 'claude-sonnet-4-6' },
  'primary-model': { label: 'CodeBuddy Primary', behavesAs: 'claude-sonnet-4-6' },
};

/**
 * Preferred ordering: curated ids first, in declaration order; anything else is
 * appended afterwards.
 * @type {string[]}
 */
export const ORDER = Object.keys(CURATED);

/**
 * Derive a human label from a model id, e.g. `gpt-5.6-sol` → `Gpt 5.6 Sol`.
 *
 * Splits on `-` and `_` only (never `.`), so version numbers such as `M3.1`
 * survive intact.
 * @param {string} id  Model id.
 * @returns {string} Display label.
 */
export function deriveLabel(id) {
  return id
    .split(/[-_]/)
    .map((p) => (/^\d/.test(p) || /^[A-Z]/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

/**
 * Choose the base model Claude Code should treat this id as, for capability and
 * effort defaults (`behavesAs`). Stronger families map to the opus profile.
 * @param {string} id  Model id.
 * @returns {string} A Claude model id to mimic.
 */
export function behavesFor(id) {
  return /gpt-6|opus|gpt-5\.6-(sol|terra)/i.test(id) ? 'claude-opus-4-8' : 'claude-sonnet-4-6';
}

/**
 * Build a single picker option row for a model id.
 * @param {string} id  Model id.
 * @returns {{model: string, label: string, description?: string, behavesAs: string}} Picker row.
 */
export function row(id) {
  const c = CURATED[id] || {};
  const r = { model: id, label: c.label || deriveLabel(id) };
  if (c.description) r.description = c.description;
  r.behavesAs = c.behavesAs || behavesFor(id);
  return r;
}

/**
 * Build the full, ordered picker option list from a catalog of ids.
 * @param {string[]} ids  Model ids (already deny-filtered).
 * @returns {Array<ReturnType<typeof row>>} Ordered picker rows.
 */
export function buildOptions(ids) {
  const rank = (id) => {
    const i = ORDER.indexOf(id);
    return i === -1 ? ORDER.length : i;
  };
  return [...ids].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).map(row);
}
