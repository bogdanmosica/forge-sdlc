// The run pane through `claude plugin test`. Nothing sits beneath the plugin
// here, so the test answers every call the mod makes on `$` (files, usage,
// agents, commands, panes) from a fixture effort held as a virtual directory,
// and reads the drawing back by key. The world beneath the mod is
// run-pane.fixture.tsx, shared with the history, crew, routing and band tests.
import { test, expect, mock } from 'claude-code/testing';
import { PANE, SURFACES, band, pane, runPane, seat, start, step, textsUnder } from './run-pane.fixture';

test('the gauge row shows context, cost and running agents on terminal and desktop', async ($, on) => {
  const clock = mock.clock(on);
  seat(on);
  await start($, clock);
  await runPane($, 160);
  for (const surface of SURFACES) {
    const ui = await pane($, surface);
    const gauges = textsUnder(await ui.drawn(), 'gauges').join(' ');
    expect(gauges, surface).toMatch(/ctx\s+25%/);
    expect(gauges, surface).toContain('$1.25');
    expect(gauges, surface).toMatch(/1 agent running/);
    expect(gauges, surface).not.toMatch(/MR/);
    await ui.unmount();
  }
});

test('the Frontier lists exactly the open, unblocked, unclaimed tickets of the newest map', async ($, on) => {
  const clock = mock.clock(on);
  seat(on);
  await start($, clock);
  await runPane($, 160);
  for (const surface of SURFACES) {
    const ui = await pane($, surface);
    const tree = await ui.drawn();
    expect(textsUnder(tree, 'frontier-title').join(' '), surface).toMatch(/Frontier.*Alpha port/);
    const frontier = textsUnder(tree, 'frontier').map((t) => t.match(/^\S+ (\d+)/)?.[1]);
    expect(frontier, surface).toEqual(['03', '06']);
    expect(
      textsUnder(tree, 'claimed').map((t) => t.match(/^\S+ (\d+)/)?.[1]),
      surface,
    ).toEqual(['04']);
    expect(textsUnder(tree, 'frontier-counts').join(' '), surface).toMatch(/2\/6 closed.*1 blocked/);
    await ui.unmount();
  }
});

test('a ticket titled with its slice id draws its title alone', async ($, on) => {
  const clock = mock.clock(on);
  seat(on);
  await start($, clock);
  await runPane($, 160);
  const ui = await pane($);
  // 01 is closed, so it is listed nowhere; 03's title is drawn without its number
  expect(textsUnder(await ui.drawn(), 'frontier')[0]).toMatch(/^○ 03 Guardrail hooks/);
  await ui.unmount();
});

test('a map with no local tickets says so instead of a frontier', async ($, on) => {
  const clock = mock.clock(on);
  seat(on, { files: { 'docs/efforts/beta/map.md': '# Map: Beta\n' } });
  await start($, clock);
  await runPane($, 160);
  const ui = await pane($);
  await ui.press({ key: 'map' }); // beta is older than alpha: the second choice
  await clock.advance(10);
  const column = textsUnder(await ui.drawn(), 'frontier-column').join('\n');
  expect(column).toMatch(/Beta/);
  expect(column).toContain('no local tickets under .scratch/beta/issues');
  expect(column).not.toMatch(/closed · /);
  await ui.unmount();
});

test(
  'the Agents column lists the agents with the output tokens summed from turn.step, and the context rows the used categories',
  async ($, on) => {
    const clock = mock.clock(on);
    seat(on);
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
    await start($, clock);
    await step($, on, 'agent-1');
    await step($, on, 'agent-1');
    await step($, on, undefined);
    await runPane($, 160);
    for (const surface of SURFACES) {
      const ui = await pane($, surface);
      const tree = await ui.drawn();
      const agents = textsUnder(tree, 'agents');
      expect(agents, surface).toHaveLength(2);
      expect(agents[0], surface).toMatch(/^● research the auth flow.*2\.4k↑/);
      expect(agents[1], surface).toMatch(/^✓ review slice 03/);
      expect(textsUnder(tree, 'agents-title').join(''), surface).toMatch(/Agents.*1 running/);
      const context = textsUnder(tree, 'context');
      expect(context.join('\n'), surface).toMatch(/System prompt.*20k/);
      expect(context.join('\n'), surface).toMatch(/Messages.*30k/);
      expect(context.join('\n'), surface).not.toMatch(/Free space|Autocompact/);
      // bars are proportional to the used total: Messages (30k of 50k) is longer than System prompt (20k)
      const barOf = (row: string) => (row.match(/■+/)?.[0] ?? '').length;
      const sys = context.find((r) => r.includes('System prompt'))!;
      const msg = context.find((r) => r.includes('Messages'))!;
      expect(barOf(msg), surface).toBeGreaterThan(barOf(sys));
      expect(barOf(msg) + barOf(sys) > 0, surface).toBe(true);
      await ui.unmount();
    }
  },
);

test('/forge-pane seats the pane at 100 columns: an asked open with focus, and the command says so', async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on);
  await start($, clock);
  const ran = await runPane($, 100);
  expect(s.opens).toEqual([{ id: PANE, focus: true }]);
  expect(ran.text).toBe('Run pane opened.');
  expect(await band($)).toBe(
    'forge ctx 25% ■■■■■■■■ · session 23% ■■■■■■■■ · week 61% ■■■■■■■■ · $1.25\n1 agent running',
  );
});

test(
  'an auto-open on wayfinder or build at 100 columns leaves only the band, which says the pane waits',
  async ($, on) => {
    const clock = mock.clock(on);
    const s = seat(on, { placed: false });
    on('skill.prompt', ($, e) => ({ text: e.text }));
    await start($, clock);
    for (const skill of ['forge-sdlc:wayfinder', 'build']) {
      await $.skill.prompt({ skill, text: 'the skill prompt' });
    }
    expect(s.opens).toEqual([
      { id: PANE, focus: undefined },
      { id: PANE, focus: undefined },
    ]);
    await clock.advance(5000);
    expect(await band($)).toBe(
      'forge ctx 25% ■■■■■■■■ · session 23% ■■■■■■■■ · week 61% ■■■■■■■■ · $1.25\n1 agent running · run pane waits: widen to 144 columns or /forge-pane',
    );
    // an unrelated skill opens nothing
    await $.skill.prompt({ skill: 'forge-sdlc:status', text: 'x' });
    expect(s.opens).toHaveLength(2);
  },
);

test('the limits row gauges the session and week windows with their resets', async ($, on) => {
  const clock = mock.clock(on);
  seat(on);
  await start($, clock);
  await runPane($, 160);
  const ui = await pane($);
  const limits = textsUnder(await ui.drawn(), 'limits').join(' ');
  expect(limits).toMatch(/session\s+23%.*↻ 2h 15m/);
  expect(limits).toMatch(/week\s+61%.*↻ 3d 6h/);
  await ui.unmount();
});

test('the band above the prompt draws the figures in colour, and the plugin keeps no status line', async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on);
  await start($, clock);
  const ui = await $.ui.mount({
    plugin: 'forge-sdlc',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 155, scroll: { offset: 0, bodyRows: 9 }, view: {} },
  });
  const tree = await ui.drawn();
  const drawn = JSON.stringify(tree);
  for (const colour of ['success', 'warning']) expect(drawn).toContain(`"color":"${colour}"`);
  // a gauge's bar: week (61%, yellow) is 5 squares in yellow, then 3 in dimmed
  // yellow, a fixed darker shade, as dimColor on a coloured cell may not show
  expect(drawn).toMatch(/"color":"warning"\},"children":\["61","% ","■■■■■"\]/);
  expect(drawn).toMatch(/"color":"#7d6a1f"\},"children":\["■■■"\]/);
  // forge leads the band where the ⚠ stood, bold, in the default colour
  expect(textsUnder(tree, 'mark').join('')).toBe('forge ');
  await ui.unmount();
  expect(s.status).toEqual([]); // no engine status line, so no ⚠ beside it
});

test('a survey keeps the band to itself', async ($, on) => {
  const clock = mock.clock(on);
  seat(on);
  let passed = 0;
  on('ui.render', ($, e) => {
    passed += 1; // the engine beneath, drawing the survey
    const { Box } = $.ui.resolve(e);
    return <Box key="survey" />;
  });
  await start($, clock);
  expect(await band($, { hasSurvey: true })).toBe('');
  expect(passed).toBe(1);
});

test('off a subscription the limits stay out of the pane and the band', async ($, on) => {
  const clock = mock.clock(on);
  seat(on, { rateLimits: [] });
  await start($, clock);
  expect(await band($)).toBe('forge ctx 25% ■■■■■■■■ · $1.25\n1 agent running');
  await runPane($, 160);
  const ui = await pane($);
  expect(textsUnder(await ui.drawn(), 'limits')).toEqual([]);
  await ui.unmount();
});

// The picker cycles the maps under docs/efforts, newest first; the Frontier follows the picked map.
test('the map picker Button cycles the maps under docs/efforts and the Frontier follows it', async ($, on) => {
  const clock = mock.clock(on);
  seat(on, {
    files: {
      'docs/efforts/bravo/map.md': '# Map: Beta port\n',
      '.scratch/bravo/issues/01-only.md': '# 01 Only ticket\n\nStatus: open\n',
    },
  });
  await start($, clock);
  await runPane($, 160);
  for (const surface of SURFACES) {
    const ui = await pane($, surface);
    expect(textsUnder(await ui.drawn(), 'frontier-title').join(' '), surface).toMatch(/Alpha port/);
    await ui.press({ key: 'map' });
    await clock.advance(10);
    const tree = await ui.drawn();
    expect(textsUnder(tree, 'frontier-title').join(' '), surface).toMatch(/Beta port/);
    expect(
      textsUnder(tree, 'frontier').map((t) => t.match(/^\S+ (\d+)/)?.[1]),
      surface,
    ).toEqual(['01']);
    await ui.press({ key: 'map' });
    await clock.advance(10);
    expect(textsUnder(await ui.drawn(), 'frontier-title').join(' '), surface).toMatch(/Alpha port/);
    await ui.unmount();
  }
});

test('Esc closes the run pane while it has the focus, and /forge-pane close closes it from the prompt', async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on);
  await start($, clock);
  await runPane($, 100);
  expect(s.escapes).toEqual([true]);
  const ran = await runPane($, 100, 'close');
  expect(ran.text).toBe('Run pane closed.');
  expect(s.closes).toEqual([PANE]);
  expect(s.opens).toHaveLength(1); // close opens nothing
});
