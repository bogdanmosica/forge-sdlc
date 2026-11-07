// The command center: one row per agent with its crew name, the tool
// call it is in, the files it edited, its tokens and its elapsed time, and a
// diff button that opens the diff pane on its worktree.
import { test, expect, mock } from 'claude-code/testing';
import type { Engine } from 'claude-code/testing';
import { PANE, SURFACES, agentRows, paneProps, runPane, seat, start, step } from './run-pane.fixture';

// The git the mod runs for a diff, answered by the seat: a worktree's toplevel,
// its branch, the default branch, a merge base and an empty diff.
const GIT = {
  'rev-parse --show-toplevel': '/host/.worktrees/slice-03\n',
  'rev-parse --abbrev-ref HEAD': 'slice/alpha-03\n',
  'symbolic-ref -q --short refs/remotes/origin/HEAD': 'origin/main\n',
  'merge-base origin/main HEAD': 'abc123\n',
  'diff --stat abc123': '',
  'diff abc123': '',
};

function spawn($: Engine, description: string, cwd?: string) {
  return $.agent.spawn({
    tool_use_id: `toolu_${description}`,
    prompt: 'Work the slice.',
    description,
    subagentType: 'forge-sdlc:implementer',
    provider: { plugin: 'forge-sdlc', tier: 'user' },
    parentModel: 'claude-opus-5-5',
    background: true,
    fork: false,
    ...(cwd ? { cwd } : {}),
  });
}

async function mount($: Engine, surface: (typeof SURFACES)[number], columns = 80) {
  return $.ui.mount({
    plugin: 'forge-sdlc',
    surface,
    component: 'Pane',
    requestId: PANE,
    props: paneProps(columns),
    viewport: { columns: 160, rows: 50, isFullscreen: true },
  });
}

test(
  'a row shows the tool an agent is in with its file, then its files, tokens and elapsed time once the call answers',
  async ($, on) => {
    const clock = mock.clock(on);
    seat(on, { git: GIT });
    on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: 'agent-1' }));
    let release: (() => void) | undefined;
    on('tool.call', () => new Promise<{ result: unknown }>((resolve) => (release = () => resolve({ result: 'ok' }))));
    // eslint-disable-next-line require-yield, sonarjs/generator-without-yield -- a turn.step hook must be an async generator; this stand-in answers whole
    on('turn.step', async function* ($, e) {
      return {
        turnId: e.turnId,
        index: e.index,
        answer: '',
        toolUses: [],
        stopReason: 'end_turn',
        usage: {
          input_tokens: 1000,
          output_tokens: 1200,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
          model: 'claude-fable-5-1',
        },
      };
    });
    await start($, clock);
    await spawn($, 'build slice 03', '/host/.worktrees/slice-03');
    await step($, on, 'agent-1');
    const edit = $.tool.call({
      tool: 'Edit',
      file_path: '/host/.worktrees/slice-03/src/home.ts',
      old_string: 'a',
      new_string: 'b',
      agentId: 'agent-1',
    } as never);
    for (let i = 0; i < 50 && !release; i++) await clock.advance(0);
    await clock.advance(65_000); // thirteen ticks: readAt moves on, the call still open
    await runPane($, 160);
    for (const surface of SURFACES) {
      const ui = await mount($, surface);
      const rows = agentRows(await ui.drawn());
      // the name is the listed agent's (the seat lists agent-1 as the auth flow research), the file's last two segments
      expect(rows[0], surface).toMatch(/^● research the auth flow Edit src\/home\.ts {2}1\.2k↑ 1\.0k↓ 1:05$/);
      expect(rows[1], surface).toMatch(/^✓ review slice 03 completed {2} \?$/); // never spawned here: no start, no tool
      await ui.unmount();
    }
    release?.();
    await edit;
    await clock.advance(5_000);
    const ui = await mount($, 'terminal');
    expect(agentRows(await ui.drawn())[0]).toMatch(/^● research the auth flow thinking 1 file 1\.2k↑ 1\.0k↓ 1:10$/);
    await ui.unmount();
  },
);

test('the diff button opens the diff pane on the directory the call set', async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on, { git: GIT });
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: 'agent-1' }));
  await start($, clock);
  await spawn($, 'build slice 03', '/host/.worktrees/slice-03');
  await clock.advance(5_000);
  await runPane($, 160);
  const ui = await mount($, 'terminal');
  await ui.press({ key: 'diff-agent-1' });
  await clock.advance(10);
  await ui.unmount();
  expect(s.opens.map((o) => o.id)).toContain('workbench-diff');
  const git = s.runs.filter((r) => r.argv[0] === 'git');
  expect(git.map((r) => r.cwd)).toContain('/host/.worktrees/slice-03');
  expect(git.some((r) => r.argv.join(' ') === 'git rev-parse --abbrev-ref HEAD')).toBe(true);
  expect(git.some((r) => r.argv.join(' ').startsWith('git diff'))).toBe(true);
});

test('without a directory on the call, the diff is cut in the worktree of the first edit', async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on, { git: GIT });
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: 'agent-1' }));
  on('tool.call', () => ({ result: 'ok' }));
  await start($, clock);
  await spawn($, 'build slice 03');
  await $.tool.call({
    tool: 'Write',
    file_path: '/host/.worktrees/slice-03/src/home.ts',
    content: '',
    agentId: 'agent-1',
  } as never);
  await clock.advance(5_000);
  await runPane($, 160);
  const ui = await mount($, 'terminal');
  await ui.press({ key: 'diff-agent-1' });
  await clock.advance(10);
  await ui.unmount();
  const toplevel = s.runs.find((r) => r.argv.join(' ') === 'git rev-parse --show-toplevel');
  expect(toplevel?.cwd).toBe('/host/.worktrees/slice-03/src');
  const diff = s.runs.find((r) => r.argv.join(' ').startsWith('git diff'));
  expect(diff?.cwd).toBe('/host/.worktrees/slice-03');
});

test(
  'a narrow pane keeps the name, the elapsed time and the diff button, and drops the rest',
  async ($, on) => {
    const clock = mock.clock(on);
    seat(on, { git: GIT });
    on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: 'agent-1' }));
    await start($, clock);
    await spawn($, 'build slice 03');
    await clock.advance(5_000);
    await runPane($, 100);
    const ui = await mount($, 'terminal', 40);
    const rows = agentRows(await ui.drawn());
    expect(rows[0]).toMatch(/^● research the auth flow 0:05$/);
    expect(rows[0]).not.toMatch(/thinking/);
    await ui.unmount();
  },
);
