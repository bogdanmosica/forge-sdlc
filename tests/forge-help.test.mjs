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
const { GATES, GROUPS, HIDDEN, LOOP, MOD_COMMANDS, commandGroups, newestVersionFirst, parseAgent, parseSkill } =
  await import('../plugins/forge-sdlc/hooks/forge/help.ts');
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

test('the loop view names real commands and marks where the driver is needed at each of the four gates', () => {
  for (const stage of LOOP) {
    for (const command of stage.text.match(/\/forge-sdlc:[a-z-]+/g) ?? []) {
      assert.ok(
        skills.includes(command.slice('/forge-sdlc:'.length)),
        `${stage.stage} names ${command}, which is no skill`,
      );
    }
  }
  const you = LOOP.filter((s) => s.you).map((s) => s.you);
  assert.equal(you.length, LOOP.length, 'every stage says where the driver is needed');
  for (const gate of [1, 2, 3, 4]) assert.ok(you.some((y) => y.includes(`Gate ${gate}:`)), `Gate ${gate}`);
  assert.match(you.join('\n'), /open: line/, 'the open: line the policy stops on');
  assert.match(GATES, /attended.*autonomous/s, 'the two gate policies');
  assert.match(GATES, /Gate 4 is always/);
});

test('the loop view says the front door resumes a stopped effort, and that Gate 4 stays the code owner’s', () => {
  const plan = LOOP.find((s) => s.stage === 'Plan')?.you ?? '';
  assert.match(plan, /\/forge-sdlc:wayfinder <slug> resumes/, 'a stopped effort resumes with /forge-sdlc:wayfinder <slug>');
  const deploy = LOOP.find((s) => s.stage === 'Deploy')?.you ?? '';
  assert.match(deploy, /code owner/);
});

test("one group is flagged for the mod's own commands, and commandGroups puts them there whatever it is titled", () => {
  const flagged = GROUPS.filter((g) => g.mods);
  assert.equal(flagged.length, 1, 'exactly one group carries mods: true');
  const group = commandGroups([]).find((g) => g.title === flagged[0].title);
  assert.deepEqual(group?.rows, MOD_COMMANDS);
  assert.deepEqual(
    MOD_COMMANDS.map((r) => r.command),
    ['/forge-pane', '/handoff-new', '/forge'],
    'the three commands the mod registers',
  );
});

test('newestVersionFirst orders version directories by number, not by text', () => {
  assert.deepEqual(newestVersionFirst(['1.9.2', '1.10.0', '0.2.0']), ['1.10.0', '1.9.2', '0.2.0']);
});
