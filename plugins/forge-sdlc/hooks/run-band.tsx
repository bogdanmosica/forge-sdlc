// The run's band above the prompt (AbovePrompt): the mark, then the figures,
// coloured as the run pane's gauges; a second row with the agents and the notes
// the run pane keeps (a pane that waits, a host config problem); a tip every
// third turn. The figures were a $.ui.status line, which the engine draws
// behind a ⚠. Drawn once the first tick has read a snapshot; before that, and
// while a survey asks, the band is left to what is beneath. The needs-you band
// (band.tsx, registered first) sits above this one.
import { atom, read, update } from 'claude-code';
import type { EngineInterface, On } from 'claude-code';
import type { RunPaneNotes, RunPaneSnapshot } from './types';
import { barParts, dimTone, limitsOf, plural, tone, untilReset, usd } from './run-pane/gauges';
import { compactTokens } from './run-pane/usage';
import { agentsText } from './run-pane/crew';
import { FORGE_MARK } from './run-pane/mark';
import { noteWorkbenchPrompt } from './workbench';

// The run pane's own values (run-pane.tsx writes them), read here to draw.
const snapshot = atom({ plugin: 'forge-sdlc', key: 'runPane' } as const, null as RunPaneSnapshot | null);
const bandNotes = atom({ plugin: 'forge-sdlc', key: 'runPaneNotes' } as const, {} as RunPaneNotes);
// The prompts sent this session, so the band knows a tip turn; a write redraws it.
const bandTurns = atom({ plugin: 'forge-sdlc', key: 'bandTurns' } as const, 0);

// The band's tooltips, by item: what each figure is, read from the snapshot.
// Each percent's bar, in cells: enough to read at a glance, short enough for one row.
const BAR_CELLS = 8;
const LIMIT_NAMES: Record<string, string> = { five_hour: '5-hour', seven_day: 'weekly' };
export const MARK_HINT = 'forge-sdlc: the run at a glance; /forge-pane opens the run pane';

type Hints = { ctx: string; usd: string; agents: string; [limit: string]: string };

function hintsOf(s: RunPaneSnapshot): Hints {
  const tokens = s.usage?.tokens === undefined ? '?' : compactTokens(s.usage.tokens);
  const running = s.agents.filter((a) => a.status === 'running').length;
  const hints: Hints = {
    ctx: `context window: ${tokens} of ${compactTokens(s.usage?.window ?? 0)} tokens used`,
    usd: "this session's cost so far, in USD",
    agents: `${running} of the session's ${plural(s.agents.length, 'agent')} running now`,
  };
  for (const l of limitsOf(s.usage)) {
    const reset = untilReset(l.resetsAt, s.readAt);
    const resets = reset ? `, resets in ${reset}` : '';
    hints[l.kind] = `${LIMIT_NAMES[l.kind]} limit: ${l.percent}% used${resets}`;
  }
  return hints;
}

// The plugin's tips: what it can do that a driver may not know yet. One shows
// in the band's last row, under the agents, on every third turn (the 1st, 4th,
// 7th...), the next tip each time, until the next prompt; no row otherwise.
export const TIPS = [
  'Run /forge-pane to see the run: the frontier, the agents and where your context went',
  'Run /forge-pane history to list the stored runs, /forge-pane export to write them as CSV',
  'Hover a figure in the band above the prompt to see what it counts',
  'Run /forge-sdlc:status <slug> for the effort’s stage, gate and next command',
  'Name the agents after a crew: theme under ## Crew in docs/agents/forge.md (warcraft, star-trek, star-wars, got, mario)',
  'Route a role to another model or effort: model.<role> and effort.<role> under ## Routing in docs/agents/forge.md',
];
const TIP_EVERY = 3;
export const tipOf = (turns: number): string | undefined =>
  turns % TIP_EVERY === 1 ? TIPS[Math.floor(turns / TIP_EVERY) % TIPS.length] : undefined;

// The band: the prompt counter for the tips, and the drawing.
export function registerRunBand(on: On): void {
  on('prompt.submit', async ($, e, next) => {
    await update($, bandTurns, (n) => n + 1);
    await noteWorkbenchPrompt($, e); // the session record: working, on this prompt
    return next(e);
  });

  // A blank row above the band keeps it off the last message and holds the
  // tooltip of whichever item the pointer is on.
  on('ui.render', { component: 'AbovePrompt', surface: ['terminal', 'desktop'] }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e);
    const s = await read($, snapshot);
    if (!s) return next(e); // no tick yet: nothing to draw
    const { Box, Text } = $.ui.resolve(e);
    // A tooltip: one line in the blank row above its row, hidden until the pointer is
    // on its item (the nearest keyed Box, so the card itself carries no key);
    // absolute, so showing it moves nothing. Drawn inverse, a space either side,
    // so it stands out as a block in a light or a dark theme alike.
    const tip = (text: string) => (
      <Box position="absolute" top={-1} left={0} display="none" hover={{ display: 'flex' }}>
        <Text inverse wrap="truncate-end">{` ${text} `}</Text>
      </Box>
    );
    const n = await read($, bandNotes);
    const hint = hintsOf(s);
    const mark = s.mark ?? FORGE_MARK;
    const running = s.agents.filter((a) => a.status === 'running').length;
    const figure = (key: string, label: string, percent: number | undefined) => (
      <Box key={key} flexDirection="row">
        {tip(hint[key] ?? '')}
        <Text dimColor>{label} </Text>
        <Text color={tone(key, percent)}>
          {percent ?? '?'}% {barParts((percent ?? 0) / 100, BAR_CELLS)[0]}
        </Text>
        <Text color={dimTone(key, percent)}>{barParts((percent ?? 0) / 100, BAR_CELLS)[1]}</Text>
      </Box>
    );
    // Row 1: the gauges and the cost; a blank row, then row 2: the agents and
    // the notes. Each row's tooltips show in the blank row above it.
    const first = [
      figure('ctx', 'ctx', s.usage?.percent),
      ...limitsOf(s.usage).map((l) => figure(l.kind, l.label, l.percent)),
      <Box key="usd">
        {tip(hint.usd)}
        <Text>{usd(s.usage?.usd)}</Text>
      </Box>,
    ];
    const second = [
      <Box key="agents">
        {tip(hint.agents)}
        <Text dimColor={!running}>{agentsText(s)}</Text>
      </Box>,
    ];
    for (const key of ['pane', 'routing', 'crew', 'mark'] as const) {
      const note = n[key];
      if (note)
        second.push(
          <Text key={`note-${key}`} color="warning">
            {note}
          </Text>,
        );
    }
    const joined = (row: string, items: typeof first) =>
      items.flatMap((item, i) =>
        i
          ? [
              <Text key={`${row}-sep-${i}`} dimColor>
                {' · '}
              </Text>,
              item,
            ]
          : [item],
      );
    const tipText = tipOf(await read($, bandTurns));
    return (
      <Box key="band" flexDirection="column" width={e.props.bodyColumns}>
        <Box key="top-row" height={2}>
          <Text> </Text>
        </Box>
        <Box key="figures" flexDirection="row" flexWrap="wrap">
          {mark.length > 0 && (
            <Box key="mark" flexDirection="row">
              {tip(MARK_HINT)}
              {mark.map((part, i) => (
                <Text key={`mark-${i}`} bold color={part.color}>
                  {part.text}
                </Text>
              ))}
              <Text key="mark-gap"> </Text>
            </Box>
          )}
          {joined('first', first)}
        </Box>
        <Box key="figures-2" flexDirection="row" flexWrap="wrap" marginTop={1}>
          {joined('second', second)}
        </Box>
        {tipText && (
          <Box key="tip-row">
            <Text dimColor wrap="truncate-end">{`⎿  Tip: ${tipText}`}</Text>
          </Box>
        )}
      </Box>
    );
  });
}
