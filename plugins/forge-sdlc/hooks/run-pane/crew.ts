// Crew: the host config's `## Crew` section, read at each Agent call, names an
// agent the call left unnamed with the next name of its role's pool: its handle
// above the prompt (`@Seven-of-Nine`) and the front of its description (`Seven
// of Nine · review slice 03`). A plugin agent takes its role's pool, any other
// agent the `general` pool. The loop's own member calls arrive named by
// bin/crew-name.mjs and are left alone. Display only: the agent type, branches
// and commits keep their names. Pure: run-pane.tsx reads the files and calls `$`.
//
// Host config (`docs/agents/forge.md`, written by /forge-sdlc:init):
//   ## Crew
//   - theme: none | <preset id> | <free text>
//   - names.<role>: <name>, <name>, ...       optional, one per overridden role
// A preset (by id or label, any case) takes its pools from the plugin's
// crew.json; a `names.<role>` bullet overrides that role's pool and carries a
// free-text theme's pools whole. A role with no pool keeps its description.
import type { ForgeConfig } from './config';
import type { RunPaneSnapshot } from '../types';

export type CrewPools = Record<string, string[]>;
export type Crew = { pools: CrewPools; problems: string[]; label?: string }; // label: the theme as the band names it

const SEPARATOR = ' · ';

// The pool of every agent that is no plugin role: general-purpose, Explore, ...
export const GENERAL = 'general';

const isNames = (v: unknown): v is string[] =>
  Array.isArray(v) && v.length > 0 && v.every((n) => typeof n === 'string' && n.trim() !== '');

const poolsOf = (raw: unknown): CrewPools => {
  const pools: CrewPools = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return pools;
  for (const [role, names] of Object.entries(raw as Record<string, unknown>))
    if (isNames(names)) pools[role] = names.map((n) => n.trim());
  return pools;
};

// The `names.<role>` bullets of the section as pools (a comma-separated bullet is a list).
const ownPoolsOf = (section: Record<string, string>): CrewPools => {
  const pools: CrewPools = {};
  for (const [key, value] of Object.entries(section)) {
    const role = key.startsWith('names.') ? key.slice('names.'.length).trim() : '';
    const names = value
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);
    if (role && names.length) pools[role] = names;
  }
  return pools;
};

// The host config and crew.json's text to the pools per role and the problems,
// each a line for the band. No config, no section and theme "none" name no one
// and say nothing.
export function parseCrew(config: ForgeConfig | undefined, presetsText: string | undefined): Crew {
  const none: Crew = { pools: {}, problems: [] };
  const section = config?.crew;
  if (!section) return none;
  const theme = section.theme?.trim() ?? '';
  if (theme === '' || theme.toLowerCase() === 'none') return none;
  let presets: Record<string, { label?: unknown; names?: unknown }> = {};
  try {
    presets = (JSON.parse(presetsText ?? '{}') as { presets?: typeof presets }).presets ?? {};
  } catch {
    /* no presets: names alone */
  }
  // by id or label, any case: the values init accepts
  const key = theme.toLowerCase();
  const found = Object.entries(presets).find(
    ([id, p]) => id === key || (typeof p.label === 'string' && p.label.toLowerCase() === key),
  )?.[1];
  const preset = found ? poolsOf(found.names) : undefined;
  const own = ownPoolsOf(section);
  if (!preset && Object.keys(own).length === 0)
    return {
      pools: {},
      problems: [`crew ignored: theme ${JSON.stringify(theme)} is no preset and no names.<role> bullet is set`],
    };
  const label = typeof found?.label === 'string' ? found.label : theme;
  return { pools: { ...(preset ?? {}), ...own }, problems: [], label };
}

// The `index`th name (from 0) of a pool: the pool in order, then again with a
// number, `Spock 2`, so two running agents never share a name.
export function nameAt(pool: string[], index: number): string {
  const round = Math.floor(index / pool.length);
  const name = pool[index % pool.length]!;
  return round === 0 ? name : `${name} ${round + 1}`;
}

// A crew name as the Agent tool's `name`, the handle above the prompt: letters,
// digits, `_` and `-` from a letter or digit, at most 64 (`Seven of Nine` ->
// `Seven-of-Nine`, `O'Brien` -> `OBrien`, `Padmé` -> `Padme`); undefined when
// nothing is left.
export function handleOf(name: string): string | undefined {
  const handle = name
    .normalize('NFD')
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^[_-]+/, '')
    .slice(0, 64)
    .replace(/-$/, ''); // one at most: runs were collapsed
  return handle === '' ? undefined : handle;
}

export const withCrewName = (name: string, description: string): string => `${name}${SEPARATOR}${description}`;

// The crew name withCrewName put in front of a description, as the band names
// a running agent; the description itself when it carries none.
export const crewNameOf = (description: string): string => description.split(SEPARATOR)[0] ?? description;

// The band's agents: with a crew theme, the running crew by name (other running
// agents, those whose description carries no crew name, counted after them) or
// the crew idle; without one, the count.
export function agentsText(s: RunPaneSnapshot): string {
  const running = s.agents.filter((a) => a.status === 'running');
  if (!s.crew) return `${running.length} agent${running.length === 1 ? '' : 's'} running`;
  const crew = running.filter((a) => a.description.includes(SEPARATOR));
  if (running.length === 0) return `${s.crew.label} crew idle`;
  if (crew.length === 0) return `${running.length} agent${running.length === 1 ? '' : 's'} running`;
  const others = running.length - crew.length;
  const names = crew.map((a) => crewNameOf(a.description)).join(', ');
  const more = others ? ` +${others}` : '';
  return `${names}${more} running`;
}
