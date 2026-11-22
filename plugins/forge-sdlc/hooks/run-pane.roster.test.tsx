// The roster at spawn through `claude plugin test`: docs/agents/forge.yaml names
// another agent for a role, and the mod rewrites a plain spawn of
// `forge-sdlc:<role>` to it. The test stands for the engine beneath the mod: it
// offers agent types as the listing does, answers `agent.spawn` the way core
// does (the call's `model`, else the agent file's frontmatter) and `turn.step`
// with a fixed response, and reads back what the mod rewrote.
import { test, expect, mock } from 'claude-code/testing';
import type { Engine } from 'claude-code/testing';
import { HOST_CONFIG, agentRows as rowsOf, forgeConfig, pane } from './run-pane.fixture';
import type { AgentInfo, AgentSpawnInput, On, TurnStepInput } from 'claude-code';

const ROSTER = 'docs/agents/forge.yaml';

// The roles' frontmatter defaults, as core resolves them.
const FRONTMATTER: Record<string, { model: string; effort: string }> = {
  'forge-sdlc:reviewer': { model: 'claude-opus-5-5', effort: 'high' },
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
// the host config's text and `roster` forge.yaml's; undefined means the host
// has none.
function seat(on: On, files: { config?: string; roster?: string }): Seat {
  const s: Seat = { spawns: [], steps: [], toasts: [], agents: [] };
  on('session.start', ($, e) => ({ cwd: e.cwd }));
  on('command.register', ($, e) => ({ value: { command: e.name } }));
  on('ui.open', () => ({ value: { isPlaced: true } }));
  on('ui.toast', ($, e) => {
    s.toasts.push(e.text);
    return { value: undefined };
  });
  on('fs.read', ($, e) => {
    if (e.path.endsWith(HOST_CONFIG) && files.config !== undefined) return { value: files.config };
    if (e.path.endsWith(ROSTER) && files.roster !== undefined) return { value: files.roster };
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
  on('agent.offer', () => ({ isOffered: true }));
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

async function start($: Engine, clock: ReturnType<typeof mock.clock>) {
  await $.session.start({ cwd: '/host', surface: 'terminal', isInteractive: true });
  await clock.advance(5000);
}

// The agent listing: the engine offers each type to the model before dispatch.
async function offer($: Engine, ...types: string[]) {
  for (const agent of types)
    await $.agent.offer({ agent, description: `the ${agent}`, source: 'plugin', provider: { plugin: 'x', tier: 'user' } });
}

async function agentRows($: Engine, clock: ReturnType<typeof mock.clock>) {
  await clock.advance(5000);
  await $.command.run({
    command: 'forge-pane',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 160 },
  });
  const ui = await pane($, 'terminal');
  const rows = rowsOf(await ui.drawn());
  await ui.unmount();
  return rows;
}

const PROMPT = 'Review slice 03.\nworktree: /w/03';

// The Agent tool starting an agent, as the engine raises it; `extra` sets fork,
// resume, workflow or the call's own model.
function spawn($: Engine, subagentType: string, extra: Partial<AgentSpawnInput> = {}) {
  return $.agent.spawn({
    tool_use_id: `toolu_${subagentType}`,
    prompt: PROMPT,
    description: 'review slice 03',
    subagentType,
    provider: { plugin: 'forge-sdlc', tier: 'user' },
    parentModel: 'claude-opus-5-5',
    background: false,
    fork: false,
    ...extra,
  } as AgentSpawnInput);
}

test("a role the roster fills with another offered agent spawns that agent, its brief closed by the role's contract line", async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on, {
    config: forgeConfig(),
    roster: 'version: 1\nroles:\n  reviewer:\n    agent: my-plugin:reviewer\n',
  });
  await start($, clock);
  await offer($, 'forge-sdlc:reviewer', 'my-plugin:reviewer');
  await spawn($, 'forge-sdlc:reviewer');
  expect(s.spawns[0]?.subagentType).toBe('my-plugin:reviewer');
  const lines = s.spawns[0]?.prompt.split('\n') ?? [];
  expect(lines.slice(0, -1).join('\n')).toBe(PROMPT);
  expect(lines.at(-1)).toMatch(/^role contract: \S+\/skills\/build\/ROLES\.md#reviewer$/);
});

// The routing record's `agent` is held by the state contract (AgentRouting.agent);
// a test reads no $.state, so the row's mark is what it sees of the record.
test("a swapped agent's row is marked routed though its model and effort are the defaults", async ($, on) => {
  const clock = mock.clock(on);
  seat(on, {
    config: forgeConfig(),
    roster: 'version: 1\nroles:\n  reviewer:\n    agent: my-plugin:reviewer\n',
  });
  await start($, clock);
  await offer($, 'forge-sdlc:reviewer', 'my-plugin:reviewer');
  await spawn($, 'forge-sdlc:reviewer');
  const rows = await agentRows($, clock);
  expect(rows[0]).toMatch(/^● review slice 03.*⇄ routed/);
});

// One model request in an agent's loop at the model and effort the engine resolved.
async function step($: Engine, agentId: string | undefined, model: string, effort: 'low' | 'medium' | 'high') {
  const stream = $.turn.step({ turnId: 't1', index: 0, model, effort, messageCount: 1, ...(agentId ? { agentId } : {}) });
  while (!(await stream.next()).done) {
    /* nothing streams from the test's bottom */
  }
  return stream.result;
}

test("the roster's model and effort beat ## Routing key by key, and a key it leaves unset still routes", async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on, {
    config: forgeConfig(
      '\n## Routing\n- model.researcher: claude-opus-5-5\n- effort.researcher: high\n- effort.merger: medium\n',
    ),
    roster: 'version: 1\nroles:\n  researcher:\n    model: haiku\n  merger:\n    model: sonnet\n    effort: low\n',
  });
  await start($, clock);
  const researcher = await spawn($, 'forge-sdlc:researcher');
  const merger = await spawn($, 'forge-sdlc:merger');
  // no agent named: the role keeps its type, only model and effort change
  expect(s.spawns.map((e) => [e.subagentType, e.model])).toEqual([
    ['forge-sdlc:researcher', 'haiku'],
    ['forge-sdlc:merger', 'sonnet'],
  ]);
  await step($, researcher.agentId, 'haiku', 'medium');
  await step($, merger.agentId, 'sonnet', 'medium');
  expect(s.steps.map((e) => e.effort)).toEqual(['high', 'low']);
});

test('an unswapped role, a fork, a resume and a workflow agent keep their type and their brief', async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on, {
    config: forgeConfig(),
    roster: 'version: 1\nroles:\n  reviewer:\n    agent: my-plugin:reviewer\n',
  });
  await start($, clock);
  await offer($, 'forge-sdlc:reviewer', 'my-plugin:reviewer', 'forge-sdlc:merger');
  await spawn($, 'forge-sdlc:merger');
  await spawn($, 'fork', { fork: true });
  await spawn($, 'forge-sdlc:reviewer', { resume: { agentId: 'agent-0' } });
  await spawn($, 'forge-sdlc:reviewer', { workflow: { runId: 'wf_1', agentIndex: 1 } });
  expect(s.spawns.map((e) => e.subagentType)).toEqual([
    'forge-sdlc:merger',
    'fork',
    'forge-sdlc:reviewer',
    'forge-sdlc:reviewer',
  ]);
  expect(s.spawns.map((e) => e.prompt)).toEqual([PROMPT, PROMPT, PROMPT, PROMPT]);
  expect(s.spawns[0]?.model).toBeUndefined();
});
