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
