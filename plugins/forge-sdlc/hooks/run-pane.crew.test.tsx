// The crew theme through `claude plugin test`: the host config's `## Crew`
// names each agent its call left unnamed, at its spawn, with the next name of
// its role's pool (a plugin role's, else the general pool), in front of its
// description. The loop's own member calls arrive named by bin/crew-name.mjs
// and show that handle's display form. The Agent tool call itself reaches the
// engine untouched: a rewrite there lands after auto mode reviewed the call,
// which then gets no verdict. The test stands for the engine beneath the mod
// and reads back what the mod left on the call and the spawn.
import { test, expect, mock } from 'claude-code/testing';
import type { Engine } from 'claude-code/testing';
import { HOST_CONFIG, band, forgeConfig } from './run-pane.fixture';
import type { AgentSpawnInput, BuiltinToolInputs, On } from 'claude-code';
import { withCrewName } from './run-pane/crew';

// A stand-in for the plugin's crew.json: one preset, short pools so a test runs one out.
const PRESETS = JSON.stringify({
  presets: {
    'star-trek': {
      label: 'Star Trek',
      names: {
        reviewer: ['Spock', 'Odo', 'Seven of Nine'],
        implementer: ['Scotty', "O'Brien"],
        merger: ['Riker'],
        general: ['Nog'],
      },
    },
  },
});

type Seat = { calls: BuiltinToolInputs['Agent'][]; spawns: AgentSpawnInput[]; toasts: string[] };

function seat(on: On, config: string | undefined): Seat {
  const s: Seat = { calls: [], spawns: [], toasts: [] };
  on('session.start', ($, e) => ({ cwd: e.cwd }));
  on('command.register', ($, e) => ({ value: { command: e.name } }));
  on('ui.open', () => ({ value: { isPlaced: true } }));
  on('ui.toast', ($, e) => {
    s.toasts.push(e.text);
    return { value: undefined };
  });
  on('fs.read', ($, e) => {
    if (e.path.endsWith(HOST_CONFIG) && config !== undefined) return { value: config };
    if (e.path.endsWith('/crew.json')) return { value: PRESETS };
    throw new Error(`ENOENT: ${e.path}`);
  });
  on('fs.list', ($, e) => {
    throw new Error(`ENOENT: ${e.path}`);
  });
  on('fs.exists', () => ({ value: false }));
  on('process.run', () => {
    throw new Error('spawn git ENOENT');
  });
  on('agent.list', () => ({ value: [] }));
  on('tool.call', { tool: 'Agent' }, ($, e) => {
    if (e.tool !== 'Agent') return { deny: 'not the Agent tool' };
    s.calls.push(e);
    return { result: { agentId: `agent-${s.calls.length}`, content: [], totalToolUseCount: 0 } as never };
  });
  on('agent.spawn', ($, e) => {
    s.spawns.push(e);
    return { model: e.model ?? e.parentModel, agentId: `agent-${s.spawns.length}` };
  });
  return s;
}

const crew = (bullets: string) => forgeConfig(`\n## Crew\n${bullets}\n`);

async function start($: Engine, clock: ReturnType<typeof mock.clock>) {
  await $.session.start({ cwd: '/host', surface: 'terminal', isInteractive: true });
  await clock.advance(5000);
}

// An Agent call as the model makes it; no type is general-purpose.
function call($: Engine, subagentType: string | undefined, description: string, name?: string) {
  return $.tool.call({
    tool: 'Agent',
    prompt: 'Work the slice.',
    description,
    ...(subagentType ? { subagent_type: subagentType } : {}),
    ...(name ? { name } : {}),
  });
}

// The spawn that call becomes, as the engine raises it once the call is allowed.
function spawn($: Engine, subagentType: string | undefined, description: string, name?: string) {
  return $.agent.spawn({
    tool_use_id: `toolu_${description}`,
    prompt: 'Work the slice.',
    description,
    subagentType: subagentType ?? 'general-purpose',
    ...(name ? { name } : {}),
    provider: { plugin: 'forge-sdlc', tier: 'user' },
    parentModel: 'claude-opus-5-5',
    background: true,
    fork: subagentType === 'fork',
  });
}

const descriptions = (s: Seat) => s.spawns.map((e) => e.description);
const names = (s: Seat) => s.spawns.map((e) => e.name);

test("a preset theme names each unnamed plugin agent from its role's pool, in spawn order", async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on, crew('- theme: star-trek'));
  await start($, clock);
  await spawn($, 'forge-sdlc:reviewer', 'Standards axis slice 03');
  await spawn($, 'forge-sdlc:reviewer', 'Spec axis slice 03');
  await spawn($, 'forge-sdlc:implementer', 'slice 04');
  await spawn($, 'forge-sdlc:reviewer', 'Bugs axis slice 03');
  expect(descriptions(s)).toEqual([
    'Spock · Standards axis slice 03',
    'Odo · Spec axis slice 03',
    'Scotty · slice 04',
    'Seven of Nine · Bugs axis slice 03',
  ]);
  expect(names(s)).toEqual([undefined, undefined, undefined, undefined]); // the address stays the call's
});

test('any other agent takes the general pool, the Agent call without a type included', async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on, crew('- theme: star-trek'));
  await start($, clock);
  await spawn($, 'general-purpose', 'find the fixtures');
  await spawn($, undefined, 'read the spec');
  await spawn($, 'Explore', 'sweep the routes');
  expect(descriptions(s)).toEqual(['Nog · find the fixtures', 'Nog 2 · read the spec', 'Nog 3 · sweep the routes']);
});

for (const theme of ['Star Trek', 'STAR-TREK', 'star trek']) {
  test(`a preset is found by its id or its label, any case, as init accepts it: ${JSON.stringify(theme)}`, async ($, on) => {
    const clock = mock.clock(on);
    const s = seat(on, crew(`- theme: ${theme}`));
    await start($, clock);
    await spawn($, 'forge-sdlc:merger', 'merge slice 01');
    expect(descriptions(s)).toEqual(['Riker · merge slice 01']);
    expect(s.toasts.some((t) => t.includes('crew ignored'))).toBe(false);
  });
}

test('a pool run out starts again with a number', async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on, crew('- theme: star-trek'));
  await start($, clock);
  for (const n of ['01', '02', '03']) await spawn($, 'forge-sdlc:merger', `merge slice ${n}`);
  expect(descriptions(s)).toEqual(['Riker · merge slice 01', 'Riker 2 · merge slice 02', 'Riker 3 · merge slice 03']);
});

test("a names.<role> bullet overrides a preset's pool and carries a free-text theme", async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on, crew('- theme: Lord of the Rings\n- names.implementer: Frodo, Sam'));
  await start($, clock);
  await spawn($, 'forge-sdlc:implementer', 'slice 01');
  await spawn($, 'forge-sdlc:merger', 'merge slice 01'); // no names for the role: left as it is
  expect(descriptions(s)).toEqual(['Frodo · slice 01', 'merge slice 01']);
});

test("theme none keeps a plugin agent's description", async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on, crew('- theme: none   # a preset id, none, or free text'));
  await start($, clock);
  await spawn($, 'forge-sdlc:implementer', 'slice 01');
  expect(descriptions(s)).toEqual(['slice 01']);
});

test("a host config with no crew section keeps a plugin agent's description and says nothing", async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on, forgeConfig());
  await start($, clock);
  await spawn($, 'forge-sdlc:implementer', 'slice 01');
  expect(descriptions(s)).toEqual(['slice 01']);
  expect(s.toasts.some((t) => t.includes('crew'))).toBe(false);
  expect(await band($)).not.toContain('crew');
});

test('with a theme, a fork is left alone and a member call keeps its name, shown in front', async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on, crew('- theme: star-trek'));
  await start($, clock);
  await spawn($, 'fork', 'forked look');
  await spawn($, 'forge-sdlc:implementer', 'slice 01', 'scout');
  expect(descriptions(s)).toEqual(['forked look', 'scout · slice 01']);
  expect(names(s)).toEqual([undefined, 'scout']);
  await spawn($, 'forge-sdlc:implementer', 'slice 02'); // the named call took no name from the pool
  expect(descriptions(s)[2]).toBe('Scotty · slice 02');
});

test('a member call named by bin/crew-name.mjs shows its display name, round included', async ($, on) => {
  // skills/build/MEMBERS.md: the skill passes the handle as `name`; the pane and the band read the pool name back.
  const clock = mock.clock(on);
  const s = seat(on, crew('- theme: star-trek'));
  await start($, clock);
  await spawn($, 'forge-sdlc:reviewer', 'Bugs axis slice 03', 'Seven-of-Nine');
  await spawn($, 'forge-sdlc:reviewer', 'Bugs axis slice 04', 'Seven-of-Nine-2');
  await spawn($, 'forge-sdlc:implementer', 'slice 05', 'OBrien');
  await spawn($, 'forge-sdlc:merger', 'Riker · merge slice 01', 'Riker'); // already in front: left as it is
  expect(descriptions(s)).toEqual([
    'Seven of Nine · Bugs axis slice 03',
    'Seven of Nine 2 · Bugs axis slice 04',
    "O'Brien · slice 05",
    'Riker · merge slice 01',
  ]);
  expect(names(s)).toEqual(['Seven-of-Nine', 'Seven-of-Nine-2', 'OBrien', 'Riker']);
});

test('with theme none, a named call shows its handle in front and nothing else changes', async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on, crew('- theme: none'));
  await start($, clock);
  await spawn($, 'forge-sdlc:implementer', 'slice 01', 'alpha-01');
  expect(descriptions(s)).toEqual(['alpha-01 · slice 01']);
});

test('an unknown theme with no names is toasted once, kept in the band, and names no one', async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on, crew('- theme: stargate'));
  await start($, clock);
  await spawn($, 'forge-sdlc:implementer', 'slice 01');
  await spawn($, 'forge-sdlc:implementer', 'slice 02');
  expect(descriptions(s)).toEqual(['slice 01', 'slice 02']);
  const said = s.toasts.filter((t) => t.includes('crew ignored'));
  expect(said).toHaveLength(1);
  expect(said[0]).toMatch(/crew ignored: theme "stargate" is no preset and no names\.<role> bullet is set/);
  expect(await band($)).toMatch(/crew ignored: theme "stargate"/);
});

test('with a theme, the Agent tool call reaches the engine exactly as the model made it', async ($, on) => {
  // A crew rewrite at tool.call made auto mode reject every dispatch once.
  const clock = mock.clock(on);
  const s = seat(on, crew('- theme: star-trek'));
  await start($, clock);
  await call($, 'forge-sdlc:implementer', 'slice 01');
  await call($, undefined, 'read the spec');
  expect(s.calls.map((e) => [e.description, e.name])).toEqual([
    ['slice 01', undefined],
    ['read the spec', undefined],
  ]);
});

test('withCrewName puts the crew name in front of the description', async () => {
  expect(withCrewName('Spock', 'review slice 03')).toBe('Spock · review slice 03');
});
