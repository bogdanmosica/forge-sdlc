// The run pane: a driver sees the run without opening files. The plugin's one
// hooks module, loaded from hooks.json beside the classic guardrail hooks.
//
// Data: `$.session.usage({ breakdown: 'summary' })` for the context gauge, cost
// and categories; `$.agent.list()` for the agents; `turn.step` usage summed by
// agent (run-pane/usage.ts); the effort maps under docs/efforts and their local
// tickets (run-pane/tracker.ts); the effort's stage from `.forge/state.json`.
// Everything a drawing reads lives in `$.state` under the contract in
// hooks/types/index.d.ts.
//
// Opens on `/forge-pane` (seated at any width) and unasked on `/forge-sdlc:wayfinder`
// and `/forge-sdlc:build` (seated from 144 columns; below that the band says the
// pane waits). The figures also sit in the band above the prompt (run-band.tsx,
// with the H handoff button and /handoff-new), never as a $.ui.status line. Refreshes every five seconds. Draws on the
// terminal and the desktop app only; Buttons with hotkeys, never Select.
//
// The /forge panel (forge.tsx, tables in forge/help.ts): the plugin's commands
// read from the skills' own SKILL.md files, its agents, how the loop runs and
// where the driver is needed; /forge-sdlc:help opens it. Registered from here
// (registerForge, FORGE_COMMAND) since a plugin has one hooks module.
//
// Routing (run-pane/routing.ts, shape in ROUTING.md): the host config's
// `## Routing` section, read at each spawn, sets a routed agent's model on
// `agent.spawn` and its effort on each of its `turn.step`s. Frontmatter is the
// default, routing the override, the engine's forcing variables and effort cap
// above both. An invalid bullet is toasted once, kept in the band and ignored.
//
// Command center (run-pane/activity.ts): one row per agent with its crew name,
// the tool call it is in, the files it edited, its tokens and its elapsed time,
// and a diff button that opens the diff pane on its worktree (the call's cwd,
// else the toplevel of its first edit, else the session's).
//
// Crew (run-pane/crew.ts): the host config's `## Crew` section, read at each
// spawn, names an agent its call left unnamed with the next name of its role's
// pool (a plugin role's, else the general pool), from the plugin's crew.json or
// the section's own names, in front of its description. The loop's member calls
// arrive named by bin/crew-name.mjs and show that handle's display form. On
// `agent.spawn`, never `tool.call`: a rewritten call lands after auto mode
// reviewed it, so every dispatch was refused once; spawn pins `name`, so there
// is no `@` handle.
//
// The workbench views (workbench.tsx: sessions.ts, focus.tsx, boards.tsx,
// band.tsx, commands.tsx) register their matched hooks through
// registerWorkbench, and the four unmatched events they need, session.start,
// prompt.submit (run-band.tsx), turn.step and turn.complete, are this module's,
// which call their functions: a plugin may hook an event only once without a
// matcher.
import { atom, read, update } from 'claude-code';
import type { AgentSpawnInput, AgentSpawnResult, EngineInterface, Register, SessionUsage } from 'claude-code';
import type {
  AgentActivity,
  AgentRouting,
  AgentUsage,
  RunPaneMap,
  RunPanePrices,
  RunPaneRun,
  RunPaneSnapshot,
  RunPaneNotes,
  RunPaneUsage,
  RunPaneView,
} from './types';
import { addStep, compactTokens, MAIN } from './run-pane/usage';
import { HOST_CONFIG, parseForgeConfig } from './run-pane/config';
import type { ForgeConfig } from './run-pane/config';
import { entryFor, frontmatterOf, overrides, parseRouting, pluginRoleOf } from './run-pane/routing';
import { GENERAL, crewNameOf, displayNameOf, hasCrewName, nameAt, parseCrew, withCrewName } from './run-pane/crew';
import { begun, diffDirOf, doingOf, elapsedText, ended } from './run-pane/activity';
import { openDiff } from './commands';
import { run as runProcess } from './sessions';
import { parseMark } from './run-pane/mark';
import { parseWorktrees } from './run-pane/worktrees';
import { frontierOf, readMap } from './run-pane/tracker';
import { FORGE_COMMAND, registerForge } from './forge';
import { HANDOFF_COMMAND, registerRunBand } from './run-band';
import { completeWorkbenchTurn, noteWorkbenchStep, registerWorkbench, startWorkbench } from './workbench';
import { bar, barParts, dimTone, limitsOf, plural, short, tone, untilReset, usd } from './run-pane/gauges';
import { estimateUsd, parsePrices, usdEstimate } from './run-pane/prices';
import { csvOf, historyText, isRunKey, recordOf, runKey, stageOf } from './run-pane/history';
import type { RunRecord } from './run-pane/history';

const PANE = 'run-pane';
const STATE_FILE = '.forge/state.json';
const EXPORT_PATH = '.forge/run-pane/history.csv';
const USAGE =
  'Usage: /forge-pane [history | export | close]. No argument opens the pane; history lists the stored runs; export writes them as CSV under .forge; close closes the pane.';
const REFRESH_MS = 5000;

const snapshot = atom({ plugin: 'forge-sdlc', key: 'runPane' } as const, null as RunPaneSnapshot | null);
const mapState = atom({ plugin: 'forge-sdlc', key: 'runPaneMap' } as const, null as RunPaneMap | null);
const agentUsage = atom({ plugin: 'forge-sdlc', key: 'agentUsage' } as const, {} as Record<string, AgentUsage>);
const view = atom({ plugin: 'forge-sdlc', key: 'runPaneView' } as const, { table: false } as RunPaneView);
const prices = atom({ plugin: 'forge-sdlc', key: 'runPanePrices' } as const, null as RunPanePrices | null);
const run = atom({ plugin: 'forge-sdlc', key: 'runPaneRun' } as const, null as RunPaneRun | null);
const agentRouting = atom({ plugin: 'forge-sdlc', key: 'agentRouting' } as const, {} as Record<string, AgentRouting>);
const bandNotes = atom({ plugin: 'forge-sdlc', key: 'runPaneNotes' } as const, {} as RunPaneNotes);
const crewCounts = atom({ plugin: 'forge-sdlc', key: 'crewCounts' } as const, {} as Record<string, number>);
const agentActivity = atom({ plugin: 'forge-sdlc', key: 'agentActivity' } as const, {} as Record<string, AgentActivity>);

function usageOf(u: SessionUsage): RunPaneUsage {
  return {
    percent: u.context.percent,
    tokens: u.context.tokens,
    window: u.context.window,
    usd: u.cost?.usd,
    categories: (u.context.breakdown?.categories ?? []).map((c) => ({ name: c.name, tokens: c.tokens, kind: c.kind })),
    limits: u.rateLimits.map((l) => ({ kind: l.kind, percent: l.percentUsed, resetsAt: l.resetsAt })),
  };
}

// Module variables: reset on a hot reload, which also restarts the timer.
let ticks = 0;
const reported = new Set<string>(); // each host config problem is toasted once
const ticketCache = new Map<string, { mtimeMs: number; ticket: import('./types').RunPaneTicket | null }>();

// The run this session is: set once, kept in $.state across hot reloads; after a
// /clear no session.start fires, so the tick sets it when absent.
async function ensureRun($: EngineInterface): Promise<RunPaneRun> {
  const held = await read($, run);
  if (held) return held;
  const startedAt = await $.clock.now();
  const fresh = { id: new Date(startedAt).toISOString(), startedAt };
  await update($, run, (cur) => cur ?? fresh);
  return (await read($, run)) ?? fresh;
}

// The project dir whose `.forge/` holds the run state: the host bin/host-dir.mjs
// prints for the session's directory, resolved by hostDirOf as the hooks resolve it,
// so a subfolder host (a monorepo's projects/<x>) reads its own state and a session
// in a slice worktree its host's; the session's directory outside git or when
// node cannot run.
async function projectDir($: EngineInterface): Promise<string> {
  const cwd = await $.session.cwd();
  try {
    const ran = await $.process.run(['node', `${$.plugin.root}/bin/host-dir.mjs`, cwd], { timeoutMs: 5000 });
    if (ran.exitCode === 0 && ran.stdout.trim()) return ran.stdout.trim();
  } catch {
    /* node did not run: the session's directory is the project */
  }
  return cwd;
}

// Where the effort stands, read from the host's `.forge/state.json`: written by
// the commands at each stage boundary, read, never written, here as in the hooks.
async function readStage($: EngineInterface, map: RunPaneMap): Promise<string> {
  try {
    return stageOf(JSON.parse(await $.fs.read(`${await projectDir($)}/${STATE_FILE}`)), map.slug);
  } catch {
    return 'no state';
  }
}

// The run's record in the store: rewritten on every tick with usage on a map.
async function storeRun($: EngineInterface, map: RunPaneMap, s: RunPaneSnapshot): Promise<void> {
  const tokens = await read($, agentUsage);
  if (Object.keys(tokens).length === 0) return;
  const held = await ensureRun($);
  const record = recordOf({
    map,
    run: held,
    now: s.readAt,
    tokens,
    agents: s.agents,
    prices: await read($, prices),
    stage: await readStage($, map),
  });
  await $.store.set(runKey(map.dir, held.id), record);
}

// Every run record in the store, whatever map it belongs to.
async function storedRuns($: EngineInterface): Promise<RunRecord[]> {
  const records: RunRecord[] = [];
  for (const key of await $.store.keys()) {
    if (!isRunKey(key)) continue;
    const value = await $.store.get(key);
    if (value && typeof value === 'object' && 'agents' in value) records.push(value as RunRecord);
  }
  return records;
}

// A file's text, undefined when it is missing or unreadable.
async function readOrUndefined($: EngineInterface, path: string): Promise<string | undefined> {
  try {
    return await $.fs.read(path);
  } catch {
    return undefined;
  }
}

// The host config as its sections; undefined when the host has none.
async function readConfig($: EngineInterface): Promise<ForgeConfig | undefined> {
  const text = await readOrUndefined($, HOST_CONFIG);
  return text === undefined ? undefined : parseForgeConfig(text);
}

// A section's problems become its note in the band above the prompt, kept while they last;
// each problem is toasted the first time it is seen.
async function sayOnce($: EngineInterface, section: 'routing' | 'crew' | 'mark' | 'worktrees', problems: string[]) {
  const note = problems.length ? problems.join(' · ') : undefined;
  await update($, bandNotes, (n) => ({ ...n, [section]: note }));
  const unsaid = problems.filter((p) => !reported.has(p));
  unsaid.forEach((p) => reported.add(p));
  if (unsaid.length) $.ui.toast(`forge-sdlc: ${unsaid.join(' · ')}`);
}

async function readRouting($: EngineInterface, config: ForgeConfig | undefined) {
  const routing = parseRouting(config);
  await sayOnce($, 'routing', routing.problems);
  return routing.table;
}

// A spawn's input with the crew name in front of its description: a member
// call (skills/build/MEMBERS.md) already carries its name as the call's `name`,
// the handle bin/crew-name.mjs printed, which stays the address and is shown in
// its display form; any other call takes the next of its role's pool counted
// across the session. A fork and a role with no pool are left as they are. At
// spawn, not at the Agent tool call: a rewrite of the call lands after auto mode
// reviewed it, which then gets no verdict. The handle (`name`) is pinned at
// spawn, so a pool name rides in the description alone.
async function crewNamedSpawn($: EngineInterface, e: AgentSpawnInput): Promise<AgentSpawnInput> {
  const type = e.subagentType;
  if (e.fork || type === 'fork') return e;
  const crew = parseCrew(await readConfig($), await readOrUndefined($, `${$.plugin.root}/crew.json`));
  await sayOnce($, 'crew', crew.problems);
  if (e.name)
    return hasCrewName(e.description)
      ? e
      : { ...e, description: withCrewName(displayNameOf(e.name, crew.pools), e.description) };
  const role = pluginRoleOf(type) ?? GENERAL;
  const pool = crew.pools[role];
  if (!pool) return e;
  let index = 0;
  await update($, crewCounts, (all) => {
    index = all[role] ?? 0;
    return { ...all, [role]: index + 1 };
  });
  return { ...e, description: withCrewName(nameAt(pool, index), e.description) };
}

// The picked map (the view's choice, else the newest) into $.state; null when
// none, the last map kept when the read fails.
async function loadMap($: EngineInterface): Promise<RunPaneMap | null> {
  try {
    const map = await readMap(
      { list: (path) => $.fs.list(path), read: (path) => $.fs.read(path) },
      ticketCache,
      (await read($, view)).map,
    );
    await update($, mapState, () => map);
    return map;
  } catch {
    return null;
  }
}

// The picker: the next map after the shown one, wrapping, then a fresh read.
async function pickNextMap($: EngineInterface): Promise<void> {
  const m = await read($, mapState);
  if (!m || m.choices.length < 2) return;
  const next = m.choices[(m.choices.indexOf(m.dir) + 1) % m.choices.length];
  await update($, view, (cur) => ({ ...cur, map: next }));
  await loadMap($);
}

// A plugin role's frontmatter defaults from its agent file; unknown for any
// other agent type or an unreadable file.
async function readFrontmatter($: EngineInterface, subagentType: string) {
  const role = pluginRoleOf(subagentType);
  if (!role) return {};
  try {
    return frontmatterOf(await $.fs.read(`${$.plugin.root}/agents/${role}.md`));
  } catch {
    return {};
  }
}

// The routing at spawn: a fork inherits and is left alone; a routed type takes
// the host config's model, and its row is marked when that changed the default.
async function routedSpawn(
  $: EngineInterface,
  e: AgentSpawnInput,
  next: (e: AgentSpawnInput) => Promise<AgentSpawnResult>,
): Promise<AgentSpawnResult> {
  if (e.fork) return next(e);
  const entry = entryFor(await readRouting($, await readConfig($)), e.subagentType);
  if (!entry) return next(e);
  const overridden = overrides(entry, await readFrontmatter($, e.subagentType), e.model);
  const result = await next(entry.model ? { ...e, model: entry.model } : e);
  if (result.agentId)
    await update($, agentRouting, (all) => ({
      ...all,
      [result.agentId!]: { type: e.subagentType, ...entry, overridden },
    }));
  return result;
}

// An agent's diff in the diff pane: cut in the call's own directory, else the
// worktree of its first edit (git's toplevel of that folder), else the session's;
// the mode /diff-pane would pick there (branch off main, working tree on it).
async function openAgentDiff($: EngineInterface, id: string): Promise<void> {
  const a = (await read($, agentActivity))[id];
  let dir = diffDirOf(a);
  if (dir && !a?.cwd) dir = (await runProcess($, ['git', 'rev-parse', '--show-toplevel'], dir))?.trim() || dir;
  const cwd = dir ?? (await $.session.cwd());
  const branch = (await runProcess($, ['git', 'rev-parse', '--abbrev-ref', 'HEAD'], cwd))?.trim() || undefined;
  await openDiff($, cwd, branch, '');
}

async function tick($: EngineInterface): Promise<void> {
  ticks += 1;
  const before = await read($, snapshot);
  let usage = before?.usage ?? null;
  let agents = before?.agents ?? [];
  try {
    usage = usageOf(await $.session.usage({ breakdown: 'summary' }));
  } catch {
    /* keep the last reading */
  }
  try {
    agents = (await $.agent.list()).map((a) => ({
      id: a.id,
      description: a.description,
      type: a.type,
      status: a.status,
    }));
  } catch {
    /* keep */
  }
  const config = await readConfig($);
  const crew = parseCrew(config, await readOrUndefined($, `${$.plugin.root}/crew.json`));
  const mark = parseMark(config);
  await sayOnce($, 'mark', mark.problems);
  await sayOnce($, 'worktrees', parseWorktrees(config).problems);
  const next: RunPaneSnapshot = {
    usage,
    agents,
    readAt: await $.clock.now(),
    ...(crew.label ? { crew: { label: crew.label } } : {}),
    mark: mark.parts,
  };
  await update($, snapshot, () => next);
  const stopped = agents.filter((a) => a.status !== 'running' && a.status !== 'pending');
  if (stopped.length)
    await update($, agentActivity, (all) => stopped.reduce((acc, a) => ended(acc, a.id, next.readAt), all));
  const map = await loadMap($);
  if (map) {
    try {
      await storeRun($, map, next);
    } catch {
      /* the store is full or away: the pane still draws */
    }
  }
}

// The dated price table the plugin ships; absent, every USD estimate draws as `$?`.
async function loadPrices($: EngineInterface): Promise<void> {
  try {
    const table = parsePrices(await $.fs.read(`${$.plugin.root}/prices.json`));
    await update($, prices, () => table);
  } catch {
    /* no table: the estimate stays unknown */
  }
}

async function open($: EngineInterface, asked: boolean) {
  const opened = await $.ui.open(
    // Esc closes it while it has the focus; /forge-pane close from the prompt.
    asked
      ? { id: PANE, title: 'Run', focus: true, columns: 64, closeOnEscape: true }
      : { id: PANE, title: 'Run', columns: 64, closeOnEscape: true },
  );
  const pane = opened.isPlaced ? undefined : 'run pane waits: widen to 144 columns or /forge-pane';
  await update($, bandNotes, (n) => ({ ...n, pane }));
  return opened;
}

export const register: Register = (on) => {
  registerWorkbench(on); // first: its needs-you band sits above the run's band (the first band hook is the outermost)
  registerForge(on); // the /forge panel: one hooks module per plugin
  registerRunBand(on); // the band above the prompt: the figures, the notes, the H button, /handoff-new

  on('session.start', async ($, e, next) => {
    await $.command.register(FORGE_COMMAND);
    await $.command.register(HANDOFF_COMMAND);
    await $.command.register({
      name: 'forge-pane',
      description:
        'Open the run pane: frontier, agents, where your context went. `history` lists the stored runs, `export` writes them as CSV, `close` closes it',
      argumentHint: '[history | export | close]',
      immediate: true,
    });
    $.clock.every(REFRESH_MS, () => {
      void tick($);
    });
    await loadPrices($);
    await ensureRun($);
    const started = await next(e);
    await startWorkbench($); // this session's record, the workbench panes' commands and timers
    return started;
  });

  on('turn.complete', async ($, e, next) => {
    const done = await next(e);
    await completeWorkbenchTurn($, e); // a main-thread turn: idle, the panes refreshed
    return done;
  });

  on('command.run', { command: 'forge-pane' }, async ($, e) => {
    const arg = e.args.trim().split(/\s+/)[0] ?? '';
    if (arg === 'history') return { text: historyText(await storedRuns($), await read($, prices)) };
    if (arg === 'export') {
      const records = await storedRuns($);
      const csv = csvOf(records);
      await $.fs.write(EXPORT_PATH, csv.text);
      return {
        text: `Run history exported: ${EXPORT_PATH} (${plural(csv.rows, 'row')}, ${plural(records.length, 'run')}).`,
      };
    }
    if (arg === 'close') {
      await $.ui.close({ id: PANE });
      return { text: 'Run pane closed.' };
    }
    if (arg !== '') return { text: USAGE };
    const opened = await open($, true);
    return { text: opened.isPlaced ? 'Run pane opened.' : `Run pane waits: ${opened.reason}` };
  });

  // The loop's front door and its build open the pane unasked: seated from 144
  // columns, else the band says it waits. The skill name may carry its plugin prefix.
  on('skill.prompt', { skill: /(^|:)(wayfinder|build)$/ }, async ($, e, next) => {
    await open($, false);
    return next(e);
  });

  // Crew, then routing, at spawn: the crew name in front of the description,
  // read fresh at each spawn so an edit counts without a restart; then the model
  // (a fork inherits and is left alone), and the effort on each step of a routed
  // agent whose model takes an effort. The command center's record begins here.
  on('agent.spawn', async ($, input, next) => {
    const e = await crewNamedSpawn($, input);
    const result = await routedSpawn($, e, next);
    if (result.agentId) {
      const id = result.agentId;
      const now = await $.clock.now();
      await update($, agentActivity, (all) => begun(all, id, now, e.cwd));
    }
    return result;
  });

  on('turn.step', async function* ($, e, next) {
    const routed = e.agentId && e.effort !== undefined ? (await read($, agentRouting))[e.agentId] : undefined;
    const result = yield* next(routed?.effort ? { ...e, effort: routed.effort } : e);
    if (result.usage) await update($, agentUsage, (all) => addStep(all, e.agentId, result.usage!));
    await noteWorkbenchStep($, e, result); // the Focus pane's prompt-cache chip
    return result;
  });

  on('ui.render', { component: 'Pane', requestId: PANE, surface: ['terminal', 'desktop'] }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e);
    const s = await read($, snapshot);
    const m = await read($, mapState);
    const tokens = await read($, agentUsage);
    const v = await read($, view);
    const table = await read($, prices);
    const routed = await read($, agentRouting);
    const activity = await read($, agentActivity);
    const f = m ? frontierOf(m.tickets) : null;
    const cols = Math.max(24, e.props.bodyColumns);
    const agents = s?.agents ?? [];
    const running = agents.filter((a) => a.status === 'running').length;
    const used = (s?.usage?.categories ?? []).filter((c) => c.kind === 'used');
    const usedTotal = used.reduce((sum, c) => sum + c.tokens, 0);
    const mark = (status: string) => {
      if (status === 'running') return '●';
      if (status === 'completed') return '✓';
      if (status === 'failed' || status === 'killed') return '✗';
      return '○';
    };
    const wide = cols >= 60;
    const limits = limitsOf(s?.usage);
    // One bar width for every gauge, so ctx sits over session in the column.
    const gaugeWidth = Math.max(6, Math.min(20, Math.floor((cols - 50) / 2)));
    const gauge = (key: string, label: string, percent: number | undefined, reset?: string) => (
      <Box key={key} flexDirection="row">
        <Text dimColor>{label.padEnd(8)}</Text>
        <Text bold color={tone(key, percent)}>
          {String(percent ?? '?').padStart(3)}%{' '}
        </Text>
        <Text color={tone(key, percent)}>{barParts((percent ?? 0) / 100, gaugeWidth)[0]}</Text>
        <Text color={dimTone(key, percent)}>{barParts((percent ?? 0) / 100, gaugeWidth)[1]}</Text>
        {reset && <Text dimColor> ↻ {reset}</Text>}
      </Box>
    );
    const half = wide ? Math.floor((cols - 1) / 2) : cols;
    // The command center's name column: a crew name and its slice, a third of the pane.
    const nameWidth = Math.max(12, Math.min(28, Math.floor(cols / 3)));
    return (
      <Box flexDirection="column" width={cols}>
        <Box key="gauges" flexDirection="row" gap={2}>
          {gauge('ctx', 'ctx', s?.usage?.percent)}
          <Text bold>{usd(s?.usage?.usd)}</Text>
          <Text bold>{plural(running, 'agent')} running</Text>
        </Box>
        {limits.length > 0 && (
          <Box key="limits" flexDirection={wide ? 'row' : 'column'} columnGap={3}>
            {limits.map((l) => gauge(l.kind, l.label, l.percent, untilReset(l.resetsAt, s?.readAt ?? 0)))}
          </Box>
        )}
        <Box flexDirection={wide ? 'row' : 'column'} gap={1} marginTop={1}>
          <Box key="frontier-column" flexDirection="column" width={half}>
            <Box key="frontier-title">
              <Text bold underline>
                Frontier{m ? ` · ${short(m.title, half - 11)}` : ''}
              </Text>
            </Box>
            {!m && <Text dimColor>no map under docs/efforts</Text>}
            {m && m.tickets.length === 0 && <Text dimColor>no local tickets under .scratch/{m.slug}/issues</Text>}
            {f && (
              <Box key="claimed" flexDirection="column">
                {f.claimed.map((t) => (
                  <Text key={t.number} wrap="truncate-end">
                    ◐ {t.number} {short(t.title, half - 5)}
                  </Text>
                ))}
              </Box>
            )}
            {f && (
              <Box key="frontier" flexDirection="column">
                {f.frontier.map((t) => (
                  <Text key={t.number} wrap="truncate-end">
                    ○ {t.number} {short(t.title, half - 5)}
                  </Text>
                ))}
              </Box>
            )}
            {m && f && m.tickets.length > 0 && f.frontier.length === 0 && f.claimed.length === 0 && (
              <Text dimColor>nothing open and unblocked</Text>
            )}
            {m && f && m.tickets.length > 0 && (
              <Box key="frontier-counts">
                <Text dimColor>
                  {f.closed.length}/{m.tickets.length} closed · {f.blocked.length} blocked
                </Text>
              </Box>
            )}
          </Box>
        </Box>
        <Box key="agents-column" flexDirection="column" marginTop={1}>
          <Box key="agents-title">
            <Text bold underline>
              Agents · {String(running)} running / {String(agents.length)}
            </Text>
          </Box>
          {agents.length === 0 && <Text dimColor>no agents yet</Text>}
          <Box key="agents" flexDirection="column">
            {agents.map((a) => {
              const t = tokens[a.id];
              const act = activity[a.id];
              const isRunning = a.status === 'running';
              const name = hasCrewName(a.description) ? crewNameOf(a.description) : a.description || a.type;
              const doing = doingOf(act, a.status);
              const files = act?.files.length ? plural(act.files.length, 'file') : '';
              const toks = t ? `${compactTokens(t.output)}↑ ${compactTokens(t.input)}↓` : '';
              const until = act?.endedAt ?? s?.readAt ?? 0;
              return (
                <Box key={`row-${a.id}`} flexDirection="row" gap={1}>
                  <Box key="name" width={nameWidth} flexShrink={0}>
                    <Text dimColor={!isRunning} wrap="truncate-end">
                      {mark(a.status)} {name}
                      {routed[a.id]?.overridden ? ' ⇄ routed' : ''}
                    </Text>
                  </Box>
                  {wide && (
                    <Box key="doing" flexGrow={1} flexShrink={1}>
                      <Text dimColor wrap="truncate-end">
                        {doing}
                      </Text>
                    </Box>
                  )}
                  {wide && (
                    <Box key="files" width={8} flexShrink={0}>
                      <Text wrap="truncate-end">{files}</Text>
                    </Box>
                  )}
                  {wide && (
                    <Box key="tokens" width={12} flexShrink={0}>
                      <Text wrap="truncate-end">{toks}</Text>
                    </Box>
                  )}
                  <Box key="elapsed" width={8} flexShrink={0}>
                    <Text dimColor={!isRunning}>{elapsedText(act?.startedAt, until)}</Text>
                  </Box>
                  <Button
                    key={`diff-${a.id}`}
                    plain
                    label="diff"
                    onPress={() => {
                      void openAgentDiff($, a.id);
                    }}
                  />
                </Box>
              );
            })}
          </Box>
        </Box>
        <Box key="context-title" marginTop={1}>
          <Text bold underline>
            Where your context went
          </Text>
        </Box>
        <Box key="context" flexDirection="column">
          {used.length === 0 && <Text dimColor>no reading yet</Text>}
          {used.map((c) => (
            <Text key={c.name} wrap="truncate-end">
              {short(c.name, 18).padEnd(18)}{' '}
              {bar(usedTotal ? c.tokens / usedTotal : 0, Math.max(6, Math.min(30, cols - 28)))}{' '}
              {compactTokens(c.tokens).padStart(5)}
            </Text>
          ))}
        </Box>
        {v.table && (
          <Box key="agent-table" flexDirection="column" marginTop={1}>
            <Box key="agent-table-head">
              <Text bold underline>
                Agents · tokens and estimated USD
              </Text>
            </Box>
            <Box key="agent-table-rows" flexDirection="column">
              {Object.keys(tokens).length === 0 && <Text dimColor>no requests yet</Text>}
              {Object.entries(tokens)
                .sort(([a], [b]) => {
                  if (a === MAIN) return 1;
                  if (b === MAIN) return -1;
                  return a.localeCompare(b);
                })
                .map(([id, t]) => (
                  <Text key={id} wrap="truncate-end">
                    {short(id === MAIN ? MAIN : (agents.find((a) => a.id === id)?.type ?? id), 16).padEnd(16)}{' '}
                    {short(t.model, 18).padEnd(18)}
                    {routed[id]?.overridden ? '⇄' : ' '}
                    {compactTokens(t.output).padStart(5)}↑ {compactTokens(t.input).padStart(5)}↓{' '}
                    {compactTokens(t.cacheRead + t.cacheWrite).padStart(5)}⟲ {usdEstimate(estimateUsd(table, t))}
                  </Text>
                ))}
            </Box>
            <Box key="agent-table-note">
              <Text dimColor>
                out↑ in↓ cache⟲ ⇄ routed · USD is a list-price estimate
                {table ? `, prices of ${table.date}` : ', no price table loaded'}
              </Text>
            </Box>
          </Box>
        )}
        <Box key="actions" flexDirection="row" gap={2} marginTop={1}>
          {m && m.choices.length > 1 && (
            <Button
              key="map"
              label={`map ${m.choices.indexOf(m.dir) + 1}/${m.choices.length}`}
              hotkey="m"
              onPress={() => {
                void pickNextMap($);
              }}
            />
          )}
          <Button
            key="table"
            label={v.table ? 'hide table' : 'agents table'}
            hotkey="t"
            onPress={() => {
              void update($, view, (cur) => ({ ...cur, table: !cur.table }));
            }}
          />
          <Button
            key="close"
            label="close"
            hotkey="x"
            role="dismiss"
            onPress={() => {
              void $.ui.close({ id: PANE });
            }}
          />
        </Box>
      </Box>
    );
  });
};
