#!/usr/bin/env node
// A host's loop: `node bin/workflow.mjs [--project <host>]` prints the resolved workflow (the
// plugin's workflow.yaml, the host's workflow: knobs in docs/agents/forge.yaml and its roster) as
// JSON with its `problems`; `--gate <intent|spec|plan|pr>` prints that gate's
// `{ key, n, mode, source, stops }`. --project defaults to the cwd. Reads only. Exit 0; 2 on bad usage.

import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { readWorkflow } from '../hooks/scripts/lib.mjs';

const GATES = ['intent', 'spec', 'plan', 'pr'];
const USAGE = `usage: workflow.mjs [--gate <${GATES.join('|')}>] [--project <host>]\n`;

/** `{ gate, project }` (gate undefined for the JSON form), or null on bad usage. */
function usageOf(argv) {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, options: { project: { type: 'string' }, gate: { type: 'string' } } });
  } catch {
    return null;
  }
  const { gate, project = process.cwd() } = parsed.values;
  if (gate !== undefined && !GATES.includes(gate)) return null;
  return { gate, project };
}

function main(argv) {
  const usage = usageOf(argv);
  if (!usage) {
    process.stderr.write(USAGE);
    return 2;
  }
  const workflow = readWorkflow(path.resolve(usage.project));
  if (usage.gate === undefined) {
    process.stdout.write(`${JSON.stringify(workflow, null, 2)}\n`);
    return 0;
  }
  const { key, n, mode, source, stops } = workflow.stages.find((s) => s.gate?.key === usage.gate).gate;
  process.stdout.write(`${JSON.stringify({ key, n, mode, source, stops }, null, 2)}\n`);
  return 0;
}

// Run only as a script.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
