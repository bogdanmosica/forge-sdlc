#!/usr/bin/env node
// A member's name: `node bin/crew-name.mjs <role> --project <host> --effort <slug>` prints the next
// name of the role's pool, and records it under the effort's `crew.<role>` in .forge/state.json
// (docs/contracts.md, "Member name"). Exit 0; 2 on bad usage.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readHostConfig, readState, writeState } from '../hooks/scripts/lib.mjs';

const PRESETS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'crew.json');

/** A display name in the form the Agent tool accepts: diacritics folded, spaces to `-`, only letters, digits, `_` and `-`. */
export const handleOf = (name) =>
  name.normalize('NFD').replace(/\s+/g, '-').replace(/[^A-Za-z0-9_-]/g, '').replace(/-{2,}/g, '-');

const [role, ...rest] = process.argv.slice(2);
const flags = {};
for (let i = 0; i < rest.length; i += 2) flags[rest[i].replace(/^--/, '')] = rest[i + 1];
const dir = path.resolve(flags.project);
const slug = flags.effort;

const theme = readHostConfig(dir)?.crew?.theme;
const pool = JSON.parse(readFileSync(PRESETS, 'utf8')).presets[theme].names[role].map(handleOf);

const state = readState(dir);
const record = state.efforts[slug];
const used = record.crew?.[role] ?? [];

/** The first name of the pool not in `used`; a pool run out starts again with `-2`, then `-3`. */
function nextName(pool, used) {
  for (let round = 1; ; round += 1) {
    const free = pool.map((n) => (round === 1 ? n : `${n}-${round}`)).find((n) => !used.includes(n));
    if (free) return free;
  }
}
const pick = nextName(pool, used);

record.crew = { ...record.crew, [role]: [...used, pick] };
record.updatedAt = new Date().toISOString();
writeState(dir, state);
process.stdout.write(`${pick}\n`);
