// The Boards pane (`/boards`): every live Claude session with this plugin, the
// mod counterpart of cmux-config's Boards panel, read from the session store
// (sessions.ts) every REFRESH_MS. Four tabs:
//
//   Board  sessions grouped by repo: status, branch, last prompt, age, ctx, cost
//   Lanes  needs-you, working, review (idle with uncommitted or unpushed work), idle
//   Inbox  sessions waiting on you, and those that finished a turn since this
//          viewer marked them read
//   Crew   Claude Code agent teams from ~/.claude/teams/<team>/config.json
//
// A mod cannot switch terminal tabs, so a row's "resume" button copies the
// command that reopens that session instead.
import { atom, read, update } from 'claude-code';
import type { EngineInterface, On } from 'claude-code';
import type { BoardsTab, SessionRecord, TeamInfo, TeamMember } from './types';
import { readSessions } from './sessions';

export const BOARDS_PANE = 'workbench-boards';
const REFRESH_MS = 5_000;
const TABS: { id: BoardsTab; label: string; hotkey: string }[] = [
  { id: 'board', label: 'Board', hotkey: 'b' },
  { id: 'lanes', label: 'Lanes', hotkey: 'l' },
  { id: 'inbox', label: 'Inbox', hotkey: 'i' },
  { id: 'crew', label: 'Crew', hotkey: 'c' },
];

const self = atom({ plugin: 'forge-sdlc', key: 'self' } as const, null as SessionRecord | null);
const boardsTab = atom({ plugin: 'forge-sdlc', key: 'boardsTab' } as const, 'board' as BoardsTab);
const boardsSessions = atom({ plugin: 'forge-sdlc', key: 'boardsSessions' } as const, [] as SessionRecord[]);
const boardsTeams = atom({ plugin: 'forge-sdlc', key: 'boardsTeams' } as const, [] as TeamInfo[]);
const inboxSeen = atom({ plugin: 'forge-sdlc', key: 'inboxSeen' } as const, {} as Record<string, number>);

export type Lane = 'needs-you' | 'working' | 'review' | 'idle';
export const LANES: Lane[] = ['needs-you', 'working', 'review', 'idle'];
const LANE_COLOR: Record<Lane, string> = { 'needs-you': 'yellow', working: 'blue', review: 'magenta', idle: 'green' };

export function laneOf(r: SessionRecord): Lane {
  if (r.status === 'needs-you' || r.status === 'working') return r.status;
  return (r.dirty ?? 0) > 0 || (r.ahead ?? 0) > 0 ? 'review' : 'idle';
}

// Unread for this viewer: waiting on a person since after it was last marked
// read (a newer prompt shows again), or a turn finished after that.
export function isUnread(r: SessionRecord, seen: Record<string, number>, since: number): boolean {
  if (r.status === 'needs-you') return r.since > (seen[r.id] ?? 0);
  return (r.lastTurnAt ?? 0) > (seen[r.id] ?? since);
}

export function age(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${Math.round(s / 3600)}h`;
}

type TeamConfig = { members?: (TeamMember & { agentType?: string })[] };

export async function readTeams($: EngineInterface): Promise<TeamInfo[]> {
  const home = await $.env.get('HOME');
  if (!home) return [];
  const root = `${home}/.claude/teams`;
  const out: TeamInfo[] = [];
  try {
    for (const entry of await $.fs.list(root)) {
      if (entry.kind !== 'dir' && !entry.isLink) continue;
      try {
        const config = JSON.parse(await $.fs.read(`${root}/${entry.name}/config.json`)) as TeamConfig;
        const members = config.members ?? [];
        out.push({
          name: entry.name,
          lead: members.find((m) => m.name === 'team-lead'),
          members: members.filter((m) => m.name !== 'team-lead'),
        });
      } catch {
        // a folder without a readable roster is not a team yet
      }
    }
  } catch {
    return [];
  }
  return out;
}

export async function refreshBoards($: EngineInterface) {
  const [sessions, teams] = await Promise.all([readSessions($), readTeams($)]);
  await update($, boardsSessions, () => sessions);
  await update($, boardsTeams, () => teams);
}

// Run by workbench.tsx once this session's record exists.
export async function startBoards($: EngineInterface) {
  await $.command.register({
    name: 'boards',
    description: 'Show every running Claude session: board, lanes, inbox, crew',
  });
  $.clock.after(0, () => void refreshBoards($));
  $.clock.every(REFRESH_MS, () => void refreshBoards($));
}

const resumeCommand = (r: SessionRecord) => `cd ${JSON.stringify(r.cwd)} && claude --resume ${r.id}`;

export function registerBoards(on: On) {
  on('command.run', { command: 'boards' }, async ($) => {
    await refreshBoards($);
    await $.ui.open({ id: BOARDS_PANE, title: 'Boards' });
    return { text: 'Boards pane opened.' };
  });

  on('ui.render', { component: 'Pane', requestId: BOARDS_PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e);
    const [tab, sessions, teams, seen, me] = await Promise.all([
      read($, boardsTab),
      read($, boardsSessions),
      read($, boardsTeams),
      read($, inboxSeen),
      read($, self),
    ]);
    const now = await $.clock.now();
    const since = me?.startedAt ?? now;
    const unread = sessions.filter((r) => r.id !== me?.id && isUnread(r, seen, since));

    const row = (r: SessionRecord, extra?: string) => (
      <Box key={`row-${r.id}`} flexDirection="column">
        <Box>
          <Text color={LANE_COLOR[laneOf(r)]}>● </Text>
          <Text bold>{r.repo}</Text>
          <Text dimColor> ⎇ {r.branch ?? '–'}</Text>
          <Text color={LANE_COLOR[laneOf(r)]}>
            {' '}
            {r.status === 'needs-you' ? `needs you: ${r.reason ?? ''}` : r.status}
          </Text>
          <Text dimColor> {age(now - r.since)}</Text>
          {r.ctxPercent !== undefined && <Text dimColor> · ctx {Math.round(r.ctxPercent)}%</Text>}
          {r.costUsd !== undefined && <Text dimColor> · ${r.costUsd.toFixed(2)}</Text>}
          {r.id === me?.id && <Text dimColor> (this session)</Text>}
          {extra && <Text dimColor> {extra}</Text>}
          {r.id !== me?.id && <Text> </Text>}
          {r.id !== me?.id && (
            <Button
              key={`resume-${r.id}`}
              label="resume"
              plain
              dimColor
              onPress={(press) => void $.ui.copy({ text: resumeCommand(r), surface: press.surface })}
            />
          )}
        </Box>
        <Text dimColor> › {r.lastPrompt || r.title || '–'}</Text>
      </Box>
    );

    const repos = [...new Set(sessions.map((r) => r.repo))].sort();
    const body = {
      board: repos.map((repo) => (
        <Box key={`repo-${repo}`} flexDirection="column">
          <Text bold underline>
            {repo}
          </Text>
          {sessions.filter((r) => r.repo === repo).map((r) => row(r))}
        </Box>
      )),
      lanes: LANES.map((lane) => {
        const inLane = sessions.filter((r) => laneOf(r) === lane);
        return (
          <Box key={`lane-${lane}`} flexDirection="column">
            <Text bold color={LANE_COLOR[lane]}>
              {lane.toUpperCase()} ({inLane.length})
            </Text>
            {inLane.map((r) => row(r))}
          </Box>
        );
      }),
      inbox: [
        <Box key="inbox-head">
          <Text bold>{unread.length} unread</Text>
          {unread.length > 0 && (
            <Button
              key="inbox-all"
              label="Mark all read"
              plain
              onPress={() =>
                void update($, inboxSeen, (s) => ({ ...s, ...Object.fromEntries(unread.map((r) => [r.id, now])) }))
              }
            />
          )}
        </Box>,
        ...unread.map((r) => (
          <Box key={`inbox-${r.id}`}>
            {row(r, r.status === 'needs-you' ? undefined : `done: ${r.lastReply}`)}
            <Button
              key={`read-${r.id}`}
              label="read"
              plain
              dimColor
              onPress={() => void update($, inboxSeen, (s) => ({ ...s, [r.id]: now }))}
            />
          </Box>
        )),
      ],
      crew:
        teams.length === 0
          ? [
              <Text key="crew-none" dimColor>
                No agent team is running. Start a lead with CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1.
              </Text>,
            ]
          : teams.map((t) => (
              <Box key={`team-${t.name}`} flexDirection="column">
                <Text bold>
                  {t.name} <Text dimColor>({t.members.length + (t.lead ? 1 : 0)} total)</Text>
                </Text>
                {t.lead && (
                  <Text>
                    {' '}
                    lead <Text dimColor>{t.lead.model ?? ''}</Text>
                  </Text>
                )}
                {t.members.map((m) => (
                  <Box key={`member-${t.name}-${m.name}`}>
                    <Text color={m.isActive === false ? 'gray' : 'blue'}> {m.name}</Text>
                    <Text dimColor> {m.model ?? ''} </Text>
                    <Text dimColor>{(m.prompt ?? '').slice(0, 80)}</Text>
                  </Box>
                ))}
              </Box>
            )),
    };

    return (
      <Box flexDirection="column">
        <Box key="tabs">
          {TABS.map((t) => (
            <Button
              key={`tab-${t.id}`}
              label={t.id === 'inbox' && unread.length > 0 ? `${t.label} ${unread.length}` : t.label}
              hotkey={t.hotkey}
              variant={t.id === tab ? 'primary' : 'secondary'}
              onPress={() => void update($, boardsTab, () => t.id)}
            />
          ))}
        </Box>
        {sessions.length === 0 && tab !== 'crew' && <Text dimColor>No session has published yet.</Text>}
        {body[tab]}
      </Box>
    );
  });
}
