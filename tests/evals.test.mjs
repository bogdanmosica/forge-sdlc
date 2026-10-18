// The `claude plugin eval` suites under plugins/forge-sdlc/evals/ hold together without a model
// call: every case and grader parses into the engine's fields, every fixture it references exists,
// every scaffold builds its host, and each guardrail case's hook, run against that host, returns
// the decision the case grades (its reason matched by the case's own hook-* grader).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { accessSync, constants, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { plugin } from './support/upstream.mjs';

const evals = path.join(plugin, 'evals');
const SUITES = ['triggering', 'guardrails', 'frame', 'upstream'];
const READ_ONLY_TOOLS = new Set(['Read', 'Glob', 'Grep', 'NotebookRead', 'Skill', 'AskUserQuestion', 'Agent', 'TodoWrite', 'TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TaskStop']);
/** Gated: a case names them in allowed_tools, and the run grants them with --allow-tools (README, Evals). */
const GATED_TOOLS = new Set(['Bash', 'Write', 'Edit']);
const CASE_KEYS = new Set(['schema_version', 'name', 'description', 'tags', 'plugins', 'runs', 'expected_outcome', 'context', 'execution', 'graders']);
const GRADER_TYPES = new Set(['regex', 'tool_used', 'tool_order', 'file_exists', 'llm', 'baseline']);

/* A strict YAML subset: block maps by indentation, quoted or plain scalars, flow lists and flow maps. */

function splitFlow(body) {
  const parts = [];
  let cur = '';
  let quote = null;
  for (const ch of body) {
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') quote = ch;
    else if (ch === ',') {
      parts.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function scalar(raw) {
  const v = raw.trim();
  if (v.startsWith('[')) {
    assert.ok(v.endsWith(']'), `unclosed flow list: ${v}`);
    return splitFlow(v.slice(1, -1)).map(scalar);
  }
  if (v.startsWith('{')) {
    assert.ok(v.endsWith('}'), `unclosed flow map: ${v}`);
    return Object.fromEntries(splitFlow(v.slice(1, -1)).map((p) => {
      const m = /^([\w-]+):\s+(.*)$/.exec(p);
      assert.ok(m, `bad flow map entry: ${p}`);
      return [m[1], scalar(m[2])];
    }));
  }
  if (v.startsWith("'")) {
    assert.match(v, /^'(?:[^']|'')*'$/, `bad single-quoted scalar: ${v}`);
    return v.slice(1, -1).replaceAll("''", "'");
  }
  if (v.startsWith('"')) return JSON.parse(v);
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (v === 'true' || v === 'false') return v === 'true';
  assert.doesNotMatch(v, /: | #|^[&*!|>%@`]/, `plain scalar needs quotes: ${v}`);
  return v;
}

function parseYaml(text) {
  const root = {};
  const stack = [{ indent: -1, map: root }];
  for (const line of text.split('\n')) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const m = /^( *)([\w-]+):(?: (.*))?$/.exec(line);
    assert.ok(m, `line outside the YAML subset: ${line}`);
    const [, spaces, key, value] = m;
    while (spaces.length <= stack.at(-1).indent) stack.pop();
    const { map } = stack.at(-1);
    assert.ok(!(key in map), `duplicate key: ${key}`);
    if (value === undefined || value.trim() === '') {
      map[key] = {};
      stack.push({ indent: spaces.length, map: map[key] });
    } else map[key] = scalar(value);
  }
  return root;
}

const frontmatter = (text) => {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  assert.ok(m, 'no frontmatter');
  return parseYaml(m[1]);
};

/* The suite on disk */

const dirs = (dir) => readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

const cases = SUITES.flatMap((suite) =>
  dirs(path.join(evals, suite)).map((name) => {
    const dir = path.join(evals, suite, name);
    const yaml = parseYaml(readFileSync(path.join(dir, 'case.yaml'), 'utf8'));
    const graderDir = path.join(dir, 'graders');
    const graders = Object.fromEntries(
      (existsSync(graderDir) ? readdirSync(graderDir) : [])
        .filter((f) => f.endsWith('.md'))
        .map((f) => [f.slice(0, -3), frontmatter(readFileSync(path.join(graderDir, f), 'utf8'))]),
    );
    return { suite, name, dir, yaml, graders };
  }),
);

const regexOf = (g) => new RegExp(g.pattern, g.flags ?? '');

test('the four suites of design section 12 each hold a case', () => {
  for (const suite of SUITES) assert.ok(cases.some((c) => c.suite === suite), suite);
});

test('every case.yaml parses into the engine case fields, and its plugin path is this plugin', () => {
  for (const c of cases) {
    const { yaml } = c;
    for (const key of Object.keys(yaml)) assert.ok(CASE_KEYS.has(key), `${c.name}: unknown key ${key}`);
    assert.equal(yaml.schema_version, '1.1', c.name);
    assert.equal(yaml.name, c.name);
    assert.ok(yaml.tags.includes(c.suite), `${c.name}: tagged with its suite`);
    assert.deepEqual(yaml.plugins.map((p) => path.resolve(c.dir, p)), [plugin], c.name);
    const ex = yaml.execution;
    assert.ok(typeof ex.prompt === 'string' && ex.prompt.length > 0, `${c.name}: prompt`);
    assert.ok(ex.max_turns >= 1 && ex.max_turns <= 200, `${c.name}: max_turns`);
    assert.ok(ex.timeout_seconds >= 1 && ex.timeout_seconds <= 3600, `${c.name}: timeout_seconds`);
    for (const tool of ex.allowed_tools) assert.ok(READ_ONLY_TOOLS.has(tool) || GATED_TOOLS.has(tool), `${c.name}: unknown tool ${tool}`);
    assert.ok(yaml.runs >= 1 && yaml.runs <= 50, `${c.name}: runs`);
  }
});

test('every case has graders, each of a known type whose regexes compile', () => {
  for (const c of cases) {
    assert.ok(Object.keys(c.graders).length > 0, `${c.name}: no grader`);
    for (const [name, g] of Object.entries(c.graders)) {
      const where = `${c.name}/${name}`;
      assert.ok(GRADER_TYPES.has(g.type), `${where}: type ${g.type}`);
      if (g.arm !== undefined) assert.ok(['both', 'with-only'].includes(g.arm), `${where}: arm`);
      if (g.type === 'regex') {
        regexOf(g);
        assert.ok(g.match === undefined || /^(contains|not_contains|count:\d+)$/.test(g.match), `${where}: match`);
        const t = g.target ?? 'last_message';
        assert.ok(['last_message', 'trace', 'files', 'mock_calls'].includes(t) || (t.source === 'file' && t.path), `${where}: target`);
      }
      if (g.type === 'tool_used') {
        assert.ok(g.tool, `${where}: tool`);
        if (g.max !== 0) assert.ok(c.yaml.execution.allowed_tools.includes(g.tool), `${where}: ${g.tool} is not in allowed_tools`);
        if (g.input_match) new RegExp(g.input_match);
      }
      if (g.type === 'file_exists') assert.ok(g.path, `${where}: path`);
    }
  }
});

test('every scaffold exists, is executable, and sources lib/host.sh', () => {
  for (const c of cases) {
    const file = path.join(c.dir, c.yaml.context.scaffold_script);
    accessSync(file, constants.X_OK);
    assert.match(readFileSync(file, 'utf8'), /source "\$\(dirname "\$\{BASH_SOURCE\[0\]\}"\)\/\.\.\/\.\.\/lib\/host\.sh"/, c.name);
  }
});

test('the fixture effort holds every artifact and one local ticket per plan row', () => {
  const effort = path.join(evals, 'fixtures', 'word-count');
  for (const f of ['map.md', 'intent.md', 'spec.md', 'plan.md', 'PR.md']) assert.ok(existsSync(path.join(effort, f)), f);
  const rows = [...readFileSync(path.join(effort, 'plan.md'), 'utf8').matchAll(/^\| (\d\d) \|/gm)].map((m) => m[1]);
  assert.deepEqual(rows, ['01', '02', '03']);
  const tickets = readdirSync(path.join(effort, 'issues')).sort();
  assert.deepEqual(tickets.map((t) => t.slice(0, 2)), rows);
  const lib = readFileSync(path.join(evals, 'lib', 'host.sh'), 'utf8');
  for (const t of tickets) assert.ok(lib.includes(`issues/${t}`), `state() points at ${t}`);
});

test('every forge-sdlc command has a triggering case that fires it', () => {
  for (const skill of dirs(path.join(plugin, 'skills'))) {
    const c = cases.find((k) => k.name === `${skill}-fires`);
    assert.ok(c, `triggering/${skill}-fires`);
    assert.equal(c.suite, 'triggering');
  }
});

/* Scaffolds and hooks, as the engine runs them */

const UPSTREAM_ROOT = process.env.MATTPOCOCK_SKILLS_ROOT;
const needsUpstream = (c) => /^upstream$/m.test(readFileSync(path.join(c.dir, 'fixture.sh'), 'utf8'));

/** Run a case's scaffold in an empty workspace with the scaffold's minimal env; the workspace path. */
function scaffold(c) {
  const base = mkdtempSync(path.join(tmpdir(), 'forge-eval-'));
  const work = path.join(base, 'work');
  const home = path.join(base, 'home');
  mkdirSync(work);
  mkdirSync(home);
  const env = { PATH: process.env.PATH, HOME: home, TMPDIR: tmpdir(), TERM: 'dumb' };
  if (UPSTREAM_ROOT) env.MATTPOCOCK_SKILLS_ROOT = UPSTREAM_ROOT;
  const r = spawnSync('bash', [path.join(c.dir, 'fixture.sh')], { cwd: work, env, encoding: 'utf8' });
  assert.equal(r.status, 0, `${c.name}: scaffold failed: ${r.stderr}`);
  return { work, base };
}

test('every scaffold builds its host (an upstream one when MATTPOCOCK_SKILLS_ROOT is set)', (t) => {
  for (const c of cases) {
    if (needsUpstream(c) && !UPSTREAM_ROOT) {
      t.diagnostic(`${c.name}: skipped, MATTPOCOCK_SKILLS_ROOT unset`);
      continue;
    }
    const { work } = scaffold(c);
    assert.equal(spawnSync('git', ['status', '--porcelain'], { cwd: work }).status, 0, c.name);
  }
});

const resolvePayload = (payload, work) => {
  const p = structuredClone(payload);
  p.cwd = work;
  if (p.tool_input?.file_path) p.tool_input.file_path = path.join(work, p.tool_input.file_path);
  return p;
};

/** The decision's kind and its text: deny reason, block reason, or systemMessage. */
function decisionOf(out) {
  if (out.hookSpecificOutput?.permissionDecision === 'deny') return ['deny', out.hookSpecificOutput.permissionDecisionReason];
  if (out.decision === 'block') return ['block', out.reason];
  if (out.systemMessage) return ['message', out.systemMessage];
  return ['allow', ''];
}

test('every hook script has a guardrails case, and each case hook decides what the case grades', () => {
  const guardrails = cases.filter((c) => c.suite === 'guardrails');
  const covered = new Set();
  for (const c of guardrails) {
    const seam = JSON.parse(readFileSync(path.join(c.dir, 'seam.json'), 'utf8'));
    covered.add(seam.script);
    const { work, base } = scaffold(c);
    const env = { ...process.env, CLAUDE_PROJECT_DIR: work, CLAUDE_CONFIG_DIR: path.join(base, 'config') };
    delete env.MATTPOCOCK_SKILLS_ROOT;
    const r = spawnSync(process.execPath, [path.join(plugin, 'hooks', 'scripts', seam.script)], {
      cwd: work,
      env,
      input: JSON.stringify(resolvePayload(seam.payload, work)),
      encoding: 'utf8',
    });
    assert.equal(r.status, 0, `${c.name}: ${r.stderr}`);
    const [kind, text] = decisionOf(JSON.parse(r.stdout));
    assert.equal(kind, seam.expect, `${c.name}: ${r.stdout}`);
    for (const [name, g] of Object.entries(c.graders)) {
      if (name.startsWith('hook-')) assert.match(text, regexOf(g), `${c.name}/${name}`);
    }
    if (seam.effect) assert.match(readFileSync(path.join(work, seam.effect.path), 'utf8'), new RegExp(seam.effect.pattern, 'm'), `${c.name}: effect`);
  }
  const scripts = readdirSync(path.join(plugin, 'hooks', 'scripts')).filter((f) => f.endsWith('.mjs') && f !== 'lib.mjs');
  assert.deepEqual([...covered].sort(), scripts.sort());
});
