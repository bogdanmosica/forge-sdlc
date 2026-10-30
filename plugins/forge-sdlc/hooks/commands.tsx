// The slash commands, mod counterparts of cmux-config's palette scripts:
//
//   /diff-pane [branch|working|staged|<ref>]  the diff in a pane (review-diff.sh's
//        viewer): `branch` against the merge base with the remote default
//        branch, working tree included (the default off main); `working`
//        against HEAD (the default on main); `staged`; or any ref
//   /side-chat <question>  asks over this session's whole context through a
//        fork, answered in a pane and never added to the conversation
//        (side-chat.sh's vault fork)
//   /morning  every live session's MR checked with glab: failed pipeline,
//        conflicts, unresolved threads (morning-routine.sh)
//   /crew <agent type> <task>  starts a named background agent (crew.sh spawn)
//
// Text from git, glab and the model is shown, never run; a ref given to /diff-pane
// must not start with "-", so it cannot pass as a git option.
import { atom, read, update } from 'claude-code';
import type { EngineInterface, On } from 'claude-code';
import type { DiffView, Morning, MorningRow, SessionRecord, SideChat } from './types';
import { readSessions, run } from './sessions';

export const DIFF_PANE = 'workbench-diff';
export const SIDE_PANE = 'workbench-side-chat';
export const MORNING_PANE = 'workbench-morning';
const PATCH_MAX = 200_000;

const self = atom({ plugin: 'forge-sdlc', key: 'self' } as const, null as SessionRecord | null);
const diffView = atom({ plugin: 'forge-sdlc', key: 'diffView' } as const, null as DiffView | null);
const sideChat = atom({ plugin: 'forge-sdlc', key: 'sideChat' } as const, null as SideChat | null);
const morning = atom({ plugin: 'forge-sdlc', key: 'morning' } as const, null as Morning | null);

const COMMANDS = [
  {
    name: 'diff-pane',
    description: 'Show a diff in a pane: branch (default), working, staged or a ref',
    argumentHint: '[branch|working|staged|<ref>]',
  },
  {
    name: 'side-chat',
    description: 'Ask a side question over this session, answered in a pane, not added to the conversation',
    argumentHint: '<question>',
  },
  { name: 'morning', description: "Check every running session's MR: failed pipeline, conflicts, open threads" },
  { name: 'crew', description: 'Start a named background agent', argumentHint: '<agent type> <task>' },
];

// Run by workbench.tsx once this session's record exists.
// A name another plugin holds (cc-plugin-diff took /diff) is refused: the
// others still register and the session starts.
export async function startCommands($: EngineInterface) {
  for (const c of COMMANDS) {
    try {
      await $.command.register(c);
    } catch (error) {
      $.ui.log(`workbench: /${c.name} not registered: ${String(error)}`, { to: 'debug' });
    }
  }
}

// ---- /diff-pane

async function defaultBase($: EngineInterface, cwd: string): Promise<string | undefined> {
  const head = (await run($, ['git', 'symbolic-ref', '-q', '--short', 'refs/remotes/origin/HEAD'], cwd))?.trim();
  if (head) return head;
  for (const b of ['origin/main', 'origin/master'])
    if (await run($, ['git', 'rev-parse', '-q', '--verify', b], cwd)) return b;
  return undefined;
}

// The diff `mode` names, as git's stat and patch.
export async function diffFor(
  $: EngineInterface,
  cwd: string,
  branch: string | undefined,
  mode: string,
): Promise<DiffView> {
  const onMain = !branch || branch === 'main' || branch === 'master';
  const chosen = mode || (onMain ? 'working' : 'branch');
  let against: string[];
  let title: string;
  if (chosen === 'working') {
    against = ['HEAD'];
    title = 'Working tree against HEAD';
  } else if (chosen === 'staged') {
    against = ['--staged'];
    title = 'Staged changes';
  } else if (chosen === 'branch') {
    const base = await defaultBase($, cwd);
    const mergeBase = base ? (await run($, ['git', 'merge-base', base, 'HEAD'], cwd))?.trim() : undefined;
    if (!mergeBase)
      return { title: 'Branch', stat: '', patch: '', isCut: false, error: 'no remote default branch to compare with' };
    against = [mergeBase];
    title = `${branch} against ${base} (working tree included)`;
  } else {
    if (chosen.startsWith('-'))
      return { title: chosen, stat: '', patch: '', isCut: false, error: 'a ref cannot start with "-"' };
    against = [chosen];
    title = `Working tree against ${chosen}`;
  }
  const [stat, patch] = await Promise.all([
    run($, ['git', 'diff', '--stat', ...against], cwd),
    run($, ['git', 'diff', ...against], cwd),
  ]);
  if (patch === undefined)
    return { title, stat: '', patch: '', isCut: false, error: 'git diff failed (not a repository, or an unknown ref)' };
  return { title, stat: stat ?? '', patch: patch.slice(0, PATCH_MAX), isCut: patch.length > PATCH_MAX };
}

// ---- /side-chat

const SIDE_ROWS = 40;
const SIDE_CHARS = 60_000;

// Answers over the session itself: a fork of its last request when the engine
// has one to reuse (the full context, served from the prompt cache), else one
// completion over the conversation's last SIDE_ROWS rows. Neither touches the
// conversation.
export async function askAside($: EngineInterface, question: string): Promise<{ answer?: string; error?: string }> {
  const fork = await $.model.fork({ prompt: question });
  if (fork.isAnswered) return { answer: fork.text };
  if (fork.reason !== 'nothing-to-fork') return { error: `no reply (${fork.reason})` };
  const rows = (await $.session.messages()).slice(-SIDE_ROWS);
  const transcript = rows
    .map((m) => `${m.role}: ${m.text}`)
    .join('\n\n')
    .slice(-SIDE_CHARS);
  const reply = await $.model.complete({
    model: await $.session.model(),
    system: 'Answer a side question about the conversation below. Be brief. Do not continue the conversation.',
    prompt: `<conversation>\n${transcript}\n</conversation>\n\nSide question: ${question}`,
  });
  return reply.isAnswered ? { answer: reply.text } : { error: `no reply (${reply.reason})` };
}

// ---- /morning

type GlabMr = {
  iid?: number;
  web_url?: string;
  has_conflicts?: boolean;
  blocking_discussions_resolved?: boolean;
  head_pipeline?: { status?: string } | null;
};

export function mrIssues(mr: GlabMr): string[] {
  const issues: string[] = [];
  if (mr.head_pipeline?.status === 'failed') issues.push('pipeline failed');
  if (mr.has_conflicts) issues.push('conflicts');
  if (mr.blocking_discussions_resolved === false) issues.push('threads open');
  return issues;
}

async function checkMorning($: EngineInterface) {
  const sessions = await readSessions($);
  const seen = new Set<string>();
  const rows: MorningRow[] = [];
  let unreachable = 0;
  for (const r of sessions) {
    if (!r.branch || r.branch === 'main' || r.branch === 'master' || seen.has(`${r.cwd}\n${r.branch}`)) continue;
    seen.add(`${r.cwd}\n${r.branch}`);
    const out = await run($, ['glab', 'mr', 'view', r.branch, '--output', 'json'], r.cwd);
    if (out === undefined) {
      unreachable += 1; // no MR for the branch, not a GitLab repo, or no VPN
      continue;
    }
    try {
      const mr = JSON.parse(out) as GlabMr;
      rows.push({ repo: r.repo, branch: r.branch, iid: mr.iid, url: mr.web_url, issues: mrIssues(mr) });
    } catch {
      unreachable += 1;
    }
  }
  const checkedAt = await $.clock.now();
  await update($, morning, () => ({ checkedAt, rows, unreachable, isChecking: false }));
}

export function registerCommands(on: On) {
  on('command.run', { command: 'diff-pane' }, async ($, e) => {
    const r = await read($, self);
    if (!r) return { text: 'No session yet.' };
    const view = await diffFor($, r.cwd, r.branch, e.args.trim());
    await update($, diffView, () => view);
    await $.ui.open({ id: DIFF_PANE, title: 'Diff' });
    return { text: view.error ? `Diff: ${view.error}.` : `Diff opened: ${view.title}.` };
  });

  on('command.run', { command: 'side-chat' }, async ($, e) => {
    const question = e.args.trim();
    if (!question) return { text: 'Usage: /side-chat <question>' };
    await update($, sideChat, () => ({ question, isAsking: true }));
    await $.ui.open({ id: SIDE_PANE, title: 'Side chat' });
    const answer = await askAside($, question);
    await update($, sideChat, () => ({ question, ...answer, isAsking: false }));
    return {
      text: answer.answer
        ? 'Side chat answered in its pane; nothing was added to this conversation.'
        : `Side chat: ${answer.error}.`,
    };
  });

  on('command.run', { command: 'morning' }, async ($) => {
    await update($, morning, (m) => ({
      checkedAt: m?.checkedAt ?? 0,
      rows: m?.rows ?? [],
      unreachable: 0,
      isChecking: true,
    }));
    await $.ui.open({ id: MORNING_PANE, title: 'Morning' });
    await checkMorning($);
    const m = await read($, morning);
    const attention = m?.rows.filter((row) => row.issues.length > 0).length ?? 0;
    return { text: `Morning check: ${attention} MR${attention === 1 ? '' : 's'} need attention.` };
  });

  on('command.run', { command: 'crew' }, async ($, e) => {
    const [role = '', ...words] = e.args.trim().split(/\s+/);
    const task = words.join(' ');
    if (!role || !task) return { text: 'Usage: /crew <agent type> <task>' };
    const started = await $.agent.spawn({
      prompt: task,
      description: task.slice(0, 60),
      subagentType: role,
      name: role.split(':').at(-1),
    });
    return {
      text: 'deny' in started && started.deny ? `Crew: ${String(started.deny)}` : `Started ${role} in the background.`,
    };
  });

  on('ui.render', { component: 'Pane', requestId: DIFF_PANE }, async ($, e) => {
    const { Box, Text, Code } = $.ui.resolve(e);
    const view = await read($, diffView);
    if (!view) return <Text dimColor>Run /diff-pane.</Text>;
    return (
      <Box flexDirection="column">
        <Text bold>{view.title}</Text>
        {view.error && <Text color="red">{view.error}</Text>}
        {!view.error && view.patch === '' && <Text dimColor>No changes.</Text>}
        {view.stat && <Text dimColor>{view.stat.trimEnd()}</Text>}
        {view.patch && <Code source={view.patch} format="diff" />}
        {view.isCut && <Text dimColor>The patch is cut at {PATCH_MAX} characters.</Text>}
      </Box>
    );
  });

  on('ui.render', { component: 'Pane', requestId: SIDE_PANE }, async ($, e) => {
    const { Box, Text, Markdown } = $.ui.resolve(e);
    const chat = await read($, sideChat);
    if (!chat) return <Text dimColor>Run /side-chat &lt;question&gt;.</Text>;
    return (
      <Box flexDirection="column">
        <Text bold>› {chat.question}</Text>
        {chat.isAsking && <Text dimColor>Asking…</Text>}
        {chat.error && <Text color="red">{chat.error}</Text>}
        {chat.answer && <Markdown text={chat.answer} />}
      </Box>
    );
  });

  on('ui.render', { component: 'Pane', requestId: MORNING_PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e);
    const m = await read($, morning);
    if (!m) return <Text dimColor>Run /morning.</Text>;
    const attention = m.rows.filter((row) => row.issues.length > 0);
    return (
      <Box flexDirection="column">
        {m.isChecking && <Text dimColor>Checking…</Text>}
        {!m.isChecking && attention.length === 0 && <Text color="green">All clear: no MR needs attention.</Text>}
        {attention.map((row) => (
          <Box key={`morning-${row.repo}-${row.branch}`} flexDirection="column">
            <Box>
              <Text bold>{row.repo}</Text>
              <Text dimColor> ⎇ {row.branch} </Text>
              <Text>!{row.iid ?? '?'} </Text>
              <Text color="red">{row.issues.join(' · ')}</Text>
            </Box>
            {row.url && <Text dimColor> {row.url}</Text>}
          </Box>
        ))}
        {m.rows.length > attention.length && (
          <Text dimColor>
            {m.rows.length - attention.length} other MR{m.rows.length - attention.length === 1 ? '' : 's'} fine
          </Text>
        )}
        {m.unreachable > 0 && <Text dimColor>{m.unreachable} branch(es) without an MR or out of reach (VPN?)</Text>}
      </Box>
    );
  });
}
