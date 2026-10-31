// The run pane through `claude plugin test`, for the per-agent table, the price
// table, the run store and `/forge-pane history|export`. The world beneath the
// mod is run-pane.fixture.tsx; the store is the seat's.
import { test, expect, mock } from 'claude-code/testing';
import type { Engine } from 'claude-code/testing';
import type { On } from 'claude-code';
import { SURFACES, pane, runPane, seat, start, step, textsUnder } from './run-pane.fixture';

// The model beneath: every request costs 1000 in and 500 cache read on
// claude-fable-5-1; agent-1 answers 1200 out per request, the main session 7.
function answerSteps(on: On) {
  // eslint-disable-next-line require-yield -- a turn.step hook must be an async generator (StreamHookBody); this stand-in answers whole, with no chunks
  on('turn.step', async function* ($, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn',
      usage: {
        input_tokens: 1000,
        output_tokens: e.agentId === 'agent-1' ? 1200 : 7,
        cache_read_input_tokens: 500,
        cache_creation_input_tokens: 0,
        model: 'claude-fable-5-1',
      },
    };
  });
}

// Two requests by agent-1 and one by the main session.
async function threeSteps($: Engine, on: On) {
  await step($, on, 'agent-1');
  await step($, on, 'agent-1');
  await step($, on, undefined);
}

const RUN = 'run:docs/efforts/alpha:2026-10-07T10:00:00.000Z';

test('the table toggle shows one row per agent with model, tokens and the USD estimate from the price table', async ($, on) => {
  const clock = mock.clock(on);
  seat(on);
  answerSteps(on);
  await start($, clock);
  await threeSteps($, on);
  await runPane($, 160);
  for (const surface of SURFACES) {
    const ui = await pane($, surface);
    expect(textsUnder(await ui.drawn(), 'agent-table'), surface).toHaveLength(0);
    await ui.press({ key: 'table' });
    const tree = await ui.drawn();
    const rows = textsUnder(tree, 'agent-table-rows');
    expect(rows, surface).toHaveLength(2);
    // agent-1 at the fixture prices: 2000 in × $10 + 2400 out × $100 + 1000 cache read × $1, per million = $0.2610
    expect(
      rows.find((r) => r.startsWith('researcher')),
      surface,
    ).toMatch(/claude-fable-5-1.*2\.4k.*2\.0k.*1\.0k.*\$0\.2610/);
    // main: 1000 × $10 + 7 × $100 + 500 × $1, per million = $0.0112
    expect(
      rows.find((r) => r.startsWith('main')),
      surface,
    ).toMatch(/claude-fable-5-1.*\$0\.0112/);
    expect(textsUnder(tree, 'agent-table-note').join(' '), surface).toMatch(/list-price estimate.*2026-01-02/);
    await ui.press({ key: 'table' });
    expect(textsUnder(await ui.drawn(), 'agent-table'), surface).toHaveLength(0);
    await ui.unmount();
  }
});

// Three requests, then one tick: the run's totals are stored keyed by map and
// run, and nothing in the store names the person: no email, no home path, no
// cwd, not even the agents' free-text descriptions.
test('the store keeps per-run totals per agent keyed by map and run, with no user identifier', async ($, on) => {
  const clock = mock.clock(on, { now: Date.UTC(2026, 9, 7, 10, 0, 0) });
  const s = seat(on);
  answerSteps(on);
  await start($, clock);
  await threeSteps($, on);
  await clock.advance(5000);
  expect(Object.keys(s.store)).toEqual([RUN]);
  const record = s.store[RUN] as Record<string, unknown>;
  expect(record).toMatchObject({
    map: 'docs/efforts/alpha',
    title: 'Alpha port',
    run: '2026-10-07T10:00:00.000Z',
    slices: { total: 6, closed: 2 },
    stage: 'no state',
  });
  expect(record.agents).toMatchObject({
    'agent-1': {
      type: 'researcher',
      model: 'claude-fable-5-1',
      input: 2000,
      output: 2400,
      cacheRead: 1000,
      cacheWrite: 0,
      steps: 2,
      usd: 0.261,
    },
    main: { type: 'main', model: 'claude-fable-5-1', input: 1000, output: 7, cacheRead: 500, steps: 1, usd: 0.0112 },
  });
  const text = JSON.stringify(s.store);
  expect(text).not.toMatch(/@|\/Users\/|\/home\/|\/host\b|research the auth flow|review slice 03/);
});

// The stage comes from the host's .forge/state.json, as the hooks read it: the
// effort's stage, the gate it waits at, and why an autonomous run stopped.
test("the host's state.json gives the stored run its stage and gate", async ($, on) => {
  const clock = mock.clock(on, { now: Date.UTC(2026, 9, 7, 10, 0, 0) });
  const s = seat(on, {
    files: {
      '.forge/state.json': JSON.stringify({
        version: 1,
        efforts: { alpha: { stage: 'build', gate: 'plan', stop: 'flagged' }, other: { stage: 'map', gate: 'none' } },
      }),
    },
  });
  answerSteps(on);
  await start($, clock);
  await threeSteps($, on);
  await clock.advance(5000);
  expect(s.store[RUN]).toMatchObject({ stage: 'build · gate plan · stopped: flagged' });
});

// Two runs of the alpha map already in the store and this session's own:
// history lists every stored run, newest first, with its ticket count, stage and estimate.
const STORED = {
  'run:docs/efforts/alpha:2026-10-06T09:00:00.000Z': {
    map: 'docs/efforts/alpha',
    title: 'Alpha port',
    run: '2026-10-06T09:00:00.000Z',
    startedAt: 1,
    updatedAt: 2,
    slices: { total: 6, closed: 1 },
    stage: 'no state',
    agents: {
      'agent-7': {
        type: 'researcher',
        model: 'claude-sonnet-5-5',
        input: 100,
        output: 50,
        cacheRead: 0,
        cacheWrite: 0,
        steps: 1,
        usd: 0.0007,
      },
    },
  },
  'run:docs/efforts/alpha:2026-10-06T15:00:00.000Z': {
    map: 'docs/efforts/alpha',
    title: 'Alpha port',
    run: '2026-10-06T15:00:00.000Z',
    startedAt: 3,
    updatedAt: 4,
    slices: { total: 6, closed: 3 },
    stage: 'build · gate plan',
    agents: {
      'agent-8': {
        type: 'implementer',
        model: 'claude-opus-5-5',
        input: 1000,
        output: 400,
        cacheRead: 200,
        cacheWrite: 0,
        steps: 2,
        usd: 0.012,
      },
      main: {
        type: 'main',
        model: 'claude-opus-5-5',
        input: 10,
        output: 1,
        cacheRead: 0,
        cacheWrite: 0,
        steps: 1,
        usd: 0.00006,
      },
    },
  },
};

test('/forge-pane history lists the stored runs newest first with ticket count, stage and estimate', async ($, on) => {
  const clock = mock.clock(on, { now: Date.UTC(2026, 9, 7, 10, 0, 0) });
  const s = seat(on, { store: { ...STORED } });
  await start($, clock);
  const ran = await runPane($, 160, 'history');
  const lines = (ran.text ?? '').split('\n');
  expect(lines[0]).toMatch(/list-price estimate.*2026-01-02/);
  expect(lines.slice(1)).toEqual([
    'Alpha port · 2026-10-06T15:00:00.000Z · 3/6 tickets closed · build · gate plan · 2 agents · $0.0121',
    'Alpha port · 2026-10-06T09:00:00.000Z · 1/6 tickets closed · no state · 1 agent · $0.0007',
  ]);
  expect(s.opens).toHaveLength(0);
});

test('/forge-pane export writes a CSV under .forge with one row per agent per run and says where', async ($, on) => {
  const clock = mock.clock(on, { now: Date.UTC(2026, 9, 7, 10, 0, 0) });
  const s = seat(on, { store: { ...STORED } });
  await start($, clock);
  const ran = await runPane($, 160, 'export');
  expect(ran.text).toBe('Run history exported: .forge/run-pane/history.csv (3 rows, 2 runs).');
  const csv = s.writes['.forge/run-pane/history.csv'];
  expect(csv?.split('\n')).toEqual([
    'map,title,run,tickets_closed,tickets_total,stage,agent,type,model,input_tokens,output_tokens,cache_read_tokens,cache_write_tokens,steps,est_usd',
    'docs/efforts/alpha,Alpha port,2026-10-06T15:00:00.000Z,3,6,build · gate plan,agent-8,implementer,claude-opus-5-5,1000,400,200,0,2,0.012',
    'docs/efforts/alpha,Alpha port,2026-10-06T15:00:00.000Z,3,6,build · gate plan,main,main,claude-opus-5-5,10,1,0,0,1,0.00006',
    'docs/efforts/alpha,Alpha port,2026-10-06T09:00:00.000Z,1,6,no state,agent-7,researcher,claude-sonnet-5-5,100,50,0,0,1,0.0007',
    '',
  ]);
  expect(s.opens).toHaveLength(0);
});

test('an unknown /forge-pane argument answers the usage and opens nothing', async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on);
  await start($, clock);
  const ran = await runPane($, 160, 'bogus');
  expect(ran.text).toMatch(/\/forge-pane \[history \| export \| close\]/);
  expect(s.opens).toHaveLength(0);
});
