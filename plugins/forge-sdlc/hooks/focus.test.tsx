// The Focus pane's sections through `claude plugin test`: the diff against the
// default branch, the Jira ticket, the ready-to-merge checklist, the prompt
// cache chip and the rate-limit resets, each drawn and read back as text.
import { test, expect } from 'claude-code/testing';
import type { Engine } from 'claude-code/testing';
import { HOME, start, step, texts } from './workbench.fixture';
import { CACHE_TTL_MS, cacheChip, gateSummary, mergeGates } from './focus';
import { jiraKey, parseEnv } from './jira';
import type { FocusMr } from './types';

const NOW = Date.UTC(2026, 9, 27, 12, 0, 0);
const MIN = 60_000;

const runFocus = ($: Engine) =>
  $.command.run({
    command: 'focus-pane',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 120 },
  } as never);

// Opens the pane once; each call of the returned function refreshes it (as
// /focus-pane does) and reads the drawing back as text.
async function focusPane($: Engine): Promise<() => Promise<string>> {
  await runFocus($);
  const ui = await $.ui.mount({
    plugin: 'forge-sdlc',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'workbench-focus',
    props: {
      title: 'Focus',
      isFocused: false,
      bodyColumns: 100,
      placement: 'inline',
      scroll: { offset: 0, bodyRows: 40 },
      view: {},
    },
    viewport: { columns: 120, rows: 50, isFullscreen: true },
  } as never);
  return async () => {
    await runFocus($);
    return texts(await ui.drawn());
  };
}

const focusText = async ($: Engine) => (await focusPane($))();

const OPEN_MR = {
  iid: 47,
  web_url: 'https://gitlab.example/x/-/merge_requests/47',
  state: 'opened',
  draft: false,
  head_pipeline: { status: 'success' },
  has_conflicts: false,
  blocking_discussions_resolved: true,
  detailed_merge_status: 'mergeable',
};

test('the branch line shows what it adds over the default branch, untracked files counted', async ($, on) => {
  await start($, on, (h) => {
    Object.assign(h.git, {
      'symbolic-ref -q --short refs/remotes/origin/HEAD': 'origin/main\n',
      'merge-base origin/main HEAD': 'abc123\n',
      'diff --shortstat abc123 --': ' 3 files changed, 40 insertions(+), 2 deletions(-)\n',
      'ls-files --others --exclude-standard': 'new.ts\n',
    });
    h.wc = '       6 new.ts\n';
  });
  expect(await focusText($)).toContain('+46 −2 vs main');
});

test('the Jira key comes from the branch; trunk and keyless branches have none', () => {
  expect(jiraKey('feat/eosmkp-188701-port-focus')).toBe('EOSMKP-188701');
  expect(jiraKey('main')).toBeUndefined();
  expect(jiraKey('chore/workbench-migration')).toBeUndefined();
  expect(parseEnv('export A="x y"\n# c\nB=z # note\nbad line\n')).toEqual({ A: 'x y', B: 'z' });
});

test('the ticket row shows key, status and summary; the token reaches only the request', async ($, on) => {
  const { h, clock } = await start($, on, (host) => {
    host.git['rev-parse --abbrev-ref HEAD'] = 'feat/eosmkp-188701-port-focus\n';
    host.env.WORKBENCH_JIRA_ENV = '/secrets/jira.env';
    host.files['/secrets/jira.env'] =
      'JIRA_DOMAIN=jira.example\nJIRA_EMAIL=dev@example.com\nJIRA_API_TOKEN="<YOUR_API_KEY>"\n';
    host.jira['EOSMKP-188701'] = JSON.stringify({
      key: 'EOSMKP-188701',
      fields: { summary: 'Port  the Focus board', status: { name: 'In Progress' } },
    });
  });
  const draw = await focusPane($);
  const text = await draw();
  for (const part of ['EOSMKP-188701', '[In Progress]', 'Port the Focus board']) expect(text).toContain(part);
  expect(h.fetches[0]?.url).toBe('https://jira.example/rest/api/2/issue/EOSMKP-188701?fields=summary,status');
  expect(h.fetches[0]?.headers.Authorization).toMatch(/^Basic /);
  const stored = Object.entries(h.files)
    .filter(([path]) => path !== '/secrets/jira.env')
    .map(([, body]) => body)
    .join('\n');
  expect(stored).not.toContain('<YOUR_API_KEY>');
  expect(stored).not.toContain(h.fetches[0]?.headers.Authorization?.slice(6) ?? '');
  expect(h.files[`${HOME}/.cache/workbench/jira/EOSMKP-188701.json`]).toContain('In Progress');

  // within the 10-minute cache a refresh reads the file, not Jira
  await clock.advance(5 * MIN);
  await draw();
  expect(h.fetches).toHaveLength(1);
});

test('without credentials or off VPN there is no ticket row and no error', async ($, on) => {
  const { h } = await start($, on, (host) => {
    host.git['rev-parse --abbrev-ref HEAD'] = 'feat/abc-12\n';
    host.env.WORKBENCH_JIRA_ENV = '/nowhere/.env';
  });
  expect(await focusText($)).not.toContain('ABC-12');
  expect(h.fetches).toEqual([]);
});

test('the merge gates follow the cmux Focus board', () => {
  const mr: FocusMr = {
    iid: 1,
    url: 'u',
    state: 'opened',
    pipeline: 'success',
    isDraft: false,
    hasConflicts: false,
    threadsOpen: false,
    mergeStatus: 'mergeable',
    checkedAt: NOW,
  };
  const clean = { dirty: 0, ahead: 0, checkedAt: NOW };
  expect(gateSummary(mergeGates(mr, clean)!)).toEqual({ text: 'ready to merge', color: 'green' });
  expect(mergeGates({ ...mr, state: 'merged' }, clean)).toBeNull();
  const busy = mergeGates({ ...mr, pipeline: 'running', mergeStatus: 'checking', threadsOpen: undefined }, clean)!;
  expect(busy.map((g) => g.state)).toEqual(['wait', 'ok', 'unknown', 'unknown', 'ok']);
  expect(gateSummary(busy)).toEqual({ text: '3 pending', color: 'yellow' });
  const bad = mergeGates(
    { ...mr, pipeline: 'failed', mergeStatus: 'need_rebase', threadsOpen: true, isDraft: true },
    { ...clean, dirty: 1 },
  )!;
  expect(bad.filter((g) => g.state === 'fail').map((g) => g.label)).toEqual([
    'CI green',
    'No conflicts',
    'Threads resolved',
    'Not a draft',
    'Tree clean',
  ]);
  expect(bad.find((g) => g.label === 'No conflicts')?.detail).toBe('needs rebase');
});

test('an open MR draws the READY TO MERGE checklist with its summary', async ($, on) => {
  const { h } = await start($, on);
  h.glab = JSON.stringify(OPEN_MR);
  const draw = await focusPane($);
  let text = await draw();
  expect(text).toContain('READY TO MERGE 1 blocking'); // the host's tree has two uncommitted files
  expect(text).toContain('✗ Tree clean · uncommitted changes');
  expect(text).toContain('✓ CI green · passed');
  h.git['status --porcelain --untracked-files=no'] = '';
  text = await draw();
  expect(text).toContain('READY TO MERGE ready to merge');
});

test('no checklist without an open MR', async ($, on) => {
  const { h } = await start($, on);
  h.glab = JSON.stringify({ ...OPEN_MR, state: 'merged' });
  expect(await focusText($)).not.toContain('READY TO MERGE');
});

test('the cache chip counts down the TTL, turns yellow in its last sixth and red once cold', () => {
  const warm = { at: NOW, tokens: 105_000, isObserved: true };
  expect(cacheChip(null, NOW)).toBeNull();
  expect(cacheChip(warm, NOW + 20 * MIN)).toEqual({ text: 'cache 40m', color: 'green' });
  expect(cacheChip(warm, NOW + 55 * MIN)).toEqual({ text: 'cache 5m', color: 'yellow' });
  expect(cacheChip(warm, NOW + CACHE_TTL_MS)).toEqual({ text: 'cache cold · 105k', color: 'red' });
  expect(cacheChip({ ...warm, isObserved: false }, NOW)).toEqual({ text: 'cache off', color: 'gray' });
});

test("the cache chip follows the main thread's last request; a subagent's leaves it", async ($, on) => {
  const { h, clock } = await start($, on);
  const draw = await focusPane($);
  expect(await draw()).not.toContain('cache');
  await step($);
  expect(await draw()).toContain('cache 1h 0m');
  await clock.advance(30 * MIN);
  await step($, 'agent-1'); // a subagent's request is its own cache
  expect(await draw()).toContain('cache 30m');
  await clock.advance(31 * MIN);
  expect(await draw()).toContain('cache cold · 105k'); // 3 + 90 000 + 14 497 + 500
  h.usage = { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
  await step($);
  expect(await draw()).toContain('cache off');
});

test('each rate-limit window shows the time until it resets', async ($, on) => {
  await start($, on);
  await $.session.measure({
    context: { percent: 12, window: 1_000_000, tokens: 120_000 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 34, resetsAt: new Date(NOW + 130 * MIN).toISOString() },
      { kind: 'seven_day', percentUsed: 80, resetsAt: new Date(NOW + 76 * 60 * MIN).toISOString() },
    ],
    cost: { usd: 2 },
    changed: [],
  } as never);
  const text = await focusText($);
  expect(text).toContain('5h 34% ↻2h 10m');
  expect(text).toContain('7d 80% ↻3d 4h');
});
