// Routing through `claude plugin test`. The test stands for the engine beneath
// the mod: it answers `agent.spawn` the way core does (the call's `model`, else
// the agent file's frontmatter) and `turn.step` with a fixed response, and
// reads back what the mod rewrote.
import { test, expect, mock } from 'claude-code/testing';
import type { Engine } from 'claude-code/testing';
import { HOST_CONFIG, SURFACES, band, forgeConfig, pane, textsUnder } from './run-pane.fixture';
import type { AgentInfo, AgentSpawnInput, On, TurnStepInput } from 'claude-code';

// The roles' frontmatter defaults, as core resolves them.
const FRONTMATTER: Record<string, { model: string; effort: string }> = {
  'forge-sdlc:researcher': { model: 'claude-sonnet-5-5', effort: 'medium' },
  'forge-sdlc:merger': { model: 'claude-sonnet-5-5', effort: 'low' },
};

type Seat = {
  spawns: AgentSpawnInput[];
  steps: TurnStepInput[];
  toasts: string[];
  agents: AgentInfo[];
};

// Everything the engine would answer beneath the mod, from memory. `config` is
// the host config's text; undefined means the host has none.
function seat(on: On, config: string | undefined): Seat {
  const s: Seat = { spawns: [], steps: [], toasts: [], agents: [] };
  on('session.start', ($, e) => ({ cwd: e.cwd }));
  on('command.register', ($, e) => ({ value: { command: e.name } }));
  on('ui.open', () => ({ value: { isPlaced: true } }));
  on('ui.toast', ($, e) => {
    s.toasts.push(e.text);
    return { value: undefined };
  });
  on('fs.read', ($, e) => {
    if (e.path.endsWith(HOST_CONFIG) && config !== undefined) return { value: config };
    // the plugin's agent files, whose frontmatter is the default routing compares against
    const role = e.path.match(/\/agents\/([\w-]+)\.md$/)?.[1];
    const fm = role ? FRONTMATTER[`forge-sdlc:${role}`] : undefined;
    if (fm)
      return { value: `---\nname: ${role}\nmodel: ${fm.model}\neffort: ${fm.effort}\n---\n\nYou are the ${role}.\n` };
    throw new Error(`ENOENT: ${e.path}`);
  });
  on('fs.list', ($, e) => {
    throw new Error(`ENOENT: ${e.path}`);
  });
  on('fs.exists', () => ({ value: false }));
  on('process.run', () => {
    throw new Error('spawn git ENOENT');
  });
  on('agent.list', () => ({ value: s.agents }));
  on('agent.spawn', ($, e) => {
    s.spawns.push(e);
    const id = `agent-${s.spawns.length}`;
    s.agents.push({ id, description: e.description, type: e.subagentType, status: 'running' });
    return { model: e.model ?? FRONTMATTER[e.subagentType]?.model ?? e.parentModel, agentId: id };
  });
  // eslint-disable-next-line require-yield -- a turn.step hook must be an async generator (StreamHookBody); this stand-in answers whole, with no chunks
  on('turn.step', async function* ($, e) {
    s.steps.push(e);
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn',
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        model: e.model,
      },
    };
  });
  return s;
}

const routing = (bullets: string) => forgeConfig(`\n## Routing\n${bullets}\n`);

async function start($: Engine, clock: ReturnType<typeof mock.clock>) {
  await $.session.start({ cwd: '/host', surface: 'terminal', isInteractive: true });
  await clock.advance(5000);
}

// The Agent tool starting a plugin agent, as the engine raises it.
function spawn($: Engine, subagentType: string, description = 'research the auth flow', model?: string) {
  return $.agent.spawn({
    tool_use_id: `toolu_${subagentType}`,
    prompt: 'Read the auth flow.',
    description,
    subagentType,
    ...(model ? { model } : {}),
    provider: { plugin: 'forge-sdlc', tier: 'user' },
    parentModel: 'claude-opus-5-5',
    background: false,
    fork: false,
  });
}

// One model request in an agent's loop (or main's, with no agentId), at the
// frontmatter's model and effort, as the engine resolved it.
async function step($: Engine, agentId: string | undefined, model: string, effort: 'low' | 'medium' | 'high') {
  const stream = $.turn.step({
    turnId: 't1',
    index: 0,
    model,
    effort,
    messageCount: 1,
    ...(agentId ? { agentId } : {}),
  });
  while (!(await stream.next()).done) {
    /* nothing streams from the test's bottom */
  }
  return stream.result;
}

async function agentRows($: Engine, clock: ReturnType<typeof mock.clock>, surface: (typeof SURFACES)[number]) {
  await clock.advance(5000);
  await $.command.run({
    command: 'forge-pane',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 160 },
  });
  const ui = await pane($, surface);
  const rows = textsUnder(await ui.drawn(), 'agents');
  await ui.unmount();
  return rows;
}

test("routing bullets for researcher rewrite the model at spawn and the effort on that agent's turns", async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on, routing('- model.researcher: claude-opus-5-5\n- effort.researcher: high'));
  await start($, clock);
  const spawned = await spawn($, 'forge-sdlc:researcher');
  expect(s.spawns[0]?.model).toBe('claude-opus-5-5');
  expect(spawned.model).toBe('claude-opus-5-5');
  await step($, spawned.agentId, 'claude-opus-5-5', 'medium');
  expect(s.steps[0]?.effort).toBe('high');
  // main's own turns are not the agent's: untouched
  await step($, undefined, 'claude-opus-5-5', 'medium');
  expect(s.steps[1]?.effort).toBe('medium');
});

test("with no routing bullet for the role the agent file's frontmatter default applies, and the row is unmarked", async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on, routing('- model.researcher: claude-opus-5-5\n- effort.researcher: high'));
  await start($, clock);
  const spawned = await spawn($, 'forge-sdlc:merger', 'merge slice 03');
  expect(s.spawns[0]?.model).toBeUndefined();
  expect(spawned.model).toBe('claude-sonnet-5-5');
  await step($, spawned.agentId, 'claude-sonnet-5-5', 'low');
  expect(s.steps[0]?.effort).toBe('low');
  expect(s.toasts.some((t) => t.includes('routing'))).toBe(false);
  expect(await band($)).not.toContain('routing');
});

test('an invalid model bullet is toasted once, kept in the band, and the frontmatter default is used', async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on, routing('- model.researcher: sonet-5\n- effort.researcher: high'));
  await start($, clock);
  const first = await spawn($, 'forge-sdlc:researcher');
  const second = await spawn($, 'forge-sdlc:researcher');
  expect(s.spawns.map((e) => e.model)).toEqual([undefined, undefined]);
  expect(first.model).toBe('claude-sonnet-5-5');
  // the valid effort bullet of the same role still applies
  await step($, first.agentId, 'claude-sonnet-5-5', 'medium');
  await step($, second.agentId, 'claude-sonnet-5-5', 'medium');
  expect(s.steps.map((e) => e.effort)).toEqual(['high', 'high']);
  // toasted once, naming the bullet and its value and nothing else
  const said = s.toasts.filter((t) => t.includes('routing ignored'));
  expect(said).toHaveLength(1);
  expect(said[0]).toMatch(/routing ignored: model\.researcher "sonet-5"/);
  // the band keeps carrying it on the next refresh, as one note, not one a spawn
  await clock.advance(5000);
  expect(await band($)).toMatch(/2 agents running · routing ignored: model\.researcher "sonet-5"/);
  expect(s.toasts.filter((t) => t.includes('routing ignored'))).toHaveLength(1);
});

test('the pane marks the agent row whose model or effort routing overrode, on terminal and desktop', async ($, on) => {
  const clock = mock.clock(on);
  seat(on, routing('- model.researcher: claude-opus-5-5\n- effort.merger: medium'));
  await start($, clock);
  await spawn($, 'forge-sdlc:researcher', 'research the auth flow');
  await spawn($, 'forge-sdlc:merger', 'merge slice 03');
  await spawn($, 'Explore', 'find the fixtures');
  for (const surface of SURFACES) {
    const rows = await agentRows($, clock, surface);
    expect(rows, surface).toHaveLength(3);
    expect(rows[0], surface).toMatch(/^● research the auth flow.*⇄ routed/);
    expect(rows[1], surface).toMatch(/^● merge slice 03.*⇄ routed/);
    expect(rows[2], surface).toMatch(/^● find the fixtures/);
    expect(rows[2], surface).not.toMatch(/routed/);
  }
});

// A bullet equal to the role's frontmatter overrides nothing, so the row stays unmarked.
test("a routing bullet equal to the role's frontmatter default leaves the row unmarked", async ($, on) => {
  const clock = mock.clock(on);
  seat(
    on,
    routing(
      '- model.researcher: claude-sonnet-5-5\n- effort.researcher: medium\n- model.merger: claude-sonnet-5-5\n- effort.merger: low',
    ),
  );
  await start($, clock);
  await spawn($, 'forge-sdlc:researcher', 'research the auth flow');
  await spawn($, 'forge-sdlc:merger', 'merge slice 03');
  for (const surface of SURFACES) {
    const rows = await agentRows($, clock, surface);
    expect(rows, surface).toHaveLength(2);
    for (const row of rows) expect(row, surface).not.toMatch(/routed/);
  }
});

// A default-valued bullet still replaces a model the dispatching skill passed on
// the Agent call (ROUTING.md, Precedence): that is an override, and it is marked.
test("a routing bullet that replaces the Agent call's own model marks the row even at the frontmatter value", async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on, routing('- model.researcher: claude-sonnet-5-5\n- effort.researcher: medium'));
  await start($, clock);
  await spawn($, 'forge-sdlc:researcher', 'research the auth flow', 'haiku');
  expect(s.spawns[0]?.model).toBe('claude-sonnet-5-5');
  const rows = await agentRows($, clock, 'terminal');
  expect(rows[0]).toMatch(/⇄ routed/);
});

test('a key that is neither model.<role> nor effort.<role> is reported and ignored', async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on, routing('- researcher: claude-opus-5-5'));
  await start($, clock);
  const spawned = await spawn($, 'forge-sdlc:researcher');
  expect(spawned.model).toBe('claude-sonnet-5-5');
  expect(s.toasts.filter((t) => t.includes('routing ignored'))).toEqual([
    'forge-sdlc: routing ignored: researcher is not model.<role> or effort.<role>',
  ]);
});
