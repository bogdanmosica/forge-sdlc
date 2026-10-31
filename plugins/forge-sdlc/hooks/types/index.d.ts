// The mod's state contract: every value the run pane (run-pane.tsx, run-band.tsx)
// and the workbench views keep in `$.state`, declared under the plugin's name so
// `claude plugin validate` holds the module to it. A SessionRecord is also what
// each session publishes to ~/.cache/workbench/sessions/<id>.json for the other
// sessions' Boards pane and band to read.

// The run pane (run-pane.tsx): the snapshot each tick reads, the map, the
// per-agent usage, the view, the price table, the run and what routing applied.

export type RunPaneCategory = {
  name: string;
  tokens: number;
  kind: 'used' | 'free' | 'buffer' | 'deferred';
};

export type RunPaneUsage = {
  percent?: number;
  tokens?: number;
  window: number;
  usd?: number;
  categories: RunPaneCategory[];
  limits?: RunPaneLimit[]; // absent in snapshots kept before the limit gauges
};

// What the band says beside the figures while it lasts: an unasked pane that
// waits for a wider terminal, the host config's problems per section.
export type RunPaneNotes = {
  pane?: string;
  routing?: string;
  crew?: string;
  mark?: string;
};

// A subscription's rate-limit window as the pane gauges it.
export type RunPaneLimit = {
  kind: string; // five_hour, seven_day
  percent: number;
  resetsAt?: string;
};

export type RunPaneAgent = {
  id: string;
  description: string;
  type: string;
  status: string;
};

export type RunPaneSnapshot = {
  usage: RunPaneUsage | null;
  agents: RunPaneAgent[];
  readAt: number;
  // The host config's crew theme as the band names it; absent with no theme,
  // theme none, or before the crew was read.
  crew?: { label: string };
  // The host config's mark at the left of the band; absent before it was read
  // (the band draws forge), empty for text none.
  mark?: MarkPart[];
};

export type MarkPart = { text: string; color?: string };

export type RunPaneTicket = {
  number: string;
  title: string;
  status: 'open' | 'claimed' | 'closed';
  blockedBy: string[];
};

export type RunPaneMap = {
  dir: string; // docs/efforts/<slug>
  slug: string;
  title: string;
  tickets: RunPaneTicket[]; // the local tickets under .scratch/<slug>/issues
  choices: string[]; // every map dir under docs/efforts, newest first: what the picker cycles
};

export type AgentUsage = {
  model: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  steps: number;
};

// What the driver toggled: the per-agent table, and the map the picker chose
// (a map dir under docs/efforts; absent, the newest map).
export type RunPaneView = {
  table: boolean;
  map?: string;
};

// The run: one per session on a map, its id the ISO time it began.
export type RunPaneRun = {
  id: string;
  startedAt: number;
};

// prices.json as loaded: dated list prices per model, USD per million tokens.
export type RunPanePrice = { input: number; output: number; cacheRead: number; cacheWrite: number };
export type RunPanePrices = {
  date: string;
  source: string;
  unit: string;
  models: Record<string, RunPanePrice>;
};

// What routing applied to one spawned agent, keyed by agent id: the type it was
// spawned as, the model and/or effort the host config set, and whether that
// changed the default (the Agent call's model, else the frontmatter's; the
// frontmatter's effort). Only an overridden agent's row is marked.
export type AgentRouting = {
  type: string;
  model?: string;
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  overridden: boolean;
};

// The workbench views (sessions.ts, focus.tsx, boards.tsx, band.tsx,
// commands.tsx).

export type SessionStatus = 'working' | 'idle' | 'needs-you';

export type SessionLimit = { kind: string; percentUsed: number; resetsAt?: string };

export type SessionRecord = {
  id: string;
  cwd: string;
  repo: string; // the folder name
  branch?: string;
  title: string; // the first prompt's first line
  lastPrompt: string;
  lastReply: string; // the first plain line of the last answer
  status: SessionStatus;
  reason?: string; // why it needs you: question, plan review, permission: <tool>
  since: number; // when the status last changed
  startedAt: number;
  lastTurnAt?: number;
  updatedAt: number; // heartbeat: older than STALE_MS means the session is gone
  files: string[]; // edited this session, newest first, relative to cwd when inside
  dirty?: number; // tracked files changed, from the Focus refresh
  ahead?: number; // commits the upstream lacks
  ctxPercent?: number;
  costUsd?: number;
  limits: SessionLimit[];
};

export type FocusMr = {
  iid: number;
  url: string;
  state: string;
  pipeline?: string; // head pipeline status; absent when the MR has none
  isDraft: boolean;
  hasConflicts?: boolean;
  threadsOpen?: boolean; // blocking discussions unresolved
  mergeStatus?: string; // GitLab's detailed_merge_status: mergeable, not_approved, need_rebase…
  checkedAt: number;
};

// `added`/`removed`: lines the checkout has that `base` (origin's default
// branch) lacks, against their merge base, untracked files counted as added.
export type FocusGit = {
  dirty: number;
  ahead: number;
  added?: number;
  removed?: number;
  base?: string;
  checkedAt: number;
};

export type FocusJira = { key: string; url: string; status: string; summary: string; checkedAt: number };

// The last main-thread model response: when it came, what the next request
// re-sends, and whether it read or wrote the prompt cache at all.
export type FocusCache = { at: number; tokens: number; isObserved: boolean };

export type GateState = 'ok' | 'fail' | 'wait' | 'unknown';
export type MergeGate = { label: string; detail: string; state: GateState };

export type BoardsTab = 'board' | 'lanes' | 'inbox' | 'crew';

export type TeamMember = { name: string; model?: string; prompt?: string; color?: string; isActive?: boolean };
export type TeamInfo = { name: string; lead?: TeamMember; members: TeamMember[] };

export type DiffView = { title: string; stat: string; patch: string; isCut: boolean; error?: string };
export type SideChat = { question: string; answer?: string; error?: string; isAsking: boolean };
export type MorningRow = { repo: string; branch: string; iid?: number; url?: string; issues: string[] };
export type Morning = { checkedAt: number; rows: MorningRow[]; unreachable: number; isChecking: boolean };

declare module 'claude-code' {
  interface PluginState {
    'forge-sdlc': {
      // the run pane
      runPane: RunPaneSnapshot | null;
      runPaneMap: RunPaneMap | null;
      agentUsage: Record<string, AgentUsage>;
      runPaneView: RunPaneView;
      runPanePrices: RunPanePrices | null;
      runPaneRun: RunPaneRun | null;
      agentRouting: Record<string, AgentRouting>;
      crewCounts: Record<string, number>;
      runPaneNotes: RunPaneNotes;
      bandTurns: number; // prompts sent this session: every third shows a tip in the band
      // the workbench views
      self: SessionRecord | null;
      focusMr: FocusMr | null;
      focusGit: FocusGit | null;
      focusJira: FocusJira | null;
      focusJiraTried: { key: string; at: number } | null; // the last ticket asked for
      focusCache: FocusCache | null;
      boardsTab: BoardsTab;
      boardsSessions: SessionRecord[];
      boardsTeams: TeamInfo[];
      inboxSeen: Record<string, number>; // session id -> when this viewer marked it read
      diffView: DiffView | null;
      sideChat: SideChat | null;
      morning: Morning | null;
    };
  }
}
