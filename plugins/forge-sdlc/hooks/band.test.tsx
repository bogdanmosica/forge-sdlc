// The needs-you band through `claude plugin test`: other sessions' records laid
// in the stand-in host, the band above the prompt drawn and its buttons pressed.
import { test, expect } from 'claude-code/testing';
import type { Engine } from 'claude-code/testing';
import { HOME, start, texts } from './workbench.fixture';
import type { Host } from './workbench.fixture';
import type { SessionRecord } from './types';

const NOW = Date.UTC(2026, 9, 27, 12, 0, 0);

function other(id: string, fields: Partial<SessionRecord>): SessionRecord {
  return {
    id,
    cwd: `/repo/${id}`,
    repo: id,
    title: '',
    lastPrompt: `${id} prompt`,
    lastReply: `${id} reply`,
    status: 'idle',
    since: NOW,
    startedAt: NOW - 3_600_000,
    updatedAt: NOW + 60_000,
    files: [],
    limits: [],
    ...fields,
  };
}

function lay(h: Host, records: SessionRecord[]) {
  for (const r of records) h.files[`${HOME}/.cache/workbench/sessions/${r.id}.json`] = JSON.stringify(r);
}

async function band($: Engine) {
  return $.ui.mount({
    plugin: 'forge-sdlc',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: {
      hasSurvey: false,
      isWorking: false,
      maxRows: 10,
      bodyColumns: 140,
      scroll: { offset: 0, bodyRows: 9 },
      view: {},
    },
  } as never);
}

// The session starts at NOW; a minute later the others have moved on.
async function later($: Engine, on: Parameters<typeof start>[1], records: SessionRecord[]) {
  const { h, clock } = await start($, on);
  await clock.advance(60_000);
  lay(h, records);
  await clock.advance(5_000); // the Boards refresh picks them up
  return h;
}

test('waiting sessions come first, oldest first, then sessions done while away', async ($, on) => {
  await later($, on, [
    other('web', { status: 'needs-you', reason: 'question', since: NOW + 30_000 }),
    other('api', { status: 'needs-you', reason: 'permission: Bash', since: NOW + 10_000 }),
    other('docs', { status: 'idle', lastTurnAt: NOW + 50_000, lastReply: 'Wrote the guide.' }),
    other('quiet', { status: 'idle', lastTurnAt: NOW - 10_000 }), // finished before this session started
  ]);
  const text = texts(await (await band($)).drawn());
  expect(text).toMatch(/api needs you: permission: Bash.*web needs you: question.*docs done: Wrote the guide\./s);
  expect(text).not.toContain('quiet');
});

test('a prompt waiting over an hour leaves the band; more than three rows fold into a count', async ($, on) => {
  const { h, clock } = await start($, on);
  await clock.advance(2 * 3_600_000);
  const at = NOW + 2 * 3_600_000;
  lay(h, [
    other('stale', { status: 'needs-you', reason: 'question', since: at - 3_700_000, updatedAt: at }),
    ...['a', 'b', 'c', 'd'].map((id, i) =>
      other(id, { status: 'needs-you', reason: 'question', since: at - 1000 * (i + 1), updatedAt: at }),
    ),
  ]);
  await clock.advance(5_000);
  const text = texts(await (await band($)).drawn());
  expect(text).not.toContain('stale');
  expect(text).toContain('+1 more in /boards');
});

test('× hides a row until that session asks again; resume copies the command', async ($, on) => {
  const h = await later($, on, [other('api', { status: 'needs-you', reason: 'question', since: NOW + 10_000 })]);
  const ui = await band($);
  await ui.press({ key: 'band-resume-api' });
  expect(h.copied).toEqual(['cd "/repo/api" && claude --resume api']);
  await ui.press({ key: 'band-dismiss-api' });
  expect(texts(await ui.drawn())).not.toContain('api needs you');
});

test("with nothing to show the band is left as the run's band beneath draws it", async ($, on) => {
  await later($, on, [other('docs', { status: 'idle', lastTurnAt: NOW - 10_000 })]);
  const text = texts(await (await band($)).drawn());
  expect(text).not.toMatch(/needs you|done:/);
  expect(text).toContain('the run at a glance'); // the run pane's band (run-band.tsx), untouched
});
