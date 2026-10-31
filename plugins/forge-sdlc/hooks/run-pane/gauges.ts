// The gauges' pure parts, shared by the run pane and the band above the prompt:
// bars, figures, the subscription windows and their colours.
import type { RunPaneUsage } from '../types';

// Bars of small squares, centred on the row as the text is (a half block sits
// at the cell's edge, a full block stands the row's height).
const cells = (ratio: number, width: number) => {
  const filled = Math.round(Math.max(0, Math.min(1, ratio)) * width);
  return [filled, Math.max(0, width - filled)] as const;
};
// A gauge's bar in two parts, both solid: the filled part in the gauge's colour,
// the empty part in a darker shade of it (dimTone), not dimColor, which some
// terminals do not draw on a coloured cell.
export const barParts = (ratio: number, width: number): [filled: string, empty: string] => {
  const [filled, empty] = cells(ratio, width);
  return ['■'.repeat(filled), '■'.repeat(empty)];
};
// A bar in one colour (the pane's context rows): the empty squares hollow.
export const bar = (ratio: number, width: number): string => {
  const [filled, empty] = cells(ratio, width);
  return '■'.repeat(filled) + '□'.repeat(empty);
};
export const short = (s: string, n: number) => (s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s);
export const usd = (n: number | undefined) => (n === undefined ? '$?' : `$${n.toFixed(2)}`);
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// The subscription windows the pane gauges, by the label it gives them; a
// gateway's spend_limit is left out.
export const LIMITS = [
  ['five_hour', 'session'],
  ['seven_day', 'week'],
] as const;
export const limitsOf = (u: RunPaneUsage | null | undefined) =>
  LIMITS.flatMap(([kind, label]) => {
    const l = u?.limits?.find((x) => x.kind === kind);
    return l ? [{ ...l, label }] : [];
  });
// Where a gauge turns red, by what it measures: the context window early, as
// a long context costs and degrades well before it fills; the subscription
// windows late. It turns yellow two-thirds of the way there.
export const RED_AT: Record<string, number> = { ctx: 40, five_hour: 75, seven_day: 75 };

// A gauge's theme colour, so it reads in a light or a dark theme alike.
export function tone(gauge: string, percent: number | undefined): string | undefined {
  if (percent === undefined) return undefined;
  const red = RED_AT[gauge] ?? 75;
  if (percent >= red) return 'error';
  return percent >= Math.round((red * 2) / 3) ? 'warning' : 'success';
}

// The darker shade of each tone, for a bar's empty part: fixed colours, as the
// theme names no dimmed yellow, picked to read as the dim of green, yellow and
// red on a dark or a light background.
const DIM: Record<string, string> = { success: '#2f6b3a', warning: '#7d6a1f', error: '#7a2a2a' };
export const dimTone = (gauge: string, percent: number | undefined): string | undefined => {
  const shade = tone(gauge, percent);
  return shade ? DIM[shade] : undefined;
};
// How long until a window resets, from when the snapshot was read: 3d 6h, 2h 15m, 40m.
export function untilReset(resetsAt: string | undefined, now: number): string | undefined {
  const at = resetsAt ? Date.parse(resetsAt) : NaN;
  if (Number.isNaN(at)) return undefined;
  const minutes = Math.max(0, Math.round((at - now) / 60000));
  const [d, h, m] = [Math.floor(minutes / 1440), Math.floor((minutes % 1440) / 60), minutes % 60];
  if (d) return `${d}d ${h}h`;
  return h ? `${h}h ${m}m` : `${m}m`;
}
