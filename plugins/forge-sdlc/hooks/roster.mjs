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
      const key = /^["']/.test(raw) ? String(/** @type {{ value: unknown }} */ (scalar(raw, row.line)).value) : raw;
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
