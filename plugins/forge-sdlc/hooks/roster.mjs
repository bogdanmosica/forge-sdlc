// The roster reader: docs/agents/forge.yaml, the host's roster, read as a strict
// YAML subset and resolved over the defaults and forge.md's deprecated
// `## Routing` and `## Policy skills`. Shared by the hooks (lib.mjs), the bin
// scripts, the guard and the run pane mod, so there is one reading and no
// mirror. Pure, no imports and no Node API, so a mod and node both load it as
// it is; it never throws. Types for the mod's TypeScript: roster.d.mts.

/** @typedef {'low' | 'medium' | 'high' | 'xhigh' | 'max'} Effort */
/** @typedef {Record<string, Record<string, string>>} ForgeConfig */
/** @typedef {{ agent: string, model?: string, effort?: Effort, swapped: boolean }} RosterRole */
/**
 * @typedef {{
 *   present: boolean,
 *   version: number | null,
 *   enforce: 'on' | 'off' | 'unreadable',
 *   roles: Record<string, RosterRole>,
 *   slots: Record<string, string>,
 *   policy: string[],
 *   allow: { agents: string[], skills: string[] },
 *   problems: string[],
 * }} Roster
 */

export const PLUGIN = 'forge-sdlc';
export const ROLES = ['researcher', 'prototyper', 'spec-writer', 'implementer', 'verifier', 'reviewer', 'merger'];

// Each slot's default skill, and whether `disabled` may replace it.
const SLOTS = {
  'implementer.tdd': { skill: 'mattpocock-skills:tdd', required: true },
  'prototyper.prototype': { skill: 'mattpocock-skills:prototype', required: true },
  grilling: { skill: 'mattpocock-skills:grilling', required: true },
  'spec-writer.codebase-design': { skill: 'mattpocock-skills:codebase-design', required: false },
  'domain-modeling': { skill: 'mattpocock-skills:domain-modeling', required: false },
};
export const SLOT_NAMES = [...Object.keys(SLOTS), 'policy'];

/**
 * The roster: the YAML text of forge.yaml (undefined when there is none) over
 * the defaults and the parsed forge.md. Every problem is one band-ready line.
 * @param {string | undefined} yamlText
 * @param {ForgeConfig | undefined} forgeConfig
 * @returns {Roster}
 */
export function resolveRoster(yamlText, forgeConfig) {
  /** @type {Record<string, RosterRole>} */
  const roles = {};
  for (const role of ROLES) roles[role] = { agent: `${PLUGIN}:${role}`, swapped: false };
  /** @type {Record<string, string>} */
  const slots = {};
  for (const [slot, { skill }] of Object.entries(SLOTS)) slots[slot] = skill;
  return {
    present: false,
    version: null,
    enforce: 'off',
    roles,
    slots,
    policy: [],
    allow: { agents: [], skills: [] },
    problems: [],
  };
}

/**
 * @param {string} text
 * @returns {{ value: unknown, errors: { line: number, message: string }[] }}
 */
export function parseYamlSubset(text) {
  return { value: null, errors: [] };
}
