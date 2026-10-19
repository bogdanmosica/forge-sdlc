#!/usr/bin/env node
// Where an effort stands and which command runs next: `node bin/effort-state.mjs [host-dir] <slug>`
// prints `{ slug, stage, gate, next, why, source, policy, stop }`; `--list [host-dir]` prints every effort as an array.
// One argument is the slug, the host is cwd. Read-only.
//   policy: attended | autonomous (the host's `## Gates` policy key, read on each call; anything but `autonomous` is attended)
//   stop:   open | flagged | risk-high (the state's stop; `why` then names it) | none (also always with source artifacts)
//   next:   map (work the map: wayfinder step 4 on) | spec | plan | build | none (Gate 4 is the code owner's)
//   source: state (.forge/state.json) | artifacts (re-derived from docs/efforts/<slug>/ on the effort
//           branch, and whether PR.md carries ## Evidence or the GitHub PR is ready; design section 9)
// Exit 1 when the slug has neither a state record nor an artifact on its branch; 2 on bad usage.

import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { DEFAULT_BRANCHES, git, globOfShape, localBranches, readHostConfig, readState } from '../hooks/scripts/lib.mjs';

/** The command after each stage: the human running it is the approval of the gate the effort waits at. */
const NEXT = { map: 'map', intent: 'spec', spec: 'plan', plan: 'build', build: 'build', built: 'none' };

const WHY = {
  map: 'the map has open tickets or no intent.md yet',
  intent: 'Gate 1: running this accepts intent.md',
  spec: 'Gate 2: running this approves spec.md',
  plan: 'Gate 3 passed: plan.md and tickets published',
  build: 'the build stopped before Gate 4; it resumes from the slice statuses',
  built: 'Gate 4: the PR is ready for the code owner',
};

/** Why the run stopped, by the state's `stop` (the closed set of the gate policy reference); it replaces the stage's line. */
const STOP_WHY = {
  open: 'an open line waits for the owner',
  flagged: 'a flagged concern waits for the owner',
  'risk-high': 'risk high, the effort runs attended',
};

const args = process.argv.slice(2);
const list = args.includes('--list');
const positional = args.filter((a) => a !== '--list');
if ((list && positional.length > 1) || (!list && (positional.length < 1 || positional.length > 2))) {
  process.stderr.write('usage: effort-state.mjs [host-dir] <slug> | --list [host-dir]\n');
  process.exit(2);
}
const dir = path.resolve(list || positional.length === 2 ? positional[0] ?? '.' : '.');
const config = readHostConfig(dir);
const shape = config?.branches?.effort || DEFAULT_BRANCHES.effort;
const branchOf = (slug) => shape.replace('<slug>', slug);
const state = readState(dir);
/** The host's gate policy: `attended` unless the key reads exactly `autonomous`. The default lives here, not in lib.mjs. */
const policy = config?.gates?.policy === 'autonomous' ? 'autonomous' : 'attended';

/** The first ref of the effort branch that exists: local, then origin's. */
function refOf(slug) {
  for (const ref of [branchOf(slug), `origin/${branchOf(slug)}`]) {
    if (git(['-C', dir, 'rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).status === 0) return ref;
  }
  return null;
}

/** Whether the effort's PR is past Gate 4: PR.md has ## Evidence, or GitHub says the PR is not a draft. */
function prReady(slug, ref, names) {
  if (names.has('PR.md')) {
    const body = git(['-C', dir, 'show', `${ref}:docs/efforts/${slug}/PR.md`]).stdout;
    return /^## Evidence\s*$/m.test(body);
  }
  if (git(['-C', dir, 'remote', 'get-url', 'origin']).status !== 0) return false;
  const r = spawnSync('gh', ['pr', 'view', branchOf(slug), '--json', 'isDraft,state'], { cwd: dir, encoding: 'utf8' });
  if (r.status !== 0) return false;
  try {
    const pr = JSON.parse(r.stdout);
    return pr.state === 'OPEN' && pr.isDraft === false;
  } catch {
    return false;
  }
}

/** Stage and gate from the artifacts on the effort branch, or null when it has none. */
function fromArtifacts(slug) {
  const ref = refOf(slug);
  if (!ref) return null;
  const folder = `docs/efforts/${slug}/`;
  const r = git(['-C', dir, 'ls-tree', '--name-only', ref, '--', folder]);
  const names = new Set(r.stdout.split('\n').filter(Boolean).map((p) => p.slice(folder.length)));
  if (names.has('plan.md')) return prReady(slug, ref, names) ? ['built', 'pr'] : ['plan', 'plan'];
  if (names.has('spec.md')) return ['spec', 'spec'];
  if (names.has('intent.md')) return ['intent', 'intent'];
  if (names.has('map.md')) return ['map', 'none'];
  return null;
}

function where(slug) {
  const record = state?.efforts?.[slug];
  if (record?.stage in NEXT) {
    const stop = Object.hasOwn(STOP_WHY, record.stop ?? '') ? record.stop : 'none';
    const why = stop === 'none' ? WHY[record.stage] : STOP_WHY[stop];
    return { slug, stage: record.stage, gate: record.gate ?? 'none', next: NEXT[record.stage], why, source: 'state', policy, stop };
  }
  const derived = fromArtifacts(slug);
  if (!derived) return null;
  const [stage, gate] = derived;
  return { slug, stage, gate, next: NEXT[stage], why: `${WHY[stage]} (no state record; read from ${branchOf(slug)})`, source: 'artifacts', policy, stop: 'none' };
}

if (list) {
  const prefix = shape.split('<slug>')[0];
  const slugs = new Set(Object.keys(state?.efforts ?? {}));
  for (const branch of localBranches(dir, globOfShape(shape))) slugs.add(branch.slice(prefix.length));
  const efforts = [...slugs].sort().map(where).filter(Boolean);
  process.stdout.write(`${JSON.stringify(efforts, null, 2)}\n`);
  process.exit(0);
}

const slug = positional.at(-1);
const found = where(slug);
if (!found) {
  process.stderr.write(`no effort "${slug}": no record in .forge/state.json and no docs/efforts/${slug}/ on ${branchOf(slug)}. Start one with /forge-sdlc:wayfinder <idea>\n`);
  process.exit(1);
}
process.stdout.write(`${JSON.stringify(found, null, 2)}\n`);
