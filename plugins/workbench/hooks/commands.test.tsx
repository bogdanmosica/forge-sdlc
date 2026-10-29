// The slash commands through `claude plugin test`: /diff-pane against git answers,
// /side-chat against a stand-in fork, /morning against glab per folder, and
// /crew against a stand-in spawn, each pane drawn and read back as text.
import { test, expect } from 'claude-code/testing';
import type { Engine } from 'claude-code/testing';
import { CWD, HOME, start, texts } from './workbench.fixture';
import { mrIssues } from './commands';
import type { SessionRecord } from './types';

const NOW = Date.UTC(2026, 9, 27, 12, 0, 0);
const PATCH = 'diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-a\n+b\n';

const command = ($: Engine, name: string, args = '') =>
  $.command.run({
    command: name,
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 120 },
  } as never) as Promise<{ text: string }>;

async function pane($: Engine, requestId: string) {
  const ui = await $.ui.mount({
    plugin: 'workbench',
    surface: 'terminal',
    component: 'Pane',
    requestId,
    props: {
      title: requestId,
      isFocused: true,
      bodyColumns: 120,
      placement: 'inline',
      scroll: { offset: 0, bodyRows: 40 },
      view: {},
    },
    viewport: { columns: 140, rows: 50, isFullscreen: true },
  } as never);
  const tree = await ui.drawn();
  // the texts, then the whole tree: a Code's source and a Markdown's text are props, not children
  return `${texts(tree)}\n${JSON.stringify(tree)}`;
}

test('/diff-pane on a feature branch shows the branch against its merge base, working tree included', async ($, on) => {
  await start($, on, (h) => {
    Object.assign(h.git, {
      'symbolic-ref -q --short refs/remotes/origin/HEAD': 'origin/main\n',
      'merge-base origin/main HEAD': 'abc123\n',
      'diff --stat abc123': ' a.ts | 2 +-\n',
      'diff abc123': PATCH,
    });
  });
  const reply = await command($, 'diff-pane');
  expect(reply.text).toBe('Diff opened: feat/x against origin/main (working tree included).');
  const text = await pane($, 'workbench-diff');
  expect(text).toContain('a.ts | 2 +-');
  expect(text).toContain('+b');
});

test('/diff-pane on main defaults to the working tree; staged and a ref are explicit', async ($, on) => {
  const { h } = await start($, on, (host) => {
    Object.assign(host.git, {
      'rev-parse --abbrev-ref HEAD': 'main\n',
      'diff --stat HEAD': '',
      'diff HEAD': '',
      'diff --stat --staged': ' b.ts | 1 +\n',
      'diff --staged': PATCH,
      'diff --stat v1.0': '',
      'diff v1.0': PATCH,
    });
  });
  expect((await command($, 'diff-pane')).text).toBe('Diff opened: Working tree against HEAD.');
  expect(await pane($, 'workbench-diff')).toContain('No changes.');
  expect((await command($, 'diff-pane', 'staged')).text).toBe('Diff opened: Staged changes.');
  expect((await command($, 'diff-pane', 'v1.0')).text).toBe('Diff opened: Working tree against v1.0.');
  expect(h.runs.some((r) => r.join(' ') === 'git diff v1.0')).toBe(true);
});

test('/diff-pane refuses a ref that would pass as a git option, and says when git fails', async ($, on) => {
  const { h } = await start($, on);
  expect((await command($, 'diff-pane', '--output=/tmp/x')).text).toBe('Diff: a ref cannot start with "-".');
  expect(h.runs.some((r) => r.includes('--output=/tmp/x'))).toBe(false);
  expect((await command($, 'diff-pane', 'nosuchref')).text).toContain('git diff failed');
});

test('/side-chat answers through a fork in its pane, never in the conversation', async ($, on) => {
  const { h } = await start($, on);
  const reply = await command($, 'side-chat', 'Why did the lane hook move?');
  expect(h.forks).toEqual(['Why did the lane hook move?']);
  expect(reply.text).not.toContain('Answer');
  const text = await pane($, 'workbench-side-chat');
  expect(text).toContain('Why did the lane hook move?');
  expect(text).toContain('Answer');
  expect((await command($, 'side-chat')).text).toBe('Usage: /side-chat <question>');
});

test('/side-chat falls back to one completion over the recent conversation when there is nothing to fork', async ($, on) => {
  const { h } = await start($, on, (host) => {
    host.forkable = false;
  });
  const reply = await command($, 'side-chat', 'What was renamed?');
  expect(reply.text).toBe('Side chat answered in its pane; nothing was added to this conversation.');
  expect(h.completions[0]).toContain('Renamed it to claude-lane.sh.');
  expect(h.completions[0]).toContain('Side question: What was renamed?');
  expect(await pane($, 'workbench-side-chat')).toContain('From the transcript: renamed.');
});

test('the MR issues the morning check flags', () => {
  expect(
    mrIssues({ head_pipeline: { status: 'failed' }, has_conflicts: true, blocking_discussions_resolved: false }),
  ).toEqual(['pipeline failed', 'conflicts', 'threads open']);
  expect(
    mrIssues({ head_pipeline: { status: 'success' }, has_conflicts: false, blocking_discussions_resolved: true }),
  ).toEqual([]);
});

test("/morning checks every live session's MR and lists the ones needing attention", async ($, on) => {
  const record = (id: string, cwd: string, branch: string): SessionRecord => ({
    id,
    cwd,
    repo: id,
    branch,
    title: '',
    lastPrompt: '',
    lastReply: '',
    status: 'idle',
    since: NOW,
    startedAt: NOW,
    updatedAt: NOW,
    files: [],
    limits: [],
  });
  const { h } = await start($, on, (host) => {
    for (const r of [
      record('api', '/repo/api', 'feat/a'),
      record('web', '/repo/web', 'feat/b'),
      record('ops', '/repo/ops', 'feat/c'),
      record('lib', '/repo/lib', 'main'),
    ]) {
      host.files[`${HOME}/.cache/workbench/sessions/${r.id}.json`] = JSON.stringify(r);
    }
    host.glabByCwd = {
      '/repo/api': JSON.stringify({
        iid: 12,
        web_url: 'https://gl/api/12',
        head_pipeline: { status: 'failed' },
        has_conflicts: false,
        blocking_discussions_resolved: false,
      }),
      '/repo/web': JSON.stringify({
        iid: 7,
        web_url: 'https://gl/web/7',
        head_pipeline: { status: 'success' },
        has_conflicts: false,
        blocking_discussions_resolved: true,
      }),
    };
  });
  const reply = await command($, 'morning');
  expect(reply.text).toBe('Morning check: 1 MR need attention.');
  const text = await pane($, 'workbench-morning');
  expect(text).toContain('api');
  expect(text).toContain('pipeline failed · threads open');
  expect(text).toContain('1 other MR fine');
  expect(text).toContain('branch(es) without an MR'); // ops has none, and this session (feat/x) too
  expect(h.runs.filter((r) => r[0] === 'glab').map((r) => r[3])).not.toContain('main');
  expect(CWD).toBe('/repo/app');
});

test('/crew starts a named background agent of the given type', async ($, on) => {
  const { h } = await start($, on);
  const reply = await command($, 'crew', 'pocock-skills:researcher Find where the lanes are set');
  const spawned = JSON.stringify(h.spawns[0]);
  for (const part of ['Find where the lanes are set', 'pocock-skills:researcher', '"researcher"'])
    expect(spawned).toContain(part);
  expect(reply.text).toContain('not started under test'); // the host refused it, and the command says so
  expect((await command($, 'crew', 'Explore')).text).toBe('Usage: /crew <agent type> <task>');
});

test('a command name another plugin holds is skipped; the rest register and the session starts', async ($, on) => {
  const { h } = await start($, on, (host) => {
    host.refused = ['diff-pane'];
  });
  expect(h.registered).toEqual(expect.arrayContaining(['focus-pane', 'boards', 'side-chat', 'morning', 'crew']));
  expect(h.registered).not.toContain('diff-pane');
  expect(Object.keys(h.files).some((f) => f.endsWith('/sess-1.json'))).toBe(true);
});
