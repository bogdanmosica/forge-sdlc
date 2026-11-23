#!/usr/bin/env node
// A host's roster: `node bin/roster.mjs <slot> --project <host>` prints one line, the skill that
// fills the slot or `disabled` (for `policy`, the skill names comma-separated or `none`);
// `node bin/roster.mjs --project <host>` prints the resolved roster as JSON with its `problems`.
// Without docs/agents/forge.yaml it prints the defaults. Exit 0; 2 on bad usage.

import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { SLOT_NAMES } from '../hooks/roster.mjs';
import { readRoster } from '../hooks/scripts/lib.mjs';

const USAGE = `usage: roster.mjs [<slot>] --project <host>; slot: ${SLOT_NAMES.join(', ')}\n`;

/** `{ slot, project }` (slot undefined for the JSON form), or null on bad usage. */
function usageOf(argv) {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, allowPositionals: true, options: { project: { type: 'string' } } });
  } catch {
    return null;
  }
  const { positionals, values } = parsed;
  const [slot] = positionals;
  if (positionals.length > 1 || !values.project) return null;
  if (slot !== undefined && !SLOT_NAMES.includes(slot)) return null;
  return { slot, project: values.project };
}

function main(argv) {
  const usage = usageOf(argv);
  if (!usage) {
    process.stderr.write(USAGE);
    return 2;
  }
  const roster = readRoster(path.resolve(usage.project));
  if (usage.slot === undefined) {
    process.stdout.write(`${JSON.stringify(roster, null, 2)}\n`);
    return 0;
  }
  const value = usage.slot === 'policy' ? roster.policy.join(',') || 'none' : roster.slots[usage.slot];
  process.stdout.write(`${value}\n`);
  return 0;
}

// Run only as a script.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
