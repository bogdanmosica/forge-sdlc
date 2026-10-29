// The workbench mod through `claude plugin test`: the session store and the
// Focus pane, against the stand-in host in workbench.fixture.tsx.
import { test, expect } from 'claude-code/testing';
import type { Engine } from 'claude-code/testing';
import { CWD, RECORD, SID, record, start, texts, turn } from './workbench.fixture';

test('session.start publishes this session: repo, branch, idle', async ($, on) => {
  const { h } = await start($, on);
  const r = record(h);
  expect(r).toMatchObject({ id: SID, cwd: CWD, repo: 'app', branch: 'feat/x', status: 'idle', files: [] });
});

test('a reload of the plugin (session.start again) keeps what the session gathered', async ($, on) => {
  const { h } = await start($, on);
  await $.prompt.submit({ text: 'first prompt' } as never);
  await $.tool.call({ tool: 'Edit', file_path: `${CWD}/a.ts`, old_string: 'a', new_string: 'b' } as never);
  await $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true });
  expect(record(h)).toMatchObject({ title: 'first prompt', files: ['a.ts'] });
});

test('the heartbeat keeps the record fresh every 30 s', async ($, on) => {
  const { h, clock } = await start($, on);
  const first = record(h).updatedAt;
  await clock.advance(30_000);
  expect(record(h).updatedAt).toBe(first + 30_000);
});

test('a prompt sets working, the title stays the first prompt', async ($, on) => {
  const { h } = await start($, on);
  await $.prompt.submit({ text: '## Plan\nPort the lane hook' } as never);
  await $.prompt.submit({ text: 'Now the tasks' } as never);
  expect(record(h)).toMatchObject({ status: 'working', title: 'Port the lane hook', lastPrompt: 'Now the tasks' });
});

test('a question or a plan to approve is needs-you while it is open', async ($, on) => {
  const { h } = await start($, on);
  await $.tool.call({ tool: 'AskUserQuestion', questions: [] } as never);
  await $.tool.call({ tool: 'ExitPlanMode' } as never);
  const states = h.writes
    .map((w) => (w.reason ? `${w.status}: ${w.reason}` : w.status))
    .filter((state, i, all) => state !== all[i - 1]); // the status changes, not every write
  expect(states).toEqual(['idle', 'needs-you: question', 'working', 'needs-you: plan review', 'working']);
});

test('a permission prompt still open after 6 s is needs-you; one answered sooner never shows', async ($, on) => {
  const { h, clock } = await start($, on);
  h.holdPermission = true;
  const slow = $.tool.call({ tool: 'Bash', command: 'rm -rf build' } as never);
  for (let i = 0; i < 50 && !h.release; i++) await clock.advance(0);
  expect(h.release).toBeDefined();
  await clock.advance(5_999);
  expect(record(h).status).toBe('idle');
  await clock.advance(1);
  expect(record(h)).toMatchObject({ status: 'needs-you', reason: 'permission: Bash' });
  h.release?.();
  await slow;
  expect(record(h).status).toBe('working');

  h.holdPermission = false;
  await $.tool.call({ tool: 'Bash', command: 'ls' } as never);
  await clock.advance(10_000);
  expect(h.writes.filter((w) => w.reason === 'permission: Bash')).toHaveLength(1);
});

test('a question kept open past 6 s keeps its own reason', async ($, on) => {
  const { h, clock } = await start($, on);
  h.holdPermission = true;
  const asking = $.tool.call({ tool: 'AskUserQuestion', questions: [] } as never);
  for (let i = 0; i < 50 && !h.release; i++) await clock.advance(0);
  await clock.advance(10_000);
  expect(record(h)).toMatchObject({ status: 'needs-you', reason: 'question' });
  h.release?.();
  await asking;
});

test('edits land in files, relative to the session folder, newest first, no repeats', async ($, on) => {
  const { h } = await start($, on);
  await $.tool.call({ tool: 'Edit', file_path: `${CWD}/src/a.ts`, old_string: 'a', new_string: 'b' } as never);
  await $.tool.call({ tool: 'Write', file_path: '/elsewhere/x.md', content: 'x' } as never);
  await $.tool.call({ tool: 'Edit', file_path: `${CWD}/src/a.ts`, old_string: 'b', new_string: 'c' } as never);
  await $.tool.call({ tool: 'Read', file_path: `${CWD}/README.md` } as never);
  expect(record(h).files).toEqual(['src/a.ts', '/elsewhere/x.md']);
});

test('a finished turn sets idle with the first plain line of the answer', async ($, on) => {
  const { h } = await start($, on);
  await $.prompt.submit({ text: 'go' } as never);
  await turn($, '## Done\n\n- Moved the **hooks**.');
  expect(record(h)).toMatchObject({ status: 'idle', lastReply: 'Moved the **hooks**.' });
  expect(record(h).lastTurnAt).toBeGreaterThan(0);
});

test('a subagent turn leaves the session working', async ($, on) => {
  const { h } = await start($, on);
  await $.prompt.submit({ text: 'go' } as never);
  await $.turn.complete({
    answer: 'sub',
    durationMs: 1,
    isAborted: false,
    turnId: 't2',
    agentId: 'a1',
    reason: 'end_turn',
  } as never);
  expect(record(h).status).toBe('working');
});

test('usage numbers come from session.measure', async ($, on) => {
  const { h } = await start($, on);
  await $.session.measure({
    context: { percent: 34, window: 1_000_000, tokens: 340_000 },
    rateLimits: [{ kind: 'five_hour', percentUsed: 9, resetsAt: '2026-10-27T15:00:00Z', source: 'api' }],
    cost: { usd: 1.25 },
    changed: [],
  } as never);
  expect(record(h)).toMatchObject({ ctxPercent: 34, costUsd: 1.25, limits: [{ kind: 'five_hour', percentUsed: 9 }] });
});

test('session.end removes the record', async ($, on) => {
  const { h } = await start($, on);
  await $.session.end({ reason: 'exit', sessionId: SID, resume: { id: SID } } as never);
  expect(h.files[RECORD]).toBeUndefined();
});

async function focusText($: Engine): Promise<string> {
  await $.command.run({
    command: 'focus-pane',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 120 },
  } as never);
  const ui = await $.ui.mount({
    plugin: 'workbench',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'workbench-focus',
    props: {
      title: 'Focus',
      isFocused: false,
      bodyColumns: 80,
      placement: 'inline',
      scroll: { offset: 0, bodyRows: 40 },
      view: {},
    },
    viewport: { columns: 120, rows: 50, isFullscreen: true },
  } as never);
  return texts(await ui.drawn());
}

test('the Focus pane shows branch, counts, the MR with its pipeline, usage and files', async ($, on) => {
  const { h } = await start($, on);
  h.glab = JSON.stringify({
    iid: 47,
    web_url: 'https://gitlab.example/x/-/merge_requests/47',
    state: 'opened',
    draft: false,
    head_pipeline: { status: 'failed' },
  });
  await $.tool.call({ tool: 'Edit', file_path: `${CWD}/src/a.ts`, old_string: 'a', new_string: 'b' } as never);
  const text = await focusText($);
  for (const part of ['feat/x', '2 uncommitted', '↑1', '!47', 'ci failed', 'src/a.ts', 'app'])
    expect(text).toContain(part);
});

test('without glab or on main the Focus pane says no MR was found', async ($, on) => {
  const { h } = await start($, on, (host) => {
    host.git['rev-parse --abbrev-ref HEAD'] = 'main\n';
  });
  const text = await focusText($);
  expect(text).toContain('no MR found');
  expect(h.runs.filter((r) => r[0] === 'glab')).toEqual([]);
});
