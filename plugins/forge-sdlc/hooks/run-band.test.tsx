// The run's band above the prompt through `claude plugin test`: the mark, the
// figures with their tooltips, the notes, the tip row. The run-pane fixture
// answers the rest.
import { test, expect, mock } from 'claude-code/testing';
import type { Engine } from 'claude-code/testing';
import { HOST_CONFIG, SURFACES, bandProps, forgeConfig, seat, start, textsUnder } from './run-pane.fixture';
import { MARK_HINT, TIPS } from './run-band';

// The tooltip cards in a drawing (Boxes drawn display: none), by the key of the
// item each sits in, with their text.
type Card = { text: string; props: Record<string, unknown>; hover: unknown; inverse: unknown };
function cardsOf(tree: unknown): Record<string, Card> {
  const out: Record<string, Card> = {};
  const textOf = (node: unknown): string => {
    if (typeof node === 'string') return node;
    return ((node as { children?: unknown[] })?.children ?? []).map(textOf).join('');
  };
  const walk = (node: unknown, item: string | undefined) => {
    if (!node || typeof node !== 'object') return;
    const el = node as { props?: Record<string, unknown>; hover?: unknown; children?: unknown[] };
    const key = typeof el.props?.key === 'string' ? el.props.key : undefined;
    if (el.props?.display === 'none' && item) {
      out[item] = {
        text: textOf(el),
        props: el.props,
        hover: el.hover ?? el.props.hover,
        inverse: (el.children?.[0] as { props?: { inverse?: boolean } } | undefined)?.props?.inverse,
      };
      return;
    }
    for (const child of el.children ?? []) walk(child, key ?? item);
  };
  walk(tree, undefined);
  return out;
}

function band($: Engine, surface: (typeof SURFACES)[number] = 'terminal') {
  return $.ui.mount({ plugin: 'forge-sdlc', surface, component: 'AbovePrompt', props: bandProps() });
}

test('the band draws the mark and the figures on terminal and desktop, a blank row above', async ($, on) => {
  const clock = mock.clock(on);
  seat(on);
  await start($, clock);
  for (const surface of SURFACES) {
    const ui = await band($, surface);
    expect(textsUnder(await ui.drawn(), 'mark').join(''), surface).toBe('forge ');
    expect((await ui.find({ key: 'figures' }))?.props.flexWrap, surface).toBe('wrap');
    expect((await ui.find({ key: 'top-row' }))?.props.height, surface).toBe(2); // the two blank top rows
    await ui.unmount();
  }
});

test("a host config's mark leads the band in its own colour, in place of forge", async ($, on) => {
  const clock = mock.clock(on);
  seat(on, { files: { [HOST_CONFIG]: forgeConfig('\n## Mark\n- text: iZi\n- color: "#8b5cf6"\n') } });
  await start($, clock);
  const ui = await band($);
  const drawn = JSON.stringify(await ui.drawn());
  expect(textsUnder(await ui.drawn(), 'mark').join('')).toBe('iZi ');
  expect(drawn).toMatch(/"color":"#8b5cf6"[^}]*\},"children":\["iZi"\]/);
  await ui.unmount();
});

test('mark text none draws no mark; a Mark section with no text keeps forge and says why', async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on, { files: { [HOST_CONFIG]: forgeConfig('\n## Mark\n- text: none\n') } });
  await start($, clock);
  const ui = await band($);
  expect(await ui.find({ key: 'mark' })).toBeFalsy();
  expect(textsUnder(await ui.drawn(), 'figures').join('')).toMatch(/^ctx 25%/);
  await ui.unmount();
  s.files[HOST_CONFIG] = forgeConfig('\n## Mark\n- color: red\n');
  await clock.advance(5000);
  const again = await band($);
  expect(textsUnder(await again.drawn(), 'mark').join('')).toBe('forge ');
  expect(textsUnder(await again.drawn(), 'figures-2').join('')).toContain('mark ignored: ## Mark needs a `text` bullet');
  expect(s.toasts.filter((t) => t.includes('mark ignored'))).toHaveLength(1);
  await again.unmount();
});

test('each item of the band keeps a tooltip in the blank row above, shown only on hover', async ($, on) => {
  const clock = mock.clock(on);
  seat(on);
  await start($, clock);
  const ui = await band($);
  const tips = {
    mark: MARK_HINT,
    ctx: 'context window: 50k of 200k tokens used',
    five_hour: '5-hour limit: 23% used, resets in 2h 15m',
    seven_day: 'weekly limit: 61% used, resets in 3d 6h',
    usd: "this session's cost so far, in USD",
    agents: "1 of the session's 2 agents running now",
  };
  const cards = cardsOf(await ui.drawn());
  for (const [key, text] of Object.entries(tips)) {
    const card = cards[key];
    expect(card?.text, key).toBe(` ${text} `); // a space either side of the block
    expect(card?.inverse, key).toBe(true); // inverse: a block in any theme
    expect(card?.props.position, key).toBe('absolute');
    expect(card?.props.top, key).toBe(-1); // the blank row above the item's row
    expect(card?.hover, key).toEqual({ display: 'flex' });
  }
  await ui.unmount();
});

test('the band spans the width from the left edge, a blank row above it and between its two rows', async ($, on) => {
  const clock = mock.clock(on);
  seat(on);
  await start($, clock);
  const ui = await band($);
  const root = await ui.find({ key: 'band' });
  expect(root?.props.marginLeft).toBeUndefined();
  expect(root?.props.width).toBe(155);
  expect((await ui.find({ key: 'top-row' }))?.props.height).toBe(2);
  expect((await ui.find({ key: 'figures-2' }))?.props.marginTop).toBe(1);
  await ui.unmount();
});

test('before the first reading the band is left to what is beneath', async ($, on) => {
  mock.clock(on); // the needs-you band above reads the clock on every draw
  seat(on);
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e); // the engine beneath
    return <Box key="beneath" />;
  });
  await $.session.start({ cwd: '/host', surface: 'terminal', isInteractive: true }); // no tick yet
  const ui = await band($);
  expect(await ui.find({ key: 'band' })).toBeFalsy();
  expect(await ui.find({ key: 'beneath' })).toBeTruthy();
  await ui.unmount();
});

test("a tip shows in the band's last row, under the agents, every third turn, the next tip each time, none between", async ($, on) => {
  const clock = mock.clock(on);
  seat(on);
  on('prompt.submit', ($, e) => ({ text: e.text }));
  await start($, clock);
  const tipRow = async () => {
    const ui = await band($);
    const tree = await ui.drawn();
    const text = textsUnder(tree, 'tip-row').join('');
    // the last row: after the agents' row
    if (text) expect(JSON.stringify(tree).indexOf('tip-row')).toBeGreaterThan(JSON.stringify(tree).indexOf('figures-2'));
    await ui.unmount();
    return text;
  };
  const submit = () => $.prompt.submit({ text: 'go', origin: { kind: 'composer' }, wait: false });
  expect(await tipRow()).toBe(''); // no prompt yet: no tip
  const seen: string[] = [];
  for (let turn = 1; turn <= 7; turn += 1) {
    await submit();
    seen.push(await tipRow());
  }
  expect(seen[0]).toBe(`⎿  Tip: ${TIPS[0]}`); // turn 1
  expect(seen.slice(1, 3)).toEqual(['', '']); // turns 2 and 3
  expect(seen[3]).toBe(`⎿  Tip: ${TIPS[1]}`); // turn 4: the next tip
  expect(seen[6]).toBe(`⎿  Tip: ${TIPS[2]}`); // turn 7
});

test('with a crew theme the band names the running crew and the theme', async ($, on) => {
  const clock = mock.clock(on);
  seat(on, {
    files: { [HOST_CONFIG]: forgeConfig('\n## Crew\n- theme: star-trek\n') },
    agents: [
      { id: 'a1', description: 'Scotty · slice 01', type: 'forge-sdlc:implementer', status: 'running' },
      { id: 'a2', description: 'find the fixtures', type: 'Explore', status: 'running' },
    ],
  });
  await start($, clock);
  const ui = await band($);
  expect(textsUnder(await ui.drawn(), 'figures-2').join('')).toBe('Scotty +1 running');
  await ui.unmount();
});
