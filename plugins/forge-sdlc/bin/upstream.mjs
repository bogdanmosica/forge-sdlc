// The upstream seam: where the installed mattpocock-skills plugin is, which version, and
// whether it still carries what this plugin reads by file. Used by bin/skill-path.mjs (CLI)
// and hooks/scripts/skills-version.mjs (SessionStart). Nothing here spawns a shell.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const UPSTREAM = 'mattpocock-skills@claude-plugins-official';
export const INSTALL_LINE = `claude plugin install ${UPSTREAM}`;
/** Points at a plugin root directly, bypassing the registry: tests, or a vendored copy. */
export const ROOT_OVERRIDE = 'MATTPOCOCK_SKILLS_ROOT';

export const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LOCK_FILE = path.join(PLUGIN_ROOT, 'UPSTREAM.lock');

/** The engine's config dir: CLAUDE_CONFIG_DIR, else ~/.claude. */
export const configDirOf = (env = process.env) => env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');

/** The installed-plugins registry `{ version, plugins: { "<name>@<marketplace>": [entry, ...] } }`, or null. */
export function readRegistry(env = process.env) {
  const file = path.join(configDirOf(env), 'plugins', 'installed_plugins.json');
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** The `version` of the plugin manifest under `root`, or null. */
export function manifestVersion(root) {
  const file = path.join(root, '.claude-plugin', 'plugin.json');
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8')).version ?? null;
  } catch {
    return null;
  }
}

/**
 * The installed upstream plugin as `{ root, version, scope }`, or null when it is not installed.
 * The override env wins; else the registry entry for this project (scope `project` whose
 * `projectPath` is `projectDir`), else the `user` entry, else any entry whose path exists.
 */
export function installedUpstream({ env = process.env, projectDir = process.cwd() } = {}) {
  const override = env[ROOT_OVERRIDE];
  if (override) {
    const root = path.resolve(override);
    return existsSync(root) ? { root, version: manifestVersion(root), scope: 'override' } : null;
  }
  const entries = (readRegistry(env)?.plugins?.[UPSTREAM] ?? []).filter((e) => e.installPath && existsSync(e.installPath));
  const here = path.resolve(projectDir);
  const pick =
    entries.find((e) => e.scope === 'project' && e.projectPath && path.resolve(e.projectPath) === here) ??
    entries.find((e) => e.scope === 'user') ??
    entries[0];
  if (!pick) return null;
  return { root: pick.installPath, version: pick.version ?? manifestVersion(pick.installPath), scope: pick.scope };
}

/** The SKILL.md of `name` under `root`: `skills/<name>/` or one level down (`skills/engineering/<name>/`), else null. */
export function skillFile(root, name) {
  const direct = path.join(root, 'skills', name, 'SKILL.md');
  if (existsSync(direct)) return direct;
  const skills = path.join(root, 'skills');
  if (!existsSync(skills)) return null;
  for (const group of readdirSync(skills, { withFileTypes: true })) {
    if (!group.isDirectory()) continue;
    const nested = path.join(skills, group.name, name, 'SKILL.md');
    if (existsSync(nested)) return nested;
  }
  return null;
}

/* The lock */

/**
 * UPSTREAM.lock as `{ version, date, skills: { [name]: [heading, ...] } }`. Lines are
 * `key: value`; `#` starts a comment; a skill line's headings are separated by ` | `.
 */
export function parseLock(text) {
  const lock = { version: null, date: null, skills: {} };
  for (const raw of text.split('\n')) {
    const line = raw.replace(/^\s*#.*$/, '').trim();
    const m = /^([^:]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    const [, key, value] = m;
    if (key === 'version') lock.version = value;
    else if (key === 'date') lock.date = value;
    else lock.skills[key.trim()] = value.split('|').map((h) => h.trim()).filter(Boolean);
  }
  return lock;
}

export const readLock = (file = LOCK_FILE) => parseLock(readFileSync(file, 'utf8'));

/** A heading is present when it opens a line of the file, as written in the lock. */
const hasHeading = (text, heading) => text.split('\n').some((line) => line.trimEnd() === heading);

/**
 * The verdict on the installed upstream against the lock:
 * `{ status, installed, locked, root, missing }` where status is `missing` (not installed),
 * `broken` (a locked skill file or heading is gone: the frame would misread it), `drift`
 * (another version, every heading present) or `ok`. `missing` lists `{ skill, heading }`.
 */
export function checkUpstream({ env = process.env, projectDir = process.cwd(), lockFile = LOCK_FILE } = {}) {
  const lock = readLock(lockFile);
  const installed = installedUpstream({ env, projectDir });
  if (!installed) return { status: 'missing', installed: null, locked: lock.version, root: null, missing: [] };
  const missing = [];
  for (const [skill, headings] of Object.entries(lock.skills)) {
    const file = skillFile(installed.root, skill);
    if (!file) {
      missing.push({ skill, heading: null });
      continue;
    }
    const text = readFileSync(file, 'utf8');
    for (const heading of headings) if (!hasHeading(text, heading)) missing.push({ skill, heading });
  }
  const status = missing.length > 0 ? 'broken' : installed.version !== lock.version ? 'drift' : 'ok';
  return { status, installed: installed.version, locked: lock.version, root: installed.root, missing };
}

/** The one-paragraph warning for a verdict that is not `ok`, or null. */
export function warningFor(verdict) {
  const { status, installed, locked, missing } = verdict;
  if (status === 'ok') return null;
  if (status === 'missing') {
    return `forge-sdlc: ${UPSTREAM} is not installed, and the loop reads its skills. Install it: ${INSTALL_LINE}`;
  }
  if (status === 'broken') {
    const gone = missing
      .map((m) => (m.heading ? `${m.skill}: "${m.heading}"` : `${m.skill}: SKILL.md`))
      .join('; ');
    return (
      `forge-sdlc: the installed ${UPSTREAM} (${installed ?? 'unknown version'}) no longer carries what the ` +
      `loop reads (tested against ${locked}): ${gone}. Re-read the delta in plugins/forge-sdlc, fix the frame, ` +
      'then bump UPSTREAM.lock.'
    );
  }
  return (
    `forge-sdlc: ${UPSTREAM} is ${installed ?? 'an unknown version'}, tested against ${locked}. Every heading the ` +
    'loop reads is still there; run the upstream evals, then bump UPSTREAM.lock to the installed version.'
  );
}
