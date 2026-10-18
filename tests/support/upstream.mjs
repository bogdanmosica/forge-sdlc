// A fixture upstream: a fake mattpocock-skills plugin root in a temp dir, laid out like the
// real one (skills/engineering/<name>/SKILL.md, skills/productivity/<name>/SKILL.md), its
// skills generated from UPSTREAM.lock so they carry every locked heading unless told to drop
// one; and a fake config dir whose registry points at it, to test resolution through the engine.

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const plugin = path.join(repo, 'plugins', 'forge-sdlc');
export const lockText = () => readFileSync(path.join(plugin, 'UPSTREAM.lock'), 'utf8');

const PRODUCTIVITY = new Set(['grilling', 'grill-me', 'handoff', 'writing-for-agents']);

/**
 * `{ root }` of a fake plugin at `version`. `skills` maps a skill name to its headings (default:
 * the lock's). `drop` is `{ skill, heading }` to leave out, or `{ skill }` to omit the file.
 */
export function fakeUpstream({ version = '1.3.1', skills = null, drop = null, lock = lockText() } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'forge-upstream-'));
  mkdirSync(path.join(root, '.claude-plugin'), { recursive: true });
  writeFileSync(path.join(root, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'mattpocock-skills', version }));
  const fromLock = {};
  for (const line of lock.split('\n')) {
    const m = /^([a-z0-9-]+):\s*(.*)$/.exec(line.trim());
    if (m && !['version', 'date'].includes(m[1])) fromLock[m[1]] = m[2].split('|').map((h) => h.trim());
  }
  for (const [name, headings] of Object.entries(skills ?? fromLock)) {
    if (drop && drop.skill === name && !drop.heading) continue;
    const kept = headings.filter((h) => !(drop && drop.skill === name && drop.heading === h));
    const group = PRODUCTIVITY.has(name) ? 'productivity' : 'engineering';
    const dir = path.join(root, 'skills', group, name);
    mkdirSync(dir, { recursive: true });
    const body = kept.map((h) => `${h}\n\nbody of ${h}\n`).join('\n');
    writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: fake\n---\n\n${body}`);
  }
  return { root };
}

/** A config dir whose installed_plugins.json has the given entries for the upstream plugin. */
export function fakeConfigDir(entries) {
  const dir = mkdtempSync(path.join(tmpdir(), 'forge-config-'));
  mkdirSync(path.join(dir, 'plugins'), { recursive: true });
  const registry = { version: 2, plugins: { 'mattpocock-skills@claude-plugins-official': entries } };
  writeFileSync(path.join(dir, 'plugins', 'installed_plugins.json'), JSON.stringify(registry));
  return dir;
}

/** A clean env for a child: no override, no engine config dir, unless given. */
export const envWith = (extra = {}) => {
  const env = { ...process.env, ...extra };
  if (!('MATTPOCOCK_SKILLS_ROOT' in extra)) delete env.MATTPOCOCK_SKILLS_ROOT;
  if (!('CLAUDE_CONFIG_DIR' in extra)) env.CLAUDE_CONFIG_DIR = fakeConfigDir([]);
  return env;
};
