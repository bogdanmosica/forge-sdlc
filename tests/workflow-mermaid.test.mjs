// bin/workflow.mjs --mermaid at its process boundary: Mermaid A (the prototype's look, from
// docs/research/workflow-as-code/diagram-prototype/run.mjs) drawn from the resolved workflow over
// fixture hosts, positioned from .forge/state.json under --effort, and the README's diagram held
// equal to the command on a host with no settings (docs/efforts/workflow-as-code/spec.md, Mermaid A).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeState } from '../plugins/forge-sdlc/hooks/scripts/lib.mjs';
import { host } from './support/host.mjs';
import { EDGE_LABEL_MAX, mermaidOf } from '../plugins/forge-sdlc/bin/workflow.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'plugins', 'forge-sdlc', 'bin', 'workflow.mjs');

/** forge.md with Branches only: no ## Gates, so the defaults hold. */
const BRANCHES_ONLY = ['# forge-sdlc host config', '', '## Branches', '- default: main', ''].join('\n');

/** A host with this forge.md (default: Branches only) and, when given, this forge.yaml text. */
function mermaidHost({ config = BRANCHES_ONLY, yaml } = {}) {
  const { dir } = host({ config });
  if (yaml !== undefined) writeFileSync(path.join(dir, 'docs', 'agents', 'forge.yaml'), yaml);
  return dir;
}

const run = (args, cwd) => spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', timeout: 10_000 });

/** The Mermaid printed for `args` on `dir`, exit 0. */
function mermaid(dir, args = []) {
  const r = run(['--mermaid', '--project', dir, ...args], dir);
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}

/** The line defining node `id` (a box or a hexagon). */
const nodeLine = (out, id) => out.split('\n').find((l) => new RegExp(`^\\s*${id}(\\[|\\{\\{)`).test(l));
/** The line of the edge leaving gate `id`. */
const passEdge = (out, id) => out.split('\n').find((l) => new RegExp(`^\\s*${id} (-->|==>)`).test(l));

test('on a host with no settings: flowchart TD, a box per stage with its roles and models, a hexagon per gate, every gate passed on a thick edge', () => {
  const out = mermaid(mermaidHost());
  assert.match(out, /^(%%.*\n)*flowchart TD\n/);
  for (const stage of ['map', 'intent', 'spec', 'plan', 'build', 'built']) assert.ok(nodeLine(out, stage), `a box for ${stage}`);
  assert.match(nodeLine(out, 'map'), /^\s*map\["1 · map<br\/>the map and its tickets, worked with the owner<br\/>researcher · [^<"]+<br\/>prototyper · [^<"]+"\]$/);
  assert.match(nodeLine(out, 'build'), /implementer · [^<"]+<br\/>verifier · [^<"]+<br\/>reviewer · [^<"]+<br\/>merger · [^<"]+"\]$/);
  assert.equal(nodeLine(out, 'G1').trim(), 'G1{{"Gate 1 · attended · default"}}:::gattended');
  assert.equal(nodeLine(out, 'G4').trim(), 'G4{{"Gate 4 · owner"}}:::gowner');
  assert.match(out, /^\s*intent --> G1$/m);
  assert.equal(passEdge(out, 'G1').trim(), 'G1 ==>|"you pass it"| spec');
  assert.equal(passEdge(out, 'G3').trim(), 'G3 ==>|"you pass it"| build');
  assert.equal(passEdge(out, 'G4').trim(), 'G4 ==>|"code owner reviews, merges"| built');
  assert.doesNotMatch(out, /:::(passed|current|stopped)\b/, 'unpositioned: no position classes on any node');
});

test('a policy gate passes on a thin edge labelled with its stops; an attended gate names its source; a swapped role shows ⇄ and its agent', () => {
  const dir = mermaidHost({
    yaml: ['version: 1', 'roles:', '  reviewer:', '    agent: other:critic', 'workflow:', '  policy: autonomous', '  gates:', '    plan: attended', ''].join('\n'),
  });
  const out = mermaid(dir);
  assert.equal(nodeLine(out, 'G1').trim(), 'G1{{"Gate 1 · policy"}}:::gpolicy');
  assert.equal(passEdge(out, 'G1').trim(), 'G1 -->|"passes unless open · risk-high"| spec');
  assert.equal(passEdge(out, 'G2').trim(), 'G2 -->|"passes unless open · flagged · risk-high"| plan', 'Gate 2 alone lists flagged');
  assert.equal(nodeLine(out, 'G3').trim(), 'G3{{"Gate 3 · attended · gates.plan in forge.yaml"}}:::gattended');
  assert.equal(passEdge(out, 'G3').trim(), 'G3 ==>|"you pass it"| build');
  assert.match(nodeLine(out, 'build'), /<br\/>reviewer ⇄ other:critic<br\/>/);
  assert.match(out, /^%% policy autonomous$/m);
});

const PLAN_ATTENDED = ['version: 1', 'workflow:', '  policy: autonomous', '  gates:', '    plan: attended', ''].join('\n');

test('gates.plan attended and an effort stopped at plan (stop: attended): Gate 3 stopped naming gates.plan in forge.yaml, the stages before it passed', () => {
  const dir = mermaidHost({ yaml: PLAN_ATTENDED });
  writeState(dir, { efforts: { demo: { stage: 'plan', gate: 'plan', stop: 'attended', risk: 'normal', branch: 'feat/demo' } } });
  const out = mermaid(dir, ['--effort', 'demo']);
  assert.equal(nodeLine(out, 'G3').trim(), 'G3{{"■ Gate 3 · attended · gates.plan in forge.yaml<br/>STOPPED: attended"}}:::stopped');
  for (const stage of ['map', 'intent', 'spec']) assert.match(nodeLine(out, stage), /:::passed$/, stage);
  assert.match(nodeLine(out, 'spec'), /^\s*spec\["✓ 3 · spec<br\/>/);
  assert.match(nodeLine(out, 'plan'), /^\s*plan\["▶ 4 · plan<br\/>.*"\]:::current$/);
  for (const stage of ['build', 'built']) assert.match(nodeLine(out, stage), /:::ahead$/, stage);
  assert.equal(nodeLine(out, 'G1').trim(), 'G1{{"✓ Gate 1 · policy"}}:::passed');
  assert.equal(nodeLine(out, 'G2').trim(), 'G2{{"✓ Gate 2 · policy"}}:::passed');
  assert.equal(nodeLine(out, 'G4').trim(), 'G4{{"Gate 4 · owner"}}:::gowner');
  assert.match(out, /^%% demo: at plan, stopped \(attended\) · policy autonomous · risk normal$/m);
});

test('a risk: high effort draws every gate before Gate 4 attended (source risk: high) on a thick edge', () => {
  const dir = mermaidHost({ yaml: PLAN_ATTENDED });
  writeState(dir, { efforts: { hot: { stage: 'intent', gate: 'none', stop: 'none', risk: 'high', branch: 'feat/hot' } } });
  const out = mermaid(dir, ['--effort', 'hot']);
  for (const [id, next] of [['G1', 'spec'], ['G2', 'plan'], ['G3', 'build']]) {
    assert.match(nodeLine(out, id), /Gate \d · attended · risk: high"\}\}:::gattended$/, id);
    assert.equal(passEdge(out, id).trim(), `${id} ==>|"you pass it"| ${next}`);
  }
  assert.match(nodeLine(out, 'intent'), /:::current$/);
});

test('--effort with no state record draws the loop unpositioned, as without --effort', () => {
  const dir = mermaidHost({ yaml: PLAN_ATTENDED });
  assert.equal(mermaid(dir, ['--effort', 'ghost']), mermaid(dir));
  writeState(dir, { efforts: { other: { stage: 'spec', gate: 'spec', stop: 'open', risk: 'normal', branch: 'feat/other' } } });
  const out = mermaid(dir, ['--effort', 'ghost']);
  assert.equal(out, mermaid(dir));
  assert.doesNotMatch(out, /:::(passed|current|ahead|stopped)$/m);
});

/** The resolved workflow's JSON for `dir`, as `workflow.mjs` prints it. */
function resolved(dir) {
  const r = run(['--project', dir], dir);
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

test('each role line names the model the roster resolves, as it resolves it, not shortened', () => {
  const plain = mermaidHost();
  const tuned = mermaidHost({
    yaml: ['version: 1', 'roles:', '  implementer:', '    model: claude-sonnet-5-5', '  reviewer:', '    agent: other:critic', '    model: haiku', ''].join('\n'),
  });
  for (const dir of [plain, tuned]) {
    const out = mermaid(dir);
    for (const stage of resolved(dir).stages) {
      for (const r of stage.roles) {
        const line = `${r.swapped ? `${r.role} ⇄ ${r.agent}` : r.role}${r.model ? ` · ${r.model}` : ''}`;
        assert.ok(nodeLine(out, stage.name).includes(`<br/>${line}`), `${stage.name} names ${line}`);
      }
    }
  }
  const out = mermaid(tuned);
  assert.match(nodeLine(out, 'build'), /<br\/>implementer · claude-sonnet-5-5<br\/>/);
  assert.match(nodeLine(out, 'build'), /<br\/>reviewer ⇄ other:critic · haiku<br\/>/);
  assert.match(nodeLine(mermaid(plain), 'map'), /<br\/>researcher · claude-[\w-]+<br\/>/, 'a plugin agent\'s frontmatter id, whole');
});

test('an effort waiting at a gate (gate set, stop none) marks that gate current with ▶', () => {
  const dir = mermaidHost({ yaml: PLAN_ATTENDED });
  writeState(dir, { efforts: { demo: { stage: 'spec', gate: 'spec', stop: 'none', risk: 'normal', branch: 'feat/demo' } } });
  const out = mermaid(dir, ['--effort', 'demo']);
  assert.equal(nodeLine(out, 'G2').trim(), 'G2{{"▶ Gate 2 · policy"}}:::current');
  assert.equal(nodeLine(out, 'G1').trim(), 'G1{{"✓ Gate 1 · policy"}}:::passed');
  assert.equal(nodeLine(out, 'G3').trim(), 'G3{{"Gate 3 · attended · gates.plan in forge.yaml"}}:::gattended');
  assert.match(out, /^%% demo: at spec · policy autonomous · risk normal$/m);
});

/** A one-stage workflow for mermaidOf, with this `does` text and effort record. */
const oneStage = (does, effort) => ({ policy: 'autonomous', effort, stages: [{ name: 'map', does, roles: [], gate: null }] });

test('mermaidOf escapes ", < and > inside a label', () => {
  const out = mermaidOf(oneStage('say "hi" <b>bold</b> & go'));
  assert.equal(nodeLine(out, 'map').trim(), 'map["1 · map<br/>say #quot;hi#quot; &lt;b&gt;bold&lt;/b&gt; & go"]');
});

test('an effort slug is filtered to slug characters in the %% comment, so it cannot open a line of its own', () => {
  const out = mermaidOf(oneStage('d', { slug: 'x\nflowchart LR\n"y"', stage: 'map', stop: 'none', risk: 'normal' }));
  const lines = out.split('\n');
  assert.equal(lines.filter((l) => l.startsWith('flowchart')).length, 1);
  assert.equal(lines[2], '%% xflowchartLRy: at map · policy autonomous · risk normal');
});

/** Every line of Mermaid A is one of these: the init line, the header, a comment, a box, a hexagon, a plain or thick edge, a classDef. */
const LINE_FORMS = [
  /^%%\{init: \{"flowchart": \{"wrappingWidth": 320\}\}\}%%$/,
  /^flowchart TD$/,
  /^%% [^\n]*$/,
  /^ {2}\w+\["[^"]*"\](:::\w+)?$/,
  /^ {2}G\d\{\{"[^"]*"\}\}:::\w+$/,
  /^ {2}\w+ --> \w+$/,
  /^ {2}G\d (-->|==>)\|"[^"]*"\| \w+$/,
  /^ {2}classDef \w+ [\w:#,.\- ]+$/,
];
/** The only markup inside a label: <br/>; the rest is escaped. */
const LABEL_MARKUP = /<(?!br\/>)|(?<!<br\/)>/;

test('only {{ }}, ==>, :::, <br/> and plain edges, and no edge label over the prototype\'s wrap length, on every kind of host', () => {
  const hosts = [
    { dir: mermaidHost() },
    { dir: mermaidHost({ yaml: ['version: 1', 'workflow:', '  policy: autonomous', ''].join('\n') }) },
    { dir: mermaidHost({ yaml: ['version: 1', 'workflow:', '  policy: attended', '  gates:', '    intent: policy', '    spec: policy', ''].join('\n') }) },
    { dir: mermaidHost({ config: [BRANCHES_ONLY, '## Gates', '- policy: attended', '- spec: only-on-open', ''].join('\n') }) },
    { dir: mermaidHost({ yaml: PLAN_ATTENDED }), state: { stage: 'plan', gate: 'plan', stop: 'attended', risk: 'normal' } },
    { dir: mermaidHost({ yaml: PLAN_ATTENDED }), state: { stage: 'spec', gate: 'spec', stop: 'flagged', risk: 'normal' } },
    { dir: mermaidHost(), state: { stage: 'build', gate: 'none', stop: 'none', risk: 'high' } },
  ];
  for (const { dir, state } of hosts) {
    if (state) writeState(dir, { efforts: { demo: { ...state, branch: 'feat/demo' } } });
    const out = mermaid(dir, state ? ['--effort', 'demo'] : []);
    for (const line of out.trimEnd().split('\n')) {
      assert.ok(LINE_FORMS.some((form) => form.test(line)), `not a known form: ${line}`);
      for (const [, label] of line.matchAll(/"([^"]*)"/g)) assert.doesNotMatch(label, LABEL_MARKUP, line);
    }
    const labels = [...out.matchAll(/^ {2}G\d (?:-->|==>)\|"([^"]*)"\|/gm)].map((m) => m[1]);
    assert.equal(labels.length, 4);
    for (const label of labels) assert.ok(label.length <= EDGE_LABEL_MAX, `edge label over ${EDGE_LABEL_MAX} characters: ${label}`);
  }
});

test('--mermaid with --gate, --effort without --mermaid and an empty --effort are bad usage: exit 2, usage on stderr', () => {
  const dir = mermaidHost();
  for (const args of [['--mermaid', '--gate', 'plan'], ['--effort', 'demo'], ['--mermaid', '--effort', '']]) {
    const r = run([...args, '--project', dir], dir);
    assert.equal(r.status, 2, args.join(' '));
    assert.equal(r.stdout, '');
    assert.match(r.stderr, /^usage: workflow\.mjs .*--mermaid \[--effort <slug>\]/);
  }
});

test('the README\'s Mermaid block equals --mermaid on a host with no forge.yaml and no ## Gates', () => {
  const readme = readFileSync(path.join(root, 'README.md'), 'utf8');
  const blocks = [...readme.matchAll(/^\`\`\`mermaid\n([\s\S]*?)^\`\`\`$/gm)].map((m) => m[1]);
  assert.equal(blocks.length, 1, 'one Mermaid block in the README');
  assert.equal(blocks[0], mermaid(mermaidHost()), 'regenerate it with: node plugins/forge-sdlc/bin/workflow.mjs --mermaid on a host with no settings');
});
