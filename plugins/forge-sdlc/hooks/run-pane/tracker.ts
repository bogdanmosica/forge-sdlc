// The efforts and their tickets, read as forge-sdlc lays them out: a map at
// `docs/efforts/<slug>/map.md` (design section 4), its tickets on the local
// tracker at `.scratch/<slug>/issues/NN-<title>.md` (docs/agents/issue-tracker.md),
// a `Status:` line and a `Blocked by:` line near the top of each ticket. The
// Frontier is the open, unblocked, unclaimed tickets, lowest number first. A
// host on a remote tracker has no ticket files: the map draws with none.
import type { RunPaneMap, RunPaneTicket } from '../types';

// What the reader needs of the file system: the module hands it `$.fs` calls,
// since `$` itself never crosses an import.
export type Files = {
  list: (path: string) => Promise<readonly { name: string; kind: string; mtimeMs: number }[]>;
  read: (path: string) => Promise<string>;
};

export const EFFORTS = 'docs/efforts';
export const TICKETS = '.scratch';
const CLOSED = new Set(['resolved', 'done', 'closed', 'wontfix']);
const CLAIMED = new Set(['claimed', 'in-progress', 'in_progress']);

// A line like `Status: claimed` or `**Status:** done`, read from the first lines.
function field(head: string, name: string): string | undefined {
  const m = head.match(new RegExp(`^\\**${name}:?\\**:?\\s*(.*)$`, 'mi'));
  return m?.[1]?.trim();
}

function statusOf(status: string): RunPaneTicket['status'] {
  if (CLOSED.has(status)) return 'closed';
  if (CLAIMED.has(status)) return 'claimed';
  return 'open';
}

export function parseTicket(fileName: string, text: string): RunPaneTicket | null {
  const m = fileName.match(/^(\d+)-.*\.md$/);
  if (!m) return null;
  const head = text.split('\n').slice(0, 12).join('\n');
  const status = (field(head, 'Status') ?? '').toLowerCase();
  const blockedBy = (field(head, 'Blocked by') ?? '').match(/\d+/g) ?? [];
  return {
    number: m[1]!,
    title: (head.match(/^# (.*)$/m)?.[1] ?? fileName).replace(/^(?:[a-z0-9-]+-)?\d+:?\s*/, '').trim(),
    status: statusOf(status),
    blockedBy,
  };
}

export function frontierOf(tickets: RunPaneTicket[]) {
  const byNumber = new Map(tickets.map((t) => [t.number, t]));
  const isClosed = (n: string) => byNumber.get(n)?.status === 'closed';
  const open = tickets.filter((t) => t.status === 'open');
  return {
    frontier: open.filter((t) => t.blockedBy.every(isClosed)),
    blocked: open.filter((t) => !t.blockedBy.every(isClosed)),
    claimed: tickets.filter((t) => t.status === 'claimed'),
    closed: tickets.filter((t) => t.status === 'closed'),
  };
}

type Cache = Map<string, { mtimeMs: number; ticket: RunPaneTicket | null }>;

// The maps under docs/efforts, newest first (by their map.md's modification
// time), and the picked one with its tickets: `chosen` when it is still a map,
// else the newest; null when no effort has a map. Ticket files are re-read only
// when their modification time moved.
export async function readMap(fs: Files, cache: Cache, chosen?: string): Promise<RunPaneMap | null> {
  let efforts: readonly { name: string; kind: string }[];
  try {
    efforts = await fs.list(EFFORTS);
  } catch {
    return null;
  }
  const maps: { dir: string; slug: string; mtimeMs: number }[] = [];
  for (const effort of efforts) {
    if (effort.kind !== 'dir') continue;
    const dir = `${EFFORTS}/${effort.name}`;
    let entries: readonly { name: string; kind: string; mtimeMs: number }[];
    try {
      entries = await fs.list(dir);
    } catch {
      continue;
    }
    const map = entries.find((e) => e.name === 'map.md' && e.kind === 'file');
    if (map) maps.push({ dir, slug: effort.name, mtimeMs: map.mtimeMs });
  }
  if (maps.length === 0) return null;
  const sorted = maps.sort((a, b) => b.mtimeMs - a.mtimeMs || a.dir.localeCompare(b.dir));
  const choices = sorted.map((m) => m.dir);
  const picked = sorted.find((m) => m.dir === chosen) ?? sorted[0]!;
  const mapText = await fs.read(`${picked.dir}/map.md`);
  const title = (mapText.match(/^# (.*)$/m)?.[1] ?? picked.slug).replace(/^Map:\s*/i, '').trim();
  const tickets = await readTickets(fs, cache, `${TICKETS}/${picked.slug}/issues`);
  return { dir: picked.dir, slug: picked.slug, title, tickets, choices };
}

// The tickets under a map's issues folder, in file name order; a file is re-read
// only when its modification time moved.
async function readTickets(fs: Files, cache: Cache, dir: string): Promise<RunPaneTicket[]> {
  const tickets: RunPaneTicket[] = [];
  let files: readonly { name: string; kind: string; mtimeMs: number }[] = [];
  try {
    files = await fs.list(dir);
  } catch {
    /* a map with no local tickets */
  }
  for (const f of files
    .filter((f) => f.kind === 'file' && f.name.endsWith('.md'))
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const path = `${dir}/${f.name}`;
    let hit = cache.get(path);
    if (!hit || hit.mtimeMs !== f.mtimeMs) {
      hit = { mtimeMs: f.mtimeMs, ticket: parseTicket(f.name, await fs.read(path)) };
      cache.set(path, hit);
    }
    if (hit.ticket) tickets.push(hit.ticket);
  }
  return tickets;
}
