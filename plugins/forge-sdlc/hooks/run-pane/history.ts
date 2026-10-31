// The run store: one `$.store` record per map and run, holding the per-agent
// token totals and the estimated USD, the map's ticket count and the effort's
// stage as last read from `.forge/state.json`. Keyed by map and run, never by
// person: no cwd, no user name, no agent description (free text the model wrote)
// goes in. `/forge-pane history` lists the records; `/forge-pane export` writes
// them as CSV, one row per agent per run. No central aggregation: the store is
// this machine's.
import type { AgentUsage, RunPaneAgent, RunPaneMap, RunPanePrices, RunPaneRun } from '../types';
import { estimateUsd } from './prices';
import { MAIN } from './usage';

export type RunAgent = AgentUsage & { type: string; usd?: number };

export type RunRecord = {
  map: string; // the map's directory under docs/efforts
  title: string;
  run: string; // the run id: the ISO time the run began
  startedAt: number;
  updatedAt: number;
  slices: { total: number; closed: number };
  stage: string; // where the effort stood, as stageOf reads the state: 'build · gate plan', 'no state'
  agents: Record<string, RunAgent>;
};

const PREFIX = 'run:';
export const runKey = (map: string, run: string): string => `${PREFIX}${map}:${run}`;
export const isRunKey = (key: string): boolean => key.startsWith(PREFIX);

// Where the effort stands, from the parsed `.forge/state.json` (docs/contracts.md):
// its stage, the gate it waits at when one, and why a run under the autonomous
// policy stopped when it did. 'no state' without a record for the slug.
export function stageOf(state: unknown, slug: string): string {
  const efforts = (state as { efforts?: Record<string, unknown> } | null)?.efforts;
  const effort = efforts?.[slug] as { stage?: unknown; gate?: unknown; stop?: unknown } | undefined;
  if (!effort || typeof effort.stage !== 'string') return 'no state';
  const gate = typeof effort.gate === 'string' && effort.gate !== 'none' ? ` · gate ${effort.gate}` : '';
  const stop = typeof effort.stop === 'string' ? ` · stopped: ${effort.stop}` : '';
  return `${effort.stage}${gate}${stop}`;
}

export function recordOf(input: {
  map: RunPaneMap;
  run: RunPaneRun;
  now: number;
  tokens: Record<string, AgentUsage>;
  agents: RunPaneAgent[];
  prices: RunPanePrices | null;
  stage: string;
}): RunRecord {
  const agents: Record<string, RunAgent> = {};
  for (const [id, t] of Object.entries(input.tokens)) {
    const usd = estimateUsd(input.prices, t);
    agents[id] = {
      type: id === MAIN ? MAIN : (input.agents.find((a) => a.id === id)?.type ?? 'agent'),
      model: t.model,
      input: t.input,
      output: t.output,
      cacheRead: t.cacheRead,
      cacheWrite: t.cacheWrite,
      steps: t.steps,
      ...(usd === undefined ? {} : { usd: Math.round(usd * 1_000_000) / 1_000_000 }),
    };
  }
  return {
    map: input.map.dir,
    title: input.map.title,
    run: input.run.id,
    startedAt: input.run.startedAt,
    updatedAt: input.now,
    slices: { total: input.map.tickets.length, closed: input.map.tickets.filter((t) => t.status === 'closed').length },
    stage: input.stage,
    agents,
  };
}

// Newest run first.
export const byNewest = (records: RunRecord[]): RunRecord[] => [...records].sort((a, b) => b.startedAt - a.startedAt);

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const sumUsd = (r: RunRecord) => Object.values(r.agents).reduce((sum, a) => sum + (a.usd ?? 0), 0);

// One line per run for `/forge-pane history`, under a header naming the estimate.
export function historyText(records: RunRecord[], prices: RunPanePrices | null): string {
  if (records.length === 0)
    return 'No stored runs yet: a run is stored once a map is under docs/efforts and a model request has run.';
  const priced = prices ? `, prices of ${prices.date}` : ', no price table loaded';
  const head = `Run history · USD is a list-price estimate${priced} · ${plural(records.length, 'run')}:`;
  const lines = byNewest(records).map((r) =>
    [
      `${r.title} · ${r.run}`,
      `${r.slices.closed}/${r.slices.total} tickets closed`,
      r.stage,
      plural(Object.keys(r.agents).length, 'agent'),
      `$${sumUsd(r).toFixed(4)}`,
    ].join(' · '),
  );
  return [head, ...lines].join('\n');
}

export const CSV_COLUMNS = [
  'map',
  'title',
  'run',
  'tickets_closed',
  'tickets_total',
  'stage',
  'agent',
  'type',
  'model',
  'input_tokens',
  'output_tokens',
  'cache_read_tokens',
  'cache_write_tokens',
  'steps',
  'est_usd',
] as const;

const cell = (v: string | number | null | undefined): string => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// The CSV for `/forge-pane export`: one row per agent per run, newest run first.
export function csvOf(records: RunRecord[]): { text: string; rows: number } {
  const lines: string[] = [CSV_COLUMNS.join(',')];
  for (const r of byNewest(records)) {
    for (const [id, a] of Object.entries(r.agents)) {
      lines.push(
        [
          r.map,
          r.title,
          r.run,
          r.slices.closed,
          r.slices.total,
          r.stage,
          id,
          a.type,
          a.model,
          a.input,
          a.output,
          a.cacheRead,
          a.cacheWrite,
          a.steps,
          a.usd,
        ]
          .map(cell)
          .join(','),
      );
    }
  }
  return { text: lines.join('\n') + '\n', rows: lines.length - 1 };
}
