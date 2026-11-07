// The command center's per-agent record (ADR 0008): when an agent began and
// ended, the tool call it is in now, the files it edited and the directory its
// diff is cut in. Written from the run pane's agent.spawn hook, the session
// module's one tool.call hook (a subagent's calls are its own) and the tick that
// sees an agent stop running; read by the pane's rows. Pure functions over the
// record, so the pane and the hooks share one shape.
import { atom, read, update } from 'claude-code';
import type { EngineInterface } from 'claude-code';
import type { AgentActivity } from '../types';

export const agentActivity = atom(
  { plugin: 'forge-sdlc', key: 'agentActivity' } as const,
  {} as Record<string, AgentActivity>,
);

const EDIT_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const FILES_MAX = 20;

export const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

// A spawned agent's record: begun now, in the directory the call set (a cwd or
// a worktree), else the parent's, which the diff takes as the session's.
export function begun(all: Record<string, AgentActivity>, id: string, now: number, cwd?: string) {
  return { ...all, [id]: { startedAt: now, files: [], ...(cwd ? { cwd } : {}) } };
}

// The tool an agent's loop is running now; an agent the spawn hook never saw
// (spawned before the mod loaded) begins here, its start unknown.
export function inTool(all: Record<string, AgentActivity>, id: string, tool: string, path?: string) {
  const cur = all[id] ?? { files: [] };
  return { ...all, [id]: { ...cur, tool, ...(path ? { path } : {}) } };
}

// The call answered: the tool cleared, an edit's path kept newest first.
export function outOfTool(all: Record<string, AgentActivity>, id: string, tool: string, path?: string) {
  const cur = all[id] ?? { files: [] };
  const rest = { ...cur };
  delete rest.tool;
  delete rest.path;
  const files =
    EDIT_TOOLS.has(tool) && path ? [path, ...cur.files.filter((f) => f !== path)].slice(0, FILES_MAX) : cur.files;
  return { ...all, [id]: { ...rest, files } };
}

// An agent the list no longer shows running: ended now, once.
export function ended(all: Record<string, AgentActivity>, id: string, now: number) {
  const cur = all[id];
  if (!cur || cur.endedAt !== undefined) return all;
  const rest = { ...cur };
  delete rest.tool;
  delete rest.path;
  return { ...all, [id]: { ...rest, endedAt: now } };
}

// `m:ss`, `h:mm:ss` from an hour; `?` with no start.
export function elapsedText(startedAt: number | undefined, until: number): string {
  if (startedAt === undefined) return '?';
  const total = Math.max(0, Math.floor((until - startedAt) / 1000));
  const s = String(total % 60).padStart(2, '0');
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

// A file's name for a row: its last two path segments.
export const tailOf = (path: string): string => path.split('/').filter(Boolean).slice(-2).join('/');

// The directory an agent's diff is cut in: the call's own, else the folder of
// its first edit (its worktree's toplevel is resolved by the caller), else none.
export function diffDirOf(a: AgentActivity | undefined): string | undefined {
  if (!a) return undefined;
  if (a.cwd) return a.cwd;
  const first = a.files[a.files.length - 1];
  return first ? first.replace(/\/[^/]*$/, '') || '/' : undefined;
}

// The session module's tool.call hook hands a subagent's call here: the tool
// noted while it runs, the edit's path after, whatever the call answered.
export async function noteAgentCall<R>(
  $: EngineInterface,
  e: { agentId?: string; tool: string },
  run: () => Promise<R>,
): Promise<R> {
  const id = e.agentId;
  if (!id) return run();
  const input = e as unknown as Record<string, unknown>;
  const path = str(input.file_path) ?? str(input.notebook_path);
  await update($, agentActivity, (all) => inTool(all, id, e.tool, path));
  try {
    return await run();
  } finally {
    await update($, agentActivity, (all) => outOfTool(all, id, e.tool, path));
  }
}

// What a row says the agent is doing: the tool it is in (with the file of an
// edit), `thinking` between calls while it runs, else its status.
export function doingOf(a: AgentActivity | undefined, status: string): string {
  if (a?.tool) return a.path ? `${a.tool} ${tailOf(a.path)}` : a.tool;
  return status === 'running' ? 'thinking' : status;
}

export const readActivity = ($: EngineInterface) => read($, agentActivity);
