#!/usr/bin/env node
// A host's loop: `node bin/workflow.mjs [--project <host>]` prints the resolved workflow (the
// plugin's workflow.yaml, the host's workflow: knobs in docs/agents/forge.yaml and its roster) as
// JSON with its `problems`; `--gate <intent|spec|plan|pr>` prints that gate's
// `{ key, n, mode, source, stops }`; `--mermaid [--effort <slug>]` prints the loop as a Mermaid
// flowchart (Mermaid A), positioned from the effort's record in .forge/state.json when there is one.
// --project defaults to the cwd. Reads only. Exit 0; 2 on bad usage; 1, the error on stderr, when
// --effort meets a .forge/state.json that is not JSON.

import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { readWorkflow } from '../hooks/scripts/lib.mjs';

const GATES = ['intent', 'spec', 'plan', 'pr'];
const USAGE = `usage: workflow.mjs [--gate <${GATES.join('|')}> | --mermaid [--effort <slug>]] [--project <host>]\n`;

/** `{ gate, mermaid, effort, project }` (gate undefined unless --gate), or null on bad usage. */
function usageOf(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: { project: { type: 'string' }, gate: { type: 'string' }, mermaid: { type: 'boolean' }, effort: { type: 'string' } },
    });
  } catch {
    return null;
  }
  const { gate, mermaid = false, effort, project = process.cwd() } = parsed.values;
  if (gate !== undefined && !GATES.includes(gate)) return null;
  if (mermaid && gate !== undefined) return null;
  if (effort !== undefined && (!mermaid || !effort)) return null;
  return { gate, mermaid, effort, project };
}

function main(argv) {
  const usage = usageOf(argv);
  if (!usage) {
    process.stderr.write(USAGE);
    return 2;
  }
  const workflow = readWorkflow(path.resolve(usage.project), usage.effort);
  if (usage.mermaid) {
    process.stdout.write(`${mermaidOf(workflow)}\n`);
    return 0;
  }
  if (usage.gate === undefined) {
    process.stdout.write(`${JSON.stringify(workflow, null, 2)}\n`);
    return 0;
  }
  const { key, n, mode, source, stops } = workflow.stages.find((s) => s.gate?.key === usage.gate).gate;
  process.stdout.write(`${JSON.stringify({ key, n, mode, source, stops }, null, 2)}\n`);
  return 0;
}

// ---- Mermaid A: one top-down chain, the prototype's look (diagram-prototype/run.mjs, mermaidA) ----
// Only long-standing syntax: boxes, {{ }} hexagons, --> and ==> edges, :::class and <br/>.

/** The longest edge label, in characters: the prototype's longest, drawn on one line at its wrappingWidth 320. */
export const EDGE_LABEL_MAX = 40;

/** An effort slug kept to slug characters, so the %% comment it heads stays one line. */
const slugText = (s) => String(s).replace(/[^\w.-]/g, '');

/** Text safe inside a quoted Mermaid label. */
const esc = (s) => String(s).replace(/"/g, '#quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A role as its box names it: the role (`⇄` and the agent when swapped) and the model the roster resolves, as it resolves it. */
const roleLine = (r) => {
  const model = r.model ? ` · ${r.model}` : '';
  return r.swapped ? `${r.role} ⇄ ${r.agent}${model}` : `${r.role}${model}`;
};

const STAGE_MARK = { passed: '✓ ', current: '▶ ' };
const GATE_MARK = { passed: '✓ ', waiting: '▶ ', stopped: '■ ' };

/** A gate's mode as its hexagon names it: an attended gate names where that came from. */
const modeText = (g) => (g.mode === 'attended' ? `attended · ${g.source}` : g.mode);

/** The label of the edge a gate passes by. */
function passLabel(g) {
  if (g.mode === 'policy') return `passes unless ${g.stops.filter((s) => s !== 'attended').join(' · ')}`;
  return g.mode === 'owner' ? 'code owner reviews, merges' : 'you pass it';
}

/** A gate's class: its position when it has one, else who passes it. */
function gateClass(g) {
  if (g.status === 'stopped') return 'stopped';
  if (g.status === 'passed') return 'passed';
  if (g.status === 'waiting') return 'current';
  return g.mode === 'policy' ? 'gpolicy' : g.mode === 'attended' ? 'gattended' : 'gowner';
}

const CLASSDEFS = [
  'classDef passed fill:#dafbe1,stroke:#1a7f37,color:#1f2328',
  'classDef current fill:#ddf4ff,stroke:#0969da,stroke-width:3px,color:#1f2328',
  'classDef ahead fill:#f6f8fa,stroke:#8c959f,color:#1f2328',
  'classDef gpolicy fill:#ffffff,stroke:#1a7f37,color:#1f2328',
  'classDef gattended fill:#ffffff,stroke:#9a6700,stroke-dasharray:4 3,color:#1f2328',
  'classDef gowner fill:#ffebe9,stroke:#cf222e,color:#1f2328',
  'classDef stopped fill:#fff8c5,stroke:#bf8700,stroke-width:3px,color:#1f2328',
];

/** The resolved workflow (readWorkflow's result) as Mermaid A, one line per statement. */
export function mermaidOf(workflow) {
  const { stages, effort } = workflow;
  const where = effort ? `${slugText(effort.slug)}: at ${effort.stage}${effort.stop !== 'none' ? `, stopped (${effort.stop})` : ''} · ` : '';
  const out = [
    '%%{init: {"flowchart": {"wrappingWidth": 320}}}%%',
    'flowchart TD',
    `%% ${where}policy ${workflow.policy}${effort ? ` · risk ${effort.risk}` : ''}`,
  ];
  stages.forEach((s, i) => {
    const head = `${STAGE_MARK[s.status] ?? ''}${i + 1} · ${s.name}`;
    const label = [head, s.does, ...s.roles.map(roleLine)].map(esc).join('<br/>');
    out.push(`  ${s.name}["${label}"]${s.status ? `:::${s.status}` : ''}`);
    const next = stages[i + 1];
    if (!s.gate || !next) return;
    const g = s.gate;
    const id = `G${g.n}`;
    const lines = [`${GATE_MARK[g.status] ?? ''}Gate ${g.n} · ${modeText(g)}`];
    if (g.status === 'stopped') lines.push(`STOPPED: ${effort.stop}`);
    out.push(`  ${id}{{"${lines.map(esc).join('<br/>')}"}}:::${gateClass(g)}`);
    out.push(`  ${s.name} --> ${id}`);
    out.push(`  ${id} ${g.mode === 'policy' ? '-->' : '==>'}|"${esc(passLabel(g))}"| ${next.name}`);
  });
  return [...out, ...CLASSDEFS.map((d) => `  ${d}`)].join('\n');
}

// Run only as a script.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
