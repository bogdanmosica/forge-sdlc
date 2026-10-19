#!/usr/bin/env node
// A member's name: `node bin/crew-name.mjs <role> --project <host> --effort <slug> [--slice <slug>-<nn>]`
// prints one line, the next name of the role's pool in handle form, and records it under the
// effort's `crew.<role>` in .forge/state.json; with `--slice` (an implementer), also as the slice's
// `member`, which a later call for that slice prints again (docs/contracts.md, "Member name").
// An effort absent from state gets a name and nothing is recorded. Exit 0; 2 on bad usage.

import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { listOf, readHostConfig, readState, writeState } from '../hooks/scripts/lib.mjs';

const PRESETS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'crew.json');

const ROLES = ['researcher', 'prototyper', 'spec-writer', 'implementer', 'verifier', 'reviewer', 'merger', 'general'];

const USAGE = `usage: crew-name.mjs <role> --project <host> --effort <slug> [--slice <slug>-<nn>]; role: ${ROLES.join(', ')}; --slice for an implementer only, <slug> the --effort\n`;

/**
 * A display name in the form the Agent tool accepts: diacritics folded, spaces to `-`, only
 * letters, digits, `_` and `-`, runs of `-` collapsed and none at either end. '' when nothing is left.
 */
export const handleOf = (name) =>
  name.normalize('NFD').replace(/\s+/g, '-').replace(/[^A-Za-z0-9_-]/g, '').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');

/** Display names in handle form, dropping any with nothing left. */
const handlesOf = (names) => (names ?? []).map(handleOf).filter(Boolean);

/**
 * The role's pool in handle form: the host's `names.<role>` bullet, else the preset its theme
 * names, else the fallback (`<slug>-<nn>` for an implementer with `--slice`, `<role>` otherwise).
 */
function poolOf(crew, role, slice) {
  const override = handlesOf(listOf(crew?.[`names.${role}`]));
  if (override.length) return override;
  const presets = JSON.parse(readFileSync(PRESETS, 'utf8')).presets;
  const preset = Object.hasOwn(presets, crew?.theme ?? '') ? handlesOf(presets[crew.theme].names[role]) : [];
  if (preset.length) return preset;
  return [slice ?? role];
}

/** The first name of the pool not in `used`; a pool run out starts again with `-2`, then `-3`. */
function nextName(pool, used) {
  for (let round = 1; ; round += 1) {
    const free = pool.map((n) => (round === 1 ? n : `${n}-${round}`)).find((n) => !used.includes(n));
    if (free !== undefined) return free;
  }
}

/** Whether `slice` is one of the effort's slice ids, `<effort>-<nn>`. */
const isSliceOf = (effort, slice) =>
  slice.length === effort.length + 3 && slice.startsWith(`${effort}-`) && /^\d{2}$/.test(slice.slice(-2));

/** `{ role, project, effort, slice }`, or null on bad usage. */
function usageOf(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: { project: { type: 'string' }, effort: { type: 'string' }, slice: { type: 'string' } },
    });
  } catch {
    return null;
  }
  const { positionals, values } = parsed;
  const [role] = positionals;
  if (positionals.length !== 1 || !ROLES.includes(role) || !values.project || !values.effort) return null;
  if (values.slice !== undefined && (role !== 'implementer' || !isSliceOf(values.effort, values.slice))) return null;
  return { role, ...values };
}

function main(argv) {
  const usage = usageOf(argv);
  if (!usage) {
    process.stderr.write(USAGE);
    return 2;
  }
  const { role, effort, slice } = usage;
  const dir = path.resolve(usage.project);
  const state = readState(dir);
  const record = state?.efforts && Object.hasOwn(state.efforts, effort) ? state.efforts[effort] : undefined;
  const member = slice ? record?.slices?.[slice]?.member : undefined;
  if (member) {
    process.stdout.write(`${member}\n`);
    return 0;
  }
  const used = record?.crew?.[role] ?? [];
  const pick = nextName(poolOf(readHostConfig(dir)?.crew, role, slice), used);
  if (record) {
    record.crew = { ...record.crew, [role]: [...used, pick] };
    if (slice) record.slices = { ...record.slices, [slice]: { ...record.slices?.[slice], member: pick } };
    record.updatedAt = new Date().toISOString();
    writeState(dir, state);
  }
  process.stdout.write(`${pick}\n`);
  return 0;
}

// Run only as a script: a test imports `handleOf` without running it.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
