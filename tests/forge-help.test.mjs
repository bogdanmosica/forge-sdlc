// The /forge panel's tables (hooks/forge/help.ts) against the plugin as it is:
// every skill is grouped or deliberately left out, every grouped name is a
// real skill, and the loop view names real commands and the driver's gates.
// Node strips the module's types on import; it has no imports of its own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pluginRoot = resolve(fileURLToPath(new URL('../plugins/forge-sdlc/', import.meta.url)));
const { GATES, GROUPS, HIDDEN, LOOP, MOD_COMMANDS, commandGroups, loopProse, newestVersionFirst, parseAgent, parseSkill } =
  await import('../plugins/forge-sdlc/hooks/forge/help.ts');
const { resolveRoster, resolveWorkflow } = await import('../plugins/forge-sdlc/hooks/roster.mjs');
const workflowText = readFileSync(join(pluginRoot, 'workflow.yaml'), 'utf8');
// The plugin's workflow.yaml resolved with a host's forge.yaml (none: the defaults).
const loopOf = (yaml) => resolveWorkflow(workflowText, resolveRoster(yaml, undefined)).stages;
const MIXED = ['version: 1', 'workflow:', '  policy: autonomous', '  gates:', '    plan: attended', ''].join('\n');
const skills = readdirSync(join(pluginRoot, 'skills')).filter((d) =>
  existsSync(join(pluginRoot, 'skills', d, 'SKILL.md')),
);

test('every skill of the plugin is in a /forge group or deliberately left out', () => {
  const placed = [...GROUPS.flatMap((g) => g.skills), ...HIDDEN];
  for (const name of skills)
    assert.ok(
      placed.includes(name),
      `skills/${name} is in no /forge group: add it to GROUPS or HIDDEN in hooks/forge/help.ts`,
    );
});

test('every name /forge groups or hides is a skill of the plugin, once', () => {
  const placed = [...GROUPS.flatMap((g) => g.skills), ...HIDDEN];
  for (const name of placed)
    assert.ok(skills.includes(name), `hooks/forge/help.ts names ${name}, which has no skills/${name}/SKILL.md`);
  assert.equal(new Set(placed).size, placed.length, 'each skill in one place');
});

test("every skill's and agent's frontmatter reads as the panel shows it: a name, a first sentence, a bare hint", () => {
  for (const name of skills) {
    const s = parseSkill(readFileSync(join(pluginRoot, 'skills', name, 'SKILL.md'), 'utf8'));
    assert.equal(s?.name, name);
    assert.match(s.description, /[.!?]$/, `${name}: the first sentence ends the description`);
    if (s.hint) assert.doesNotMatch(s.hint, /^["']|["']$/, `${name}: the hint's quotes are stripped`);
  }
  for (const file of readdirSync(join(pluginRoot, 'agents')).filter((f) => f.endsWith('.md'))) {
    const a = parseAgent(readFileSync(join(pluginRoot, 'agents', file), 'utf8'));
    assert.equal(`${a?.name}.md`, file);
    assert.ok(a.model && a.effort, `${file}: model and effort show as the hint`);
  }
});

test("the loop prose is keyed to the workflow's stages: their names in order after watch and setup, each stage's command from the workflow", () => {
  const stages = loopOf(undefined);
  assert.deepEqual(Object.keys(LOOP).sort(), stages.map((s) => s.name).sort(), 'LOOP holds one entry per workflow stage, by its name');
  const prose = loopProse(stages);
  assert.deepEqual(
    prose.map((p) => p.name),
    ['watch', 'setup', 'map', 'intent', 'spec', 'plan', 'build', 'built'],
  );
  assert.equal(prose.find((p) => p.name === 'spec')?.command, '/forge-sdlc:spec', 'the command comes from the workflow');
  assert.equal(prose.find((p) => p.name === 'built')?.command, undefined, 'a stage with no command shows none');
  for (const p of prose) {
    assert.ok(p.you, `${p.name} says what the driver does`);
    for (const command of `${p.command ?? ''} ${p.you}`.match(/\/forge-sdlc:[a-z-]+/g) ?? [])
      assert.ok(skills.includes(command.slice('/forge-sdlc:'.length)), `${p.name} names ${command}, which is no skill`);
  }
  assert.match(GATES, /attended.*autonomous/s, 'the two gate policies');
  assert.match(GATES, /Gate 4 is always/);
  assert.match(GATES, /workflow\.policy in docs\/agents\/forge\.yaml/, 'the global policy names its forge.yaml key');
  assert.match(GATES, /gates\.intent, gates\.spec or gates\.plan/, 'the per-gate override');
});

test("each gate's you: line names the gate from the workflow and its mode, the per-gate override included", () => {
  const you = (stages, name) => loopProse(stages).find((p) => p.name === name)?.you ?? '';
  const attended = loopOf(undefined);
  assert.match(you(attended, 'intent'), /^Gate 1 · attended: accept intent\.md/);
  assert.match(you(attended, 'spec'), /^Gate 2 · attended: approve spec\.md/);
  assert.match(you(attended, 'plan'), /^Gate 3 · attended: answer plan's quiz/);
  assert.match(you(attended, 'build'), /^Gate 4 · owner: /);
  assert.doesNotMatch(you(attended, 'map'), /Gate \d/, 'a stage with no gate names none');
  // autonomous with gates.plan: attended: Gates 1 and 2 pass by policy, Gate 3 stays yours
  const mixed = loopOf(MIXED);
  assert.match(you(mixed, 'intent'), /^Gate 1 · policy: the policy accepts intent\.md when no open: line remains/);
  assert.match(you(mixed, 'spec'), /^Gate 2 · policy: the policy approves spec\.md when nothing is open or flagged/);
  assert.match(you(mixed, 'plan'), /^Gate 3 · attended: answer plan's quiz/);
  assert.doesNotMatch(you(mixed, 'plan'), /the policy/);
});

test('the loop prose says the front door resumes a stopped effort, and that Gate 4 stays the code owner’s', () => {
  const prose = loopProse(loopOf(undefined));
  const you = (name) => prose.find((p) => p.name === name)?.you ?? '';
  assert.match(you('intent'), /\/forge-sdlc:wayfinder <slug> resumes/, 'a stopped effort resumes with /forge-sdlc:wayfinder <slug>');
  assert.match(you('build'), /code owner/);
  assert.match(you('watch'), /cmux claude-teams/);
  assert.match(you('setup'), /\/forge-sdlc:init/);
});

test("one group is flagged for the mod's own commands, and commandGroups puts them there whatever it is titled", () => {
  const flagged = GROUPS.filter((g) => g.mods);
  assert.equal(flagged.length, 1, 'exactly one group carries mods: true');
  const group = commandGroups([]).find((g) => g.title === flagged[0].title);
  assert.deepEqual(group?.rows, MOD_COMMANDS);
});

test('every command the mod registers is a row of MOD_COMMANDS, and every row is a registered command', () => {
  // A command spec is the one place a hooks source writes `name: '<x>'`
  // (fixtures and tests are left out: their names are not commands).
  const hooksDir = join(pluginRoot, 'hooks');
  const sources = readdirSync(hooksDir).filter(
    (f) => /\.tsx?$/.test(f) && !/\.(test|fixture)\.tsx?$/.test(f) && !f.endsWith('.d.ts'),
  );
  const registered = new Set(
    sources.flatMap((f) =>
      [...readFileSync(join(hooksDir, f), 'utf8').matchAll(/name: '([a-z][a-z-]*)'/g)].map((m) => m[1]),
    ),
  );
  assert.ok(registered.size >= 9, `found ${registered.size} registered commands, expected the mod's nine or more`);
  const rows = MOD_COMMANDS.map((r) => r.command);
  for (const name of registered)
    assert.ok(
      rows.includes(`/${name}`),
      `the mod registers /${name}, which MOD_COMMANDS in hooks/forge/help.ts does not list`,
    );
  for (const command of rows)
    assert.ok(registered.has(command.slice(1)), `MOD_COMMANDS lists ${command}, which no hooks source registers`);
  assert.equal(new Set(rows).size, rows.length, 'each command once');
});

test('newestVersionFirst orders version directories by number, not by text', () => {
  assert.deepEqual(newestVersionFirst(['1.9.2', '1.10.0', '0.2.0']), ['1.10.0', '1.9.2', '0.2.0']);
});
