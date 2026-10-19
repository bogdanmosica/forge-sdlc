// Structure of the review slice: the slice-review skill, the reviewer agent and the
// bugs-and-security rubric carry the fields, headings, labels and pointers the design requires,
// every file they link to exists, and the rubric quotes no credential-looking value.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'forge-sdlc');
const read = (rel) => readFileSync(path.join(plugin, rel), 'utf8');

/** `{ fields, body }` of a markdown file with YAML-ish `key: value` frontmatter. */
function frontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  assert.ok(m, 'frontmatter block');
  const fields = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([\w-]+):\s*(.*)$/.exec(line);
    if (kv) fields[kv[1]] = kv[2].trim();
  }
  return { fields, body: m[2] };
}

/** Relative link targets `[x](path)` of a markdown text, without anchors or URLs. */
const relativeLinks = (text) =>
  [...text.matchAll(/\[[^\]]*\]\(([^)#\s]+)\)/g)].map((m) => m[1]).filter((t) => !/^[a-z]+:/.test(t));

const SKILL = 'skills/slice-review/SKILL.md';
const AGENT = 'agents/reviewer.md';
const RUBRIC = 'review/REVIEW.md';

/* The skill */

test('slice-review: user-invoked, with the argument hint of the design', () => {
  const { fields } = frontmatter(read(SKILL));
  assert.equal(fields.name, 'slice-review');
  assert.ok(fields.description);
  assert.equal(fields['disable-model-invocation'], 'true');
  assert.equal(fields['argument-hint'], '<slice-branch> [effort-branch]');
});

test('slice-review: resolves the effort branch from the slug, checks the refs and a non-empty diff', () => {
  const { body } = frontmatter(read(SKILL));
  assert.match(body, /feat\/<slug>/);
  assert.match(body, /omitted/);
  assert.match(body, /git rev-parse/);
  assert.match(body, /git diff <effort(-branch)?>\.\.\.<slice(-branch)?>/);
  assert.match(body, /non-empty|empty diff/);
});

test('slice-review: three reviewer axes in parallel, foreground, pointers only', () => {
  const { body } = frontmatter(read(SKILL));
  assert.match(body, /subagent_type[^\n]*forge-sdlc:reviewer/);
  for (const axis of ['Axis: Standards', 'Axis: Spec', 'Axis: Bugs and security']) assert.ok(body.includes(axis), axis);
  assert.match(body, /parallel/);
  assert.match(body, /foreground/);
  assert.match(body, /pointers/);
  assert.match(body, /skill-path\.mjs" code-review/);
  assert.match(body, /review\/REVIEW\.md/);
  assert.match(body, /docs\/agents\/REVIEW\.md/);
  assert.match(body, /spec\.md/);
});

test('slice-review: axes side by side and never reranked, Important goes to one fix implementer, verifier and axes rerun, two rounds', () => {
  const { body } = frontmatter(read(SKILL));
  assert.match(body, /side by side/);
  assert.match(body, /rerank/);
  assert.match(body, /forge-sdlc:implementer/);
  assert.match(body, /forge-sdlc:verifier/);
  assert.match(body, /same worktree/);
  assert.match(body, /two (fix )?rounds/i);
});

test('slice-review: writes the review record and ends with one verdict, clean or red', () => {
  const { body } = frontmatter(read(SKILL));
  assert.match(body, /\.forge\/review\/<slug>-<nn>\.md/);
  assert.match(body, /`clean`/);
  assert.match(body, /`red`/);
  assert.match(body, /## Standards/);
  assert.match(body, /## Spec/);
  assert.match(body, /## Bugs and security/);
  assert.match(body, /## Verdict/);
});

test('slice-review: every file it links to exists', () => {
  for (const target of relativeLinks(read(SKILL))) {
    assert.ok(existsSync(path.join(plugin, 'skills', 'slice-review', target)), target);
  }
});

/* The agent */

test('reviewer: Opus, high, read-only by blacklist', () => {
  const { fields } = frontmatter(read(AGENT));
  assert.equal(fields.name, 'reviewer');
  assert.ok(fields.description);
  assert.equal(fields.model, 'claude-opus-5-5');
  assert.equal(fields.effort, 'high');
  const disallowed = fields.disallowedTools.split(',').map((s) => s.trim());
  for (const tool of ['Edit', 'Write', 'NotebookEdit', 'Agent']) assert.ok(disallowed.includes(tool), tool);
  assert.equal(fields.tools, undefined);
});

test('reviewer: one axis per prompt line, each axis with its sources', () => {
  const { body } = frontmatter(read(AGENT));
  assert.ok(body.includes('Axis: Standards | Spec | Bugs and security'));
  assert.match(body, /### 3\. Identify the standards sources/);
  assert.match(body, /smell baseline/);
  assert.match(body, /documented standards/);
  assert.match(body, /spec\.md/);
  assert.match(body, /[Qq]uot(e|ing) the (spec|line)/);
  assert.match(body, /REVIEW\.md/);
  assert.match(body, /docs\/agents\/REVIEW\.md/);
});

test('reviewer: findings name file and hunk, rule and one-line fix; Important first; under 400 words; one screen', () => {
  const { body } = frontmatter(read(AGENT));
  assert.match(body, /file and hunk|`file:hunk`/);
  assert.match(body, /one-line fix/);
  assert.match(body, /400 words/);
  assert.match(body, /Important/);
  assert.match(body, /Nit/);
  assert.match(body, /\[REDACTED\]/);
  assert.ok(body.split('\n').length <= 45, `agent brief is ${body.split('\n').length} lines`);
  const steps = body.split('\n').filter((l) => /^\d+\. /.test(l));
  assert.ok(steps.length >= 3, 'numbered steps');
  for (const step of steps) assert.match(step, /Done when/);
});

/* The rubric */

test('REVIEW.md: the sections and labels of the design', () => {
  const text = read(RUBRIC);
  for (const h of ['## Labels', '## Bugs', '## Security', '## Secrets', '## Host extension']) assert.ok(text.includes(`\n${h}\n`), h);
  assert.match(text, /\*\*Important\*\*[^\n]*blocks/);
  assert.match(text, /\*\*Nit\*\*[^\n]*five at most/);
  assert.match(text, /\*\*Nit\*\*[^\n]*never blocks/);
});

test('REVIEW.md: every bug and security item is listed', () => {
  const text = read(RUBRIC);
  const bugs = text.slice(text.indexOf('## Bugs'), text.indexOf('## Security'));
  for (const item of [/null paths/i, /floating promises/i, /errors created,? not thrown/i, /dead branches/i, /tautological tests/i, /hunks no test exercises/i]) {
    assert.match(bugs, item);
  }
  const security = text.slice(text.indexOf('## Security'), text.indexOf('## Secrets'));
  for (const item of [/injection/i, /unsafe navigation/i, /trust boundary/i, /data-access bypass/i, /confidential logging/i, /unexpected dependency/i]) {
    assert.match(security, item);
  }
});

test('REVIEW.md: secrets are shapes, written [REDACTED], placeholders read <YOUR_API_KEY>', () => {
  const text = read(RUBRIC);
  const secrets = text.slice(text.indexOf('## Secrets'), text.indexOf('## Host extension'));
  assert.ok(secrets.includes('[REDACTED]'));
  assert.ok(secrets.includes('<YOUR_API_KEY>'));
  assert.match(secrets, /never quoted/);
});

test('REVIEW.md: the host extension extends and never relaxes', () => {
  const text = read(RUBRIC);
  const host = text.slice(text.indexOf('## Host extension'));
  assert.match(host, /docs\/agents\/REVIEW\.md/);
  assert.match(host, /extends/);
  assert.match(host, /never relaxes|never (removed|softened)/);
});

test('REVIEW.md: quotes no credential-looking value and names no company', () => {
  const text = read(RUBRIC);
  const shapes = [
    /AKIA[0-9A-Z]{16}/,
    /\bsk-(proj-)?[A-Za-z0-9_-]{20,}/,
    /\bsk-ant-[A-Za-z0-9_-]{10,}/,
    /AIza[0-9A-Za-z_-]{35}/,
    /ya29\.[0-9A-Za-z_-]{20,}/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/,
    /AccountKey=[A-Za-z0-9+/=]{20,}/,
    /(postgres|mysql|mongodb(\+srv)?|redis|amqp):\/\/[^\s:]+:[^\s@]+@/,
    /\b[0-9a-f]{32}\b/,
    /\b[A-Za-z0-9+/]{40}\b/,
  ];
  for (const shape of shapes) assert.doesNotMatch(text, shape);
  assert.doesNotMatch(text, /emag|jira|gdpr|dora|nis2/i);
});

test('slice-review: the verifier gets its own four pointers, the fix implementer its build pointers plus the round', () => {
  const body = read('skills/slice-review/SKILL.md');
  assert.match(body, /in the verifier's order: `<slug>-<nn>`, the worktree, the project dir[^\n]*proof command/);
  assert.match(body, /implementer's build pointers plus the fix[^\n]*plan\.md` row `<nn>` and its proof line[^\n]*the round to fix/);
});

/* Members (the member call of skills/build/MEMBERS.md) */

const MEMBER_LINK = '[member call](../build/MEMBERS.md)';
/** The body line holding the Agent call for `forge-sdlc:<agent>`. */
const callLine = (agent) => frontmatter(read(SKILL)).body.split('\n').find((l) => l.includes(`subagent_type: "forge-sdlc:${agent}"`));

test('slice-review: the reviewer and verifier calls are member calls naming their roles', () => {
  for (const role of ['reviewer', 'verifier']) {
    const line = callLine(role);
    assert.ok(line, `an Agent call for ${role}`);
    assert.ok(line.includes(MEMBER_LINK), `${role} links the members reference`);
    assert.ok(line.includes(`role \`${role}\``), `${role} names its role`);
    assert.ok(line.includes('foreground under a plain lead'), `${role} runs in the foreground under a plain lead`);
  }
  assert.ok(callLine('reviewer').includes('role `reviewer` (one name run per call)'), 'each reviewer call takes its own name run');
  assert.ok(existsSync(path.join(plugin, 'skills', 'build', 'MEMBERS.md')), 'the reference exists');
});

test('slice-review: the fix implementer is one foreground member call with --slice, with no agent write', () => {
  const line = callLine('implementer');
  assert.ok(line, 'an Agent call for the fix implementer');
  assert.ok(line.includes(MEMBER_LINK), 'the fix links the members reference');
  assert.ok(line.includes('role `implementer` with `--slice <slug>-<nn>`, foreground under a plain lead'), 'the fix reuses the slice name and runs in the foreground inside the merger');
  assert.doesNotMatch(line, /background/, 'no background fix call');
  assert.doesNotMatch(line, /slices\["<slug>-<nn>"\]\.agent/, 'no agent write before the wait');
  assert.match(line, /skip the reference's Agent id step/, 'the reference\'s agent-id step does not apply to a foreground fix');
});

test('slice-review: the session running it is the lead of its member calls, reading the reference by path', () => {
  const body = frontmatter(read(SKILL)).body;
  const line = body.split('\n').find((l) => /plugin-root variable unresolved/.test(l));
  assert.ok(line, 'the by-path sentence');
  assert.match(line, /\(\.\.\/build\/MEMBERS\.md\)[^\n]*lead[^\n]*plugin-root variable unresolved[^\n]*\$\{CLAUDE_PLUGIN_ROOT\}/);
  assert.doesNotMatch(read(SKILL), /teammate|task notification/i, 'the transport words stay in the reference');
});

test('slice-review: the fix step has one completion line, the report and a commit after the reviewed sha', () => {
  const line = callLine('implementer');
  assert.ok(line, 'an Agent call for the fix implementer');
  const done = line.match(/Done when[^\n]*/g) ?? [];
  assert.deepEqual(done, ['Done when the implementer reported and the slice branch has a commit after the reviewed sha.']);
  const body = frontmatter(read(SKILL)).body;
  assert.doesNotMatch(body, /verifier's record for it is fresh/, 'no second way to finish the fix');
  assert.doesNotMatch(body, /end your turn|only when that slice record exists/, 'no wait on a background report, no guarded agent write');
});

test('slice-review: design section 7 records the foreground fix round with a Decision line, and ADR 0016 agrees', () => {
  const repo = path.resolve(plugin, '..', '..');
  const lines = readFileSync(path.join(repo, 'docs', 'design.md'), 'utf8').split('\n');
  const at = lines.findIndex((l) => /the lead records `agent` right after the implementer's Agent call/.test(l));
  assert.ok(at >= 0, 'the agent-id Decision line');
  const next = lines.slice(at + 1).find((l) => l.trim() !== '');
  assert.match(next, /^Decision \(verified-before-stop\)/, 'a Decision line follows it');
  assert.match(next, /fix round/);
  assert.match(next, /foreground inside the merger/);
  assert.match(next, /verify step/);
  assert.match(next, /\]\(adr\/0016-stop-gate-finds-a-subagents-slice-by-its-agent-id\.md\)/, 'links ADR 0016');
  const adr = readFileSync(path.join(repo, 'docs', 'adr', '0016-stop-gate-finds-a-subagents-slice-by-its-agent-id.md'), 'utf8');
  assert.doesNotMatch(adr, /fix round starts its implementer in the background/, 'no background fix round');
  assert.match(adr, /fix round[^\n]*foreground inside the merger[^\n]*verify step/, 'the consequence names the foreground fix and its gate');
});
