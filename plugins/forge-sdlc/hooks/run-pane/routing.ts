// Routing: the host config's `## Routing` section, read at each spawn, applied to
// the agent's model at `agent.spawn` and to its effort at every `turn.step`.
// Pure: run-pane.tsx reads the file and calls `$`; this module only decides.
//
// Host config (`docs/agents/forge.md`), an optional section, shape in hooks/ROUTING.md:
//   ## Routing
//   - model.<role>: <alias or claude-* id>
//   - effort.<role>: <level>
// `<role>` is the agent type as the Agent tool names it: a plugin role without
// its prefix (`researcher` matches the spawn's `forge-sdlc:researcher`) or any
// other type verbatim (`Explore`). A bullet with a value outside those is
// invalid on its own: reported once, ignored, the agent file's frontmatter
// default used for that key.
import type { ForgeConfig } from './config';

export const PLUGIN = 'forge-sdlc';
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;

export type Effort = (typeof EFFORTS)[number];
export type RoutingEntry = { model?: string; effort?: Effort };
export type RoutingTable = Record<string, RoutingEntry>;
export type Routing = { table: RoutingTable; problems: string[] };

// A model alias Claude Code accepts, or a full id (`claude-opus-5-5`, with or
// without the `[1m]` context suffix). Values a host can mean, nothing else.
const ALIASES = new Set(['opus', 'sonnet', 'haiku', 'fable', 'best', 'default', 'opusplan', 'inherit']);
const FULL_ID = /^claude-[a-z0-9][a-z0-9-]*(\[1m\])?$/;
export const isModel = (v: unknown): v is string => typeof v === 'string' && (ALIASES.has(v) || FULL_ID.test(v));
export const isEffort = (v: unknown): v is Effort =>
  typeof v === 'string' && (EFFORTS as readonly string[]).includes(v);

// The config to the table and the problems, each a line for the band. No
// config and no section are no problem.
export function parseRouting(config: ForgeConfig | undefined): Routing {
  const problems: string[] = [];
  const table: RoutingTable = {};
  for (const [key, value] of Object.entries(config?.routing ?? {})) {
    const m = /^(model|effort)\.(.+)$/.exec(key);
    if (!m) {
      problems.push(`routing ignored: ${key} is not model.<role> or effort.<role>`);
      continue;
    }
    const [, field, role] = m as unknown as [string, 'model' | 'effort', string];
    if (field === 'model' && !isModel(value)) {
      problems.push(`routing ignored: ${key} ${JSON.stringify(value)} is no model alias or claude-* id`);
      continue;
    }
    if (field === 'effort' && !isEffort(value)) {
      problems.push(`routing ignored: ${key} ${JSON.stringify(value)} is not ${EFFORTS.join('|')}`);
      continue;
    }
    table[role] = { ...table[role], [field]: value };
  }
  return { table, problems };
}

// The entry for a spawn's `subagentType`: the type verbatim, else a plugin
// role named without its prefix.
export function entryFor(table: RoutingTable, subagentType: string): RoutingEntry | undefined {
  if (table[subagentType]) return table[subagentType];
  const prefix = `${PLUGIN}:`;
  return subagentType.startsWith(prefix) ? table[subagentType.slice(prefix.length)] : undefined;
}

// The `model` and `effort` of an agent file's frontmatter: the defaults routing
// overrides. Absent text or fields read as unknown.
export function frontmatterOf(text: string | undefined): RoutingEntry {
  const head = text?.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  const value = (name: string) => head.match(new RegExp(`^${name}:\\s*(\\S+)\\s*$`, 'm'))?.[1];
  const model = value('model');
  const effort = value('effort');
  return { ...(model ? { model } : {}), ...(isEffort(effort) ? { effort } : {}) };
}

// The plugin role a spawn's `subagentType` names (`forge-sdlc:researcher` ->
// `researcher`), else undefined: only a plugin role has an agent file here.
export const pluginRoleOf = (subagentType: string): string | undefined =>
  subagentType.startsWith(`${PLUGIN}:`) ? subagentType.slice(PLUGIN.length + 1) : undefined;

// Whether the entry changes what the agent would have run without routing: its
// model differs from the Agent call's model, else the frontmatter's; its effort
// from the frontmatter's. An unknown default counts as changed. The pane marks
// only such rows: a host config repeating the defaults overrides nothing.
export function overrides(entry: RoutingEntry, frontmatter: RoutingEntry, callModel?: string): boolean {
  const model = callModel ?? frontmatter.model;
  return (
    (entry.model !== undefined && entry.model !== model) ||
    (entry.effort !== undefined && entry.effort !== frontmatter.effort)
  );
}
