// The crew theme through `claude plugin test`: the host config's `## Crew`
// names each unnamed Agent call with the next name of its role's pool (a plugin
// role's, else the general pool): the call's `name`, its handle above the
// prompt, and the front of its description. The loop's own member calls arrive
// named by bin/crew-name.mjs and keep their name. The test stands for the
// engine beneath the mod and reads back the arguments the mod left on the call.
import { test, expect, mock } from 'claude-code/testing';
import type { Engine } from 'claude-code/testing';
import { HOST_CONFIG, band, forgeConfig } from './run-pane.fixture';
import type { BuiltinToolInputs, On } from 'claude-code';
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

type Seat = { calls: BuiltinToolInputs['Agent'][]; toasts: string[] };

function seat(on: On, config: string | undefined): Seat {
  const s: Seat = { calls: [], toasts: [] };
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
  return s;
}

const crew = (bullets: string) => forgeConfig(`\n## Crew\n${bullets}\n`);

async function start($: Engine, clock: ReturnType<typeof mock.clock>) {
  await $.session.start({ cwd: '/host', surface: 'terminal', isInteractive: true });
  await clock.advance(5000);
}

// An Agent call as the model makes it; no type is general-purpose.
function spawn($: Engine, subagentType: string | undefined, description: string, name?: string) {
  return $.tool.call({
    tool: 'Agent',
    prompt: 'Work the slice.',
    description,
    ...(subagentType ? { subagent_type: subagentType } : {}),
    ...(name ? { name } : {}),
  });
}

const descriptions = (s: Seat) => s.calls.map((e) => e.description);
const names = (s: Seat) => s.calls.map((e) => e.name);

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
  expect(names(s)).toEqual(['Spock', 'Odo', 'Scotty', 'Seven-of-Nine']);
});

test('any other agent takes the general pool, the Agent call without a type included', async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on, crew('- theme: star-trek'));
  await start($, clock);
  await spawn($, 'general-purpose', 'find the fixtures');
  await spawn($, undefined, 'read the spec');
  await spawn($, 'Explore', 'sweep the routes');
  expect(descriptions(s)).toEqual(['Nog · find the fixtures', 'Nog 2 · read the spec', 'Nog 3 · sweep the routes']);
  expect(names(s)).toEqual(['Nog', 'Nog-2', 'Nog-3']);
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
  expect(names(s)).toEqual(['Riker', 'Riker-2', 'Riker-3']);
});

test("a names.<role> bullet overrides a preset's pool and carries a free-text theme", async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on, crew('- theme: Lord of the Rings\n- names.implementer: Frodo, Sam'));
  await start($, clock);
  await spawn($, 'forge-sdlc:implementer', 'slice 01');
  await spawn($, 'forge-sdlc:merger', 'merge slice 01'); // no names for the role: left as it is
  expect(descriptions(s)).toEqual(['Frodo · slice 01', 'merge slice 01']);
  expect(names(s)).toEqual(['Frodo', undefined]);
});

test("theme none keeps a plugin agent's description", async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on, crew('- theme: none   # a preset id, none, or free text'));
  await start($, clock);
  await spawn($, 'forge-sdlc:implementer', 'slice 01');
  expect(descriptions(s)).toEqual(['slice 01']);
  expect(names(s)).toEqual([undefined]);
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

test('with a theme, a fork and a member call the lead named are left alone', async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on, crew('- theme: star-trek'));
  await start($, clock);
  await spawn($, 'fork', 'forked look');
  await spawn($, 'forge-sdlc:implementer', 'slice 01', 'Scotty'); // named by bin/crew-name.mjs
  expect(descriptions(s)).toEqual(['forked look', 'slice 01']);
  expect(names(s)).toEqual([undefined, 'Scotty']);
  await spawn($, 'forge-sdlc:implementer', 'slice 02'); // the named call took no name from the pool
  expect(names(s)[2]).toBe('Scotty');
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

test('withCrewName puts the crew name in front of the description', async () => {
  expect(withCrewName('Spock', 'review slice 03')).toBe('Spock · review slice 03');
});
