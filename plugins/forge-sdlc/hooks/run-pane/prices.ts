// The price table: plugins/forge-sdlc/prices.json, dated list prices per model in
// USD per million tokens. The USD a row shows is an estimate at list price from
// the four token counts turn.step reports; the pane labels it so.
import type { AgentUsage, RunPanePrice as Price, RunPanePrices as PriceTable } from '../types';
export type { Price, PriceTable };

const isPrice = (p: unknown): p is Price =>
  !!p &&
  typeof p === 'object' &&
  ['input', 'output', 'cacheRead', 'cacheWrite'].every((k) => typeof (p as Record<string, unknown>)[k] === 'number');

// The table from the file's text; null when the text is not a table.
export function parsePrices(text: string): PriceTable | null {
  try {
    const t = JSON.parse(text) as Partial<PriceTable>;
    if (typeof t.date !== 'string' || !t.models || typeof t.models !== 'object') return null;
    const models: Record<string, Price> = {};
    for (const [model, price] of Object.entries(t.models)) if (isPrice(price)) models[model] = price;
    return { date: t.date, source: t.source ?? '', unit: t.unit ?? 'USD per million tokens', models };
  } catch {
    return null;
  }
}

// A model's price: by its exact id, else ignoring a date suffix on either side
// (`claude-haiku-4-5` finds `claude-haiku-4-5-20251001` and the reverse).
export function priceOf(table: PriceTable, model: string): Price | undefined {
  const exact = table.models[model];
  if (exact) return exact;
  const bare = (id: string) => id.replace(/-\d{8}$/, '');
  const hit = Object.keys(table.models).find((id) => bare(id) === bare(model));
  return hit ? table.models[hit] : undefined;
}

// USD at list price for an agent's totals; undefined when the model is not priced.
export function estimateUsd(table: PriceTable | null, u: AgentUsage): number | undefined {
  const p = table && priceOf(table, u.model);
  if (!p) return undefined;
  return (
    (u.input * p.input + u.output * p.output + u.cacheRead * p.cacheRead + u.cacheWrite * p.cacheWrite) / 1_000_000
  );
}

// An estimate drawn to four decimals, `$?` when the model is not priced.
export const usdEstimate = (n: number | undefined): string => (n === undefined ? '$?' : `$${n.toFixed(4)}`);
