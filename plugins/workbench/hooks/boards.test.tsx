// The Boards pane through `claude plugin test`: other sessions' records and a
// team roster laid in the stand-in host's file system, the pane drawn, its
// tabs and buttons pressed.
import { test, expect } from 'claude-code/testing';
import type { Engine } from 'claude-code/testing';
import { HOME, start, texts } from './workbench.fixture';
import type { Host } from './workbench.fixture';
import { isUnread, laneOf } from './boards';
import type { SessionRecord } from './types';

const NOW = Date.UTC(2026, 9, 27, 12, 0, 0);

function other(id: string, fields: Partial<SessionRecord>): SessionRecord {
  return {
    id,
    cwd: `/repo/${id}`,
    repo: id,
    branch: 'main',
    title: `${id} title`,
    lastPrompt: `${id} prompt`,
    lastReply: `${id} reply`,
    status: 'idle',
    since: NOW - 60_000,
    startedAt: NOW - 3_600_000,
    updatedAt: NOW,
    files: [],
    limits: [],
    ...fields,
  };
}

function lay(h: Host, records: SessionRecord[]) {
  for (const r of records) h.files[`${HOME}/.cache/workbench/sessions/${r.id}.json`] = JSON.stringify(r);
}

const RECORDS = [
  other('api', { status: 'needs-you', reason: 'permission: Bash', since: NOW - 120_000 }),
  other('web', { status: 'working', branch: 'feat/login', ctxPercent: 42, costUsd: 1.5 }),
  other('docs', { status: 'idle', dirty: 2, lastTurnAt: NOW - 30_000, lastReply: 'Wrote the guide.' }),
  other('old', { status: 'working', updatedAt: NOW - 600_000 }), // its session died without session.end
];

async function boards($: Engine) {
  await $.command.run({
    command: 'boards',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 140 },
  } as never);
  return $.ui.mount({
    plugin: 'workbench',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'workbench-boards',
    props: {
      title: 'Boards',
      isFocused: true,
      bodyColumns: 120,
      placement: 'inline',
      scroll: { offset: 0, bodyRows: 40 },
      view: {},
    },
    viewport: { columns: 140, rows: 50, isFullscreen: true },
  } as never);
}

test('lanes: needs-you and working as reported, idle with uncommitted or unpushed work is review', () => {
  expect(RECORDS.map(laneOf)).toEqual(['needs-you', 'working', 'review', 'working']);
  expect(laneOf(other('x', { ahead: 1 }))).toBe('review');
  expect(laneOf(other('x', {}))).toBe('idle');
});

test('unread: waiting on a person, or a turn finished after it was marked read', () => {
  const since = NOW - 3_600_000;
  expect(isUnread(RECORDS[0]!, {}, since)).toBe(true);
  expect(isUnread(RECORDS[2]!, {}, since)).toBe(true);
  expect(isUnread(RECORDS[2]!, { docs: NOW }, since)).toBe(false);
  expect(isUnread(other('x', {}), {}, since)).toBe(false);
  expect(isUnread(RECORDS[0]!, { api: NOW }, since)).toBe(false); // marked read after it started waiting
  expect(isUnread({ ...RECORDS[0]!, since: NOW + 1 }, { api: NOW }, since)).toBe(true); // a newer prompt
});

test('the Board tab lists every live session by repo with its status, branch and prompt; a stale record is left out', async ($, on) => {
  const { h } = await start($, on, (host) => lay(host, RECORDS));
  const ui = await boards($);
  const text = texts(await ui.drawn());
  for (const part of [
    'api',
    'needs you: permission: Bash',
    'web',
    'feat/login',
    'ctx 42%',
    '$1.50',
    'docs',
    'docs prompt',
    'app',
    '(this session)',
  ]) {
    expect(text).toContain(part);
  }
  expect(text).not.toContain('old prompt');
  expect(h.copied).toEqual([]);
});

test('the Lanes tab groups sessions into needs-you, working, review and idle', async ($, on) => {
  await start($, on, (host) => lay(host, RECORDS));
  const ui = await boards($);
  await ui.press({ key: 'tab-lanes' });
  const text = texts(await ui.drawn());
  // this session is review too: the host's git reports two uncommitted files
  expect(text).toMatch(/NEEDS-YOU \(1\).*api.*WORKING \(1\).*web.*REVIEW \(2\).*docs.*app.*IDLE \(0\)/s);
});

test('the Inbox lists waiting and finished sessions until marked read', async ($, on) => {
  const { h, clock } = await start($, on, (host) => lay(host, RECORDS));
  await clock.advance(60_000);
  // docs finishes a turn after this session started: unread here
  lay(h, [{ ...RECORDS[2]!, lastTurnAt: NOW + 30_000, updatedAt: NOW + 60_000 }]);
  const ui = await boards($);
  await ui.press({ key: 'tab-inbox' });
  let text = texts(await ui.drawn());
  expect(text).toContain('2 unread');
  expect(text).toContain('done: Wrote the guide.');
  await ui.press({ key: 'read-docs' });
  text = texts(await ui.drawn());
  expect(text).toContain('1 unread');
  expect(text).not.toContain('Wrote the guide.');
  await ui.press({ key: 'inbox-all' });
  expect(texts(await ui.drawn())).toContain('0 unread'); // until a session asks again
});

test('resume copies the command that reopens that session', async ($, on) => {
  const { h } = await start($, on, (host) => lay(host, RECORDS));
  const ui = await boards($);
  await ui.press({ key: 'resume-web' });
  expect(h.copied).toEqual(['cd "/repo/web" && claude --resume web']);
});

test('the Crew tab lists each agent team with its lead and members', async ($, on) => {
  await start($, on, (host) => {
    host.files[`${HOME}/.claude/teams/alpha/config.json`] = JSON.stringify({
      members: [
        { name: 'team-lead', model: 'opus' },
        { name: 'scribe', model: 'haiku', prompt: 'Write the greeting', isActive: true },
        { name: 'critic', model: 'haiku', prompt: 'Review it', isActive: false },
      ],
    });
  });
  const ui = await boards($);
  await ui.press({ key: 'tab-crew' });
  const text = texts(await ui.drawn());
  for (const part of ['alpha', '(3 total)', 'lead', 'scribe', 'Write the greeting', 'critic'])
    expect(text).toContain(part);
});

test('with no team running the Crew tab says how to start one', async ($, on) => {
  await start($, on);
  const ui = await boards($);
  await ui.press({ key: 'tab-crew' });
  expect(texts(await ui.drawn())).toContain('No agent team is running');
});

test('a record left by a killed session is ignored after two minutes and removed after a day', async ($, on) => {
  const { h } = await start($, on, (host) =>
    lay(host, [other('dead', { updatedAt: NOW - 25 * 3_600_000 }), other('quiet', { updatedAt: NOW - 600_000 })]),
  );
  await boards($);
  expect(h.files[`${HOME}/.cache/workbench/sessions/dead.json`]).toBeUndefined();
  expect(h.files[`${HOME}/.cache/workbench/sessions/quiet.json`]).toBeDefined();
});
