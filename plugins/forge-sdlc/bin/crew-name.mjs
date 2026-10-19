#!/usr/bin/env node
// A member's name: `node bin/crew-name.mjs <role> --project <host> --effort <slug>` prints the next
// name of the role's pool, and records it under the effort's `crew.<role>` in .forge/state.json
// (docs/contracts.md, "Member name"). Exit 0; 2 on bad usage.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { listOf, readHostConfig, readState, writeState } from '../hooks/scripts/lib.mjs';

const PRESETS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'crew.json');

/**
 * A display name in the form the Agent tool accepts: diacritics folded, spaces to `-`, only
 * letters, digits, `_` and `-`, runs of `-` collapsed and none at either end. '' when nothing is left.
 */
export const handleOf = (name) =>
  name.normalize('NFD').replace(/\s+/g, '-').replace(/[^A-Za-z0-9_-]/g, '').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');

const [role, ...rest] = process.argv.slice(2);
const flags = {};
for (let i = 0; i < rest.length; i += 2) flags[rest[i].replace(/^--/, '')] = rest[i + 1];
const dir = path.resolve(flags.project);
const slug = flags.effort;

/** Display names in handle form, dropping any with nothing left. */
const handlesOf = (names) => (names ?? []).map(handleOf).filter(Boolean);

/**
 * The role's pool in handle form: the host's `names.<role>` bullet, else the preset its theme
 * names, else the fallback (`<slug>-<nn>` for an implementer with `--slice`, `<role>` otherwise).
 */
function poolOf(crew) {
  const override = handlesOf(listOf(crew?.[`names.${role}`]));
  if (override.length) return override;
  const presets = JSON.parse(readFileSync(PRESETS, 'utf8')).presets;
  const preset = Object.hasOwn(presets, crew?.theme ?? '') ? handlesOf(presets[crew.theme].names[role]) : [];
  if (preset.length) return preset;
  return [role === 'implementer' && flags.slice ? flags.slice : role];
}
const pool = poolOf(readHostConfig(dir)?.crew);

const state = readState(dir);
const record = state.efforts[slug];
const used = record.crew?.[role] ?? [];

/** The first name of the pool not in `used`; a pool run out starts again with `-2`, then `-3`. */
function nextName(pool, used) {
  for (let round = 1; ; round += 1) {
    const free = pool.map((n) => (round === 1 ? n : `${n}-${round}`)).find((n) => !used.includes(n));
    if (free !== undefined) return free;
  }
}
const member = flags.slice ? record.slices?.[flags.slice]?.member : undefined;
if (member) {
  process.stdout.write(`${member}\n`);
  process.exit(0);
}
const pick = nextName(pool, used);

record.crew = { ...record.crew, [role]: [...used, pick] };
if (flags.slice) record.slices = { ...record.slices, [flags.slice]: { ...record.slices?.[flags.slice], member: pick } };
record.updatedAt = new Date().toISOString();
writeState(dir, state);
process.stdout.write(`${pick}\n`);
