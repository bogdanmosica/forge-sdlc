// The workbench mod's state contract (the views of the former workbench plugin): every value it keeps in `$.state`,
// declared under the plugin's name so `claude plugin validate` holds the
// module to it. A SessionRecord is also what each session publishes to
// ~/.cache/workbench/sessions/<id>.json for the other sessions' Boards pane
// and band to read.

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
