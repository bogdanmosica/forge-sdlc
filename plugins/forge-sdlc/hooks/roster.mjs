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
export const EFFORTS = /** @type {const} */ (['low', 'medium', 'high', 'xhigh', 'max']);

// A model alias Claude Code accepts, or a full id (`claude-opus-5-5`, with or
// without the `[1m]` context suffix). Values a host can mean, nothing else.
const ALIASES = new Set(['opus', 'sonnet', 'haiku', 'fable', 'best', 'default', 'opusplan', 'inherit']);
const FULL_ID = /^claude-[a-z0-9][a-z0-9-]*(\[1m\])?$/;
/** @param {unknown} v @returns {v is string} */
export const isModel = (v) => typeof v === 'string' && (ALIASES.has(v) || FULL_ID.test(v));
/** @param {unknown} v @returns {v is Effort} */
export const isEffort = (v) => typeof v === 'string' && /** @type {readonly string[]} */ (EFFORTS).includes(v);

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
  /** @type {Roster} */
  const roster = {
    present: typeof yamlText === 'string',
    version: null,
    enforce: 'off',
    roles,
    slots,
    policy: [],
    allow: { agents: [], skills: [] },
    problems: [],
  };
  fromForgeMd(roster, forgeConfig);
  if (typeof yamlText !== 'string') return roster;

  const say = (/** @type {string} */ line) => roster.problems.push(`roster: ${line}`);
  const { value, errors } = parseYamlSubset(yamlText);
  for (const e of errors) say(`line ${e.line}: ${e.message}`);
  const file = isMap(value) ? value : {};
  if (value !== null && !isMap(value)) say('the file is not a map of keys; nothing in it is read');

  for (const key of Object.keys(file)) if (!TOP_KEYS.includes(key)) say(`${key} is not a roster key (${TOP_KEYS.join(', ')}); ignored`);

  if (typeof file.version === 'number') roster.version = file.version;
  if (file.version === undefined || file.version === null) say('version is missing; read as version 1');
  else if (file.version !== 1) say(`version ${JSON.stringify(file.version)} is not supported; read as version 1`);

  if (file.enforce === true) roster.enforce = 'on';
  else if (enforceHidden(yamlText, value, errors)) {
    roster.enforce = 'unreadable';
    say('enforce is unreadable; the roster is not enforced until the file is fixed');
  } else if (file.enforce !== false && file.enforce !== undefined && file.enforce !== null)
    say(`enforce ${JSON.stringify(file.enforce)} is not true or false; the roster is not enforced`);

  for (const [role, entry] of entriesOf(file, 'roles', say)) {
    if (!ROLES.includes(role)) {
      say(`roles.${role} is not a role (${ROLES.join(', ')}); ignored`);
      continue;
    }
    if (entry === null) continue;
    if (!isMap(entry)) {
      say(`roles.${role} is not a map of agent, model and effort; ignored`);
      continue;
    }
    for (const field of Object.keys(entry))
      if (!ROLE_FIELDS.includes(field)) say(`roles.${role}.${field} is not agent, model or effort; ignored`);
    const base = /** @type {RosterRole} */ (roles[role]);
    let agent = base.agent;
    if (isName(entry.agent)) agent = entry.agent;
    else if (entry.agent != null) say(`roles.${role}.agent ${JSON.stringify(entry.agent)} is not an agent type; the default kept`);
    if (entry.model != null && !isModel(entry.model))
      say(`roles.${role}.model ${JSON.stringify(entry.model)} is no model alias or claude-* id; ignored`);
    if (entry.effort != null && !isEffort(entry.effort))
      say(`roles.${role}.effort ${JSON.stringify(entry.effort)} is not ${EFFORTS.join('|')}; ignored`);
    roles[role] = roleOf(role, agent, isModel(entry.model) ? entry.model : base.model, isEffort(entry.effort) ? entry.effort : base.effort);
  }

  for (const [slot, skill] of entriesOf(file, 'slots', say)) {
    if (skill === null) continue;
    if (slot === 'policy') {
      const list = namesOf(skill, 'slots.policy', 'skill', say);
      if (list) roster.policy = list;
      continue;
    }
    const spec = Object.hasOwn(SLOTS, slot) ? SLOTS[/** @type {keyof typeof SLOTS} */ (slot)] : undefined;
    if (!spec) say(`slots.${slot} is not a slot (${SLOT_NAMES.join(', ')}); ignored`);
    else if (skill === 'disabled' && spec.required) say(`slots.${slot} is required and cannot be disabled; ${spec.skill} kept`);
    else if (!isName(skill)) say(`slots.${slot} ${JSON.stringify(skill)} is not a skill name${spec.required ? '' : ' or disabled'}; ${spec.skill} kept`);
    else slots[slot] = skill;
  }

  for (const [kind, list] of entriesOf(file, 'allow', say)) {
    if (kind !== 'agents' && kind !== 'skills') {
      say(`allow.${kind} is not agents or skills; ignored`);
      continue;
    }
    const names = list === null ? [] : namesOf(list, `allow.${kind}`, kind === 'agents' ? 'agent type' : 'skill', say);
    if (names) roster.allow[kind] = names;
  }
  return roster;
}

/**
 * Whether the text is too broken to tell what `enforce` says: the file is no
 * map, or it sets no `enforce` and an error sits on a top-level line whose key
 * cannot be read as another one.
 * @param {string} text
 * @param {unknown} value
 * @param {YamlError[]} errors
 */
function enforceHidden(text, value, errors) {
  if (value === null) return false;
  if (!isMap(value)) return true;
  if (Object.hasOwn(value, 'enforce')) return false;
  const lines = text.split(/\r?\n/);
  return errors.some(({ line }) => {
    const raw = lines[line - 1] ?? '';
    if (raw.startsWith(' ')) return false;
    const key = /^([A-Za-z0-9_.-]+)\s*:/.exec(raw)?.[1];
    return key === undefined || key === 'enforce';
  });
}

/**
 * A role entry with only the keys that are set.
 * @param {string} role
 * @param {string} agent
 * @param {string | undefined} model
 * @param {Effort | undefined} effort
 * @returns {RosterRole}
 */
const roleOf = (role, agent, model, effort) => ({
  agent,
  ...(model ? { model } : {}),
  ...(effort ? { effort } : {}),
  swapped: agent !== `${PLUGIN}:${role}`,
});

/**
 * forge.md's deprecated sections, read while they last: each valid `## Routing`
 * bullet for a role sets that role's model or effort (forge.yaml, read after,
 * wins key by key), and `## Policy skills` is the policy list until
 * `slots.policy` replaces it. Every bullet still there is one deprecation line.
 * @param {Roster} roster
 * @param {ForgeConfig | undefined} config
 */
function fromForgeMd(roster, config) {
  for (const [key, value] of Object.entries(sectionOf(config, 'routing'))) {
    const m = /^(model|effort)\.(.+)$/.exec(key);
    const role = m?.[2] ?? '';
    if (!m || !ROLES.includes(role)) {
      roster.problems.push(
        `## Routing: ${key} is deprecated and has no docs/agents/forge.yaml equivalent; it stops working when ## Routing is removed`,
      );
      continue;
    }
    roster.problems.push(`## Routing: ${key} is deprecated; move it to roles.${role}.${m[1]} in docs/agents/forge.yaml`);
    const r = /** @type {RosterRole} */ (roster.roles[role]);
    if (m[1] === 'model' && isModel(value)) roster.roles[role] = roleOf(role, r.agent, value, r.effort);
    if (m[1] === 'effort' && isEffort(value)) roster.roles[role] = roleOf(role, r.agent, r.model, value);
  }
  for (const [key, value] of Object.entries(sectionOf(config, 'policy-skills'))) {
    const names = String(value ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && s !== 'none');
    if (!names.length) continue;
    roster.policy.push(...names);
    roster.problems.push(`## Policy skills: ${key} is deprecated; move it to slots.policy in docs/agents/forge.yaml`);
  }
}

/** A forge.md section as a map, anything else as none. */
const sectionOf = (/** @type {ForgeConfig | undefined} */ config, /** @type {string} */ name) => {
  const section = isMap(config) ? config[name] : undefined;
  return isMap(section) ? section : {};
};

const TOP_KEYS = ['version', 'enforce', 'roles', 'slots', 'allow'];
const ROLE_FIELDS = ['agent', 'model', 'effort'];

/** An agent type or skill name as the Agent and Skill tools name them. */
const isName = (/** @type {unknown} */ v) => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(v);

/**
 * The entries of a top-level section that must be a map; anything else is reported.
 * @param {Record<string, unknown>} file
 * @param {string} key
 * @param {(line: string) => void} say
 * @returns {[string, unknown][]}
 */
function entriesOf(file, key, say) {
  const section = file[key];
  if (section === undefined || section === null) return [];
  if (isMap(section)) return Object.entries(section);
  say(`${key} is not a map; ignored`);
  return [];
}

/**
 * A list of names, each bad item reported and dropped; undefined when it is no list.
 * @param {unknown} list
 * @param {string} key
 * @param {string} what
 * @param {(line: string) => void} say
 * @returns {string[] | undefined}
 */
function namesOf(list, key, what, say) {
  if (!Array.isArray(list)) {
    say(`${key} is not a list of ${what} names; ignored`);
    return undefined;
  }
  const names = list.filter(isName);
  if (names.length < list.length) say(`${key} holds an item that is not a ${what} name; it is skipped`);
  return names;
}

/** @param {unknown} v @returns {v is Record<string, unknown>} */
const isMap = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

// --- The YAML subset ---------------------------------------------------------
// 2-space maps; scalar lists, block (`- x`, at the key's indent or 2 deeper) or
// one-line flow (`[a, b]`); plain, 'single' and "double" quoted scalars (only
// \" and \\ escaped); true, false, integers, null, ~ and empty as null; `#`
// comments at a line's start or after a space. Each unsupported construct is
// an error naming its line; the line (and anything nested under it) is skipped
// and the rest is still read.

/** @typedef {{ line: number, message: string }} YamlError */
/** @typedef {{ line: number, indent: number, text: string }} Row */

/** A plain object whose own keys may be any string, `__proto__` included. */
const put = (/** @type {Record<string, unknown>} */ obj, /** @type {string} */ key, /** @type {unknown} */ value) =>
  Object.defineProperty(obj, key, { value, enumerable: true, writable: true, configurable: true });

/**
 * A line without its comment: `#` at the start or after whitespace, outside quotes.
 * @param {string} line
 */
function stripComment(line) {
  let quote = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === '\\' && quote === '"') i++;
      else if (c === quote) quote = '';
    } else if (c === '"' || c === "'") {
      if (i === 0 || /[\s:[,-]/.test(line[i - 1] ?? '')) quote = c;
    } else if (c === '#' && (i === 0 || /\s/.test(line[i - 1] ?? ''))) {
      return line.slice(0, i);
    }
  }
  return line;
}

const KEY = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[A-Za-z0-9_.-]+)\s*:(?:\s+(.*))?$/;
const isItem = (/** @type {string} */ text) => text === '-' || text.startsWith('- ');

/**
 * @param {string} text
 * @returns {{ value: unknown, errors: YamlError[] }}
 */
export function parseYamlSubset(text) {
  /** @type {YamlError[]} */
  const errors = [];
  const fail = (/** @type {number} */ line, /** @type {string} */ message) => {
    errors.push({ line, message });
  };

  /** @type {Row[]} */
  const rows = [];
  let dropped = -1; // the indent of the last dropped row: rows nested under it go too
  String(text ?? '')
    .split(/\r?\n/)
    .forEach((raw, i) => {
      const line = i + 1;
      const body = stripComment(raw).trimEnd();
      if (!body.trim()) return;
      const indent = body.length - body.replace(/^ +/, '').length;
      if (dropped >= 0 && indent > dropped) return;
      dropped = -1;
      const drop = (/** @type {string} */ message) => {
        fail(line, message);
        dropped = indent;
      };
      if (body.includes('\t')) return drop('a tab: indent and separate with spaces');
      if (/^(---|\.\.\.)(\s|$)/.test(body)) return drop('document markers (--- or ...) are not supported: one document per file');
      if (indent % 2) return drop(`an indent of ${indent} spaces: indent by 2`);
      rows.push({ line, indent, text: body.slice(indent) });
    });

  let at = 0;
  // Skip a row and every row nested deeper than `indent` under it.
  const skipFrom = (/** @type {number} */ indent) => {
    at++;
    while (at < rows.length && /** @type {Row} */ (rows[at]).indent > indent) at++;
  };

  /**
   * A scalar or a one-line flow list.
   * @param {string} text
   * @param {number} line
   * @returns {{ ok: true, value: unknown } | { ok: false }}
   */
  function scalar(text, line, inFlow = false) {
    const bad = (/** @type {string} */ message) => (fail(line, message), /** @type {{ ok: false }} */ ({ ok: false }));
    const lead = text[0] ?? '';
    if (lead === '&') return bad('anchors (&) are not supported: repeat the value');
    if (lead === '*') return bad('aliases (*) are not supported: repeat the value');
    if (lead === '!') return bad('tags (!) are not supported');
    if (lead === '|' || lead === '>') return bad('block scalars (| or >) are not supported: keep the value on one line');
    if (lead === '{') return bad('flow maps ({...}) are not supported: nest the keys by 2 spaces');
    if (lead === '@' || lead === '`' || lead === '%') return bad(`a value starting with ${lead} must be quoted`);
    if (lead === '-' && (text === '-' || text.startsWith('- '))) return bad('nested lists are not supported');
    if (lead === '[' && inFlow) return bad('nested flow lists are not supported');
    if (text.startsWith('[')) {
      if (!text.endsWith(']')) return bad('multi-line flow lists are not supported: close the [...] on its line');
      const inner = text.slice(1, -1).trim();
      if (!inner) return { ok: true, value: [] };
      /** @type {unknown[]} */
      const items = [];
      for (const part of splitFlow(inner)) {
        const item = scalar(part.trim(), line, true);
        if (!item.ok) return { ok: false };
        items.push(item.value);
      }
      return { ok: true, value: items };
    }
    if (text.startsWith('"')) {
      const m = /^"((?:[^"\\]|\\.)*)"$/.exec(text);
      if (!m) return bad('a double-quoted value must close at the end of its line');
      if ((m[1] ?? '').replace(/\\["\\]/g, '').includes('\\')) return bad('only \\" and \\\\ escapes are supported in a double-quoted value');
      return { ok: true, value: (m[1] ?? '').replace(/\\(.)/g, '$1') };
    }
    if (text.startsWith("'")) {
      const m = /^'((?:[^']|'')*)'$/.exec(text);
      if (!m) return bad('a single-quoted value must close at the end of its line');
      return { ok: true, value: (m[1] ?? '').replace(/''/g, "'") };
    }
    if (text === '' || text === '~' || text === 'null') return { ok: true, value: null };
    if (text === 'true') return { ok: true, value: true };
    if (text === 'false') return { ok: true, value: false };
    if (/^-?\d+$/.test(text)) return { ok: true, value: Number(text) };
    if (/:(\s|$)/.test(text)) return bad('a plain value holding ": " or ending in ":" must be quoted');
    return { ok: true, value: text };
  }

  /**
   * The block starting at the current row, at `indent`.
   * @param {number} indent
   * @returns {unknown}
   */
  function block(indent) {
    const first = rows[at];
    return first && isItem(first.text) ? list(indent) : map(indent);
  }

  /** @param {number} indent */
  function list(indent) {
    /** @type {unknown[]} */
    const items = [];
    while (at < rows.length) {
      const row = /** @type {Row} */ (rows[at]);
      if (row.indent !== indent || !isItem(row.text)) break;
      const text = row.text.slice(1).trim();
      if (KEY.test(text)) {
        fail(row.line, 'lists of maps are not supported: list plain values');
        skipFrom(indent);
        continue;
      }
      const item = scalar(text, row.line);
      skipFrom(indent);
      if (item.ok) items.push(item.value);
    }
    return items;
  }

  /** @param {number} indent */
  function map(indent) {
    /** @type {Record<string, unknown>} */
    const out = {};
    while (at < rows.length) {
      const row = /** @type {Row} */ (rows[at]);
      if (row.indent < indent) break;
      const skip = (/** @type {string} */ message) => {
        fail(row.line, message);
        skipFrom(row.indent);
      };
      if (row.indent > indent) {
        skip(`an indent of ${row.indent} spaces where ${indent} was expected`);
        continue;
      }
      if (row.text.startsWith('<<')) {
        skip('merge keys (<<) are not supported: repeat the keys');
        continue;
      }
      if (isItem(row.text)) {
        skip('a list item where a `key: value` was expected');
        continue;
      }
      const m = KEY.exec(row.text);
      if (!m) {
        skip('expected `key: value`');
        continue;
      }
      const raw = /** @type {string} */ (m[1]);
      const quoted = /^["']/.test(raw) ? scalar(raw, row.line) : undefined;
      if (quoted && !quoted.ok) {
        // scalar() reported it; the row and what is nested under it go
        skipFrom(row.indent);
        continue;
      }
      const key = quoted ? String(quoted.value) : raw;
      if (Object.hasOwn(out, key)) {
        skip(`duplicate key ${key}: the first is kept`);
        continue;
      }
      const rest = (m[2] ?? '').trim();
      at++;
      const next = rows[at];
      if (rest) {
        const v = scalar(rest, row.line);
        if (v.ok) put(out, key, v.value);
      } else if (next && next.indent === indent && isItem(next.text)) {
        put(out, key, list(indent));
      } else if (next && next.indent > indent) {
        if (next.indent !== indent + 2) {
          fail(next.line, `an indent of ${next.indent} spaces under a key at ${indent}: nest by 2`);
          at--;
          skipFrom(indent);
          continue;
        }
        put(out, key, block(next.indent));
      } else {
        put(out, key, null);
      }
    }
    return out;
  }

  try {
    const value = rows.length ? block(0) : null;
    return { value, errors };
  } catch {
    // Not reached by any known input; a reader that never throws holds anyway.
    return { value: null, errors: [...errors, { line: 0, message: 'the text could not be read' }] };
  }
}

/**
 * The items of a flow list's inside, split at commas outside quotes.
 * @param {string} inner
 */
function splitFlow(inner) {
  /** @type {string[]} */
  const parts = [];
  let quote = '';
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (quote) {
      if (c === '\\' && quote === '"') i++;
      else if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === ',') {
      parts.push(inner.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(inner.slice(start));
  return parts;
}
