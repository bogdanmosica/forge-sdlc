// The needs-you band above the prompt: other sessions waiting on you, oldest
// first, then those that finished a turn while you were away, the mod
// counterpart of the needs-you strip on cmux-config's Board and Focus boards.
// At most MAX_ROWS rows and a "+N more" line; a prompt waiting longer than
// STALE_MS leaves the band (the Boards pane still lists it). "×" marks a row
// read for this viewer, until that session asks again or finishes another
// turn; "resume" copies the command that reopens the session. The rows sit
// above whatever is drawn beneath (a plugin's own band, or the engine's), so
// register this hook before any other band hook of the plugin: the first
// registered is the outermost. With nothing to show, or while a survey holds
// the band, the band is left as the plugins beneath draw it.
import { atom, read, update } from 'claude-code';
import type { On } from 'claude-code';
import type { SessionRecord } from './types';
import { age, isUnread } from './boards';

const MAX_ROWS = 3;
const STALE_MS = 60 * 60 * 1000;

const self = atom({ plugin: 'forge-sdlc', key: 'self' } as const, null as SessionRecord | null);
const boardsSessions = atom({ plugin: 'forge-sdlc', key: 'boardsSessions' } as const, [] as SessionRecord[]);
const inboxSeen = atom({ plugin: 'forge-sdlc', key: 'inboxSeen' } as const, {} as Record<string, number>);

// The rows the band shows: waiting ones oldest first, then finished ones newest first.
export function bandRows(
  sessions: SessionRecord[],
  seen: Record<string, number>,
  me: SessionRecord | null,
  now: number,
) {
  const since = me?.startedAt ?? now;
  const open = sessions.filter((r) => r.id !== me?.id && isUnread(r, seen, since));
  const waiting = open
    .filter((r) => r.status === 'needs-you' && now - r.since <= STALE_MS)
    .sort((a, b) => a.since - b.since);
  const done = open.filter((r) => r.status !== 'needs-you').sort((a, b) => (b.lastTurnAt ?? 0) - (a.lastTurnAt ?? 0));
  return [...waiting, ...done];
}

export function registerBand(on: On) {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e);
    const [sessions, seen, me] = await Promise.all([read($, boardsSessions), read($, inboxSeen), read($, self)]);
    const now = await $.clock.now();
    const rows = bandRows(sessions, seen, me, now);
    if (rows.length === 0) return next(e);
    const below = await next(e); // the band beneath, kept under the rows (a tree as data)
    const { Box, Text, Button } = $.ui.resolve(e);
    return (
      <Box flexDirection="column">
        {rows.slice(0, MAX_ROWS).map((r) => (
          <Box key={`band-${r.id}`}>
            {r.status === 'needs-you' ? (
              <Text color="yellow">
                ● {r.repo} needs you: {r.reason ?? ''} · {age(now - r.since)}
              </Text>
            ) : (
              <Text color="green">
                ● {r.repo} done: {r.lastReply || r.lastPrompt} · {age(now - (r.lastTurnAt ?? now))}
              </Text>
            )}
            <Text> </Text>
            <Button
              key={`band-resume-${r.id}`}
              label="resume"
              plain
              dimColor
              onPress={(press) =>
                void $.ui.copy({
                  text: `cd ${JSON.stringify(r.cwd)} && claude --resume ${r.id}`,
                  surface: press.surface,
                })
              }
            />
            <Text> </Text>
            <Button
              key={`band-dismiss-${r.id}`}
              label="×"
              plain
              dimColor
              onPress={() => void update($, inboxSeen, (s) => ({ ...s, [r.id]: now }))}
            />
          </Box>
        ))}
        {rows.length > MAX_ROWS && <Text dimColor>+{rows.length - MAX_ROWS} more in /boards</Text>}
        {(below ?? null) as never}
      </Box>
    );
  });
}
