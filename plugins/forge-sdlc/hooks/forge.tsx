// The /forge panel: the plugin's commands, read from each skill's own SKILL.md
// when the panel opens (so a new or edited skill shows with nothing else to
// change), and how the loop runs with where the driver is needed. A plugin
// has one hooks module with one unmatched hook per event, so run-pane.tsx
// registers the command (FORGE_COMMAND) in its session.start and calls
// `registerForge(on)` for the matched hooks; the tables live in forge/help.ts.
//
// `/forge` opens on the commands, `/forge agents` on the plugin's agents (read
// from agents/*.md), `/forge loop` on the loop; `/forge-sdlc:help` opens it on
// the commands. Buttons with hotkeys: c commands, a agents, l loop, m
// mattpocock-skills' commands, x close. Draws on the terminal and the desktop
// app.
//
// mattpocock-skills, the plugin's dependency, lives in another marketplace's
// cache (claude-plugins-official/mattpocock-skills/<version>/) and keeps its
// skills one folder down, by category (skills/<category>/<name>/SKILL.md).
import { atom, read, update } from 'claude-code';
import type { CommandSpec, EngineInterface, On } from 'claude-code';
import type { ForgeSkills, ForgeView } from './types';
import {
  GATES,
  LOOP,
  UPSTREAM,
  agentRows,
  commandGroups,
  newestVersionFirst,
  parseAgent,
  parseSkill,
  upstreamGroup,
} from './forge/help';
import type { Agent, Group, Skill } from './forge/help';

const PANE = 'forge';
const USAGE =
  "Usage: /forge [loop | agents | close]. No argument opens the panel on the commands; agents on the plugin's agents; loop on how the loop runs and where you are needed; close closes it.";
const OFFICIAL = 'claude-plugins-official';

const view = atom({ plugin: 'forge-sdlc', key: 'forgeView' } as const, { tab: 'commands', upstream: false } as ForgeView);
const skills = atom(
  { plugin: 'forge-sdlc', key: 'forgeSkills' } as const,
  { plugin: [], upstream: [], agents: [] } as ForgeSkills,
);

const parentOf = (path: string) => path.replace(/\/[^/]+\/?$/, '');

// The folder names under `dir`; none when it cannot be listed.
async function namesIn($: EngineInterface, dir: string): Promise<string[]> {
  try {
    return (await $.fs.list(dir)).map((e) => e.name);
  } catch {
    return [];
  }
}

// The skills in `dir`, each from `<dir>/<name>/SKILL.md`; an unreadable one is left out.
async function skillsUnder($: EngineInterface, dir: string): Promise<Skill[]> {
  const parsed = await Promise.all(
    (await namesIn($, dir)).map(async (n) => {
      try {
        return parseSkill(await $.fs.read(`${dir}/${n}/SKILL.md`));
      } catch {
        return null;
      }
    }),
  );
  return parsed.filter((s): s is Skill => s !== null);
}

// The plugin's skills, `dir/skills/<name>/SKILL.md`.
const skillsIn = ($: EngineInterface, dir: string) => skillsUnder($, `${dir}/skills`);

// An upstream release's skills, one folder down by category:
// `dir/skills/<category>/<name>/SKILL.md`. A category's README is left out.
async function categorisedSkillsIn($: EngineInterface, dir: string): Promise<Skill[]> {
  const categories = await namesIn($, `${dir}/skills`);
  const found = await Promise.all(categories.map((c) => skillsUnder($, `${dir}/skills/${c}`)));
  return found.flat();
}

// mattpocock-skills from the install cache: the official marketplace beside
// this plugin's (cache/<marketplace>/<plugin>/<version>/), else under the
// home's cache when the plugin runs from a checkout; the newest version with skills.
async function upstreamSkills($: EngineInterface): Promise<Skill[]> {
  const beside = `${parentOf(parentOf(parentOf($.plugin.root)))}/${OFFICIAL}/${UPSTREAM}`;
  let home: string | undefined;
  try {
    home = (await $.env.get('HOME')) ?? undefined;
  } catch {
    home = undefined;
  }
  const candidates = [beside, ...(home ? [`${home.replace(/\/+$/, '')}/.claude/plugins/cache/${OFFICIAL}/${UPSTREAM}`] : [])];
  for (const cached of candidates) {
    for (const v of newestVersionFirst(await namesIn($, cached))) {
      const found = await categorisedSkillsIn($, `${cached}/${v}`);
      if (found.length) return found;
    }
  }
  return [];
}

// The plugin's agents, each from its agents/<name>.md; an unreadable one is left out.
async function agentsIn($: EngineInterface, dir: string): Promise<Agent[]> {
  const names = (await namesIn($, `${dir}/agents`)).filter((n) => n.endsWith('.md'));
  const parsed = await Promise.all(
    names.map(async (n) => {
      try {
        return parseAgent(await $.fs.read(`${dir}/agents/${n}`));
      } catch {
        return null;
      }
    }),
  );
  return parsed.filter((a): a is Agent => a !== null);
}

async function loadSkills($: EngineInterface): Promise<void> {
  const [plugin, upstream, agents] = await Promise.all([
    skillsIn($, $.plugin.root),
    upstreamSkills($),
    agentsIn($, $.plugin.root),
  ]);
  await update($, skills, () => ({ plugin, upstream, agents }));
}

// Opens the panel on a tab, the skills and agents read afresh.
async function openOn($: EngineInterface, tab: ForgeView['tab']) {
  await loadSkills($);
  await update($, view, (cur) => ({ ...cur, tab }));
  // Esc closes it while it has the focus, as x does; /forge close from the prompt.
  return $.ui.open({ id: PANE, title: 'forge', focus: true, columns: 72, closeOnEscape: true });
}

export const FORGE_COMMAND: CommandSpec = {
  name: 'forge',
  description:
    "Open the forge panel: the plugin's commands, its agents, and how the loop runs and where you are needed. `agents` or `loop` opens it there",
  argumentHint: '[loop | agents | close]',
  immediate: true,
};

export function registerForge(on: On): void {
  on('command.run', { command: 'forge' }, async ($, e) => {
    const arg = e.args.trim().split(/\s+/)[0] ?? '';
    if (arg === 'close') {
      await $.ui.close({ id: PANE });
      return { text: 'forge panel closed.' };
    }
    if (arg !== '' && arg !== 'loop' && arg !== 'agents') return { text: USAGE };
    const opened = await openOn($, arg === '' ? 'commands' : arg);
    return { text: opened.isPlaced ? 'forge panel opened.' : `forge panel waits: ${opened.reason}` };
  });

  // /forge-sdlc:help: a skill, so it carries the plugin's name; the panel is
  // the help, so the model is only asked to point at it. A skill's prompt
  // always reaches the model: this rewrites what it reads.
  // The text is returned, not handed to next: the engine computes the skill's
  // own prompt there. A panel that cannot open still leaves the line.
  on('skill.prompt', { skill: /^(forge-sdlc:)?help$/ }, async ($) => {
    let where =
      'The forge panel did not open; /forge opens it: the commands (c), the agents (a) and how the loop runs (l).';
    try {
      const opened = await openOn($, 'commands');
      where = opened.isPlaced
        ? 'The forge panel is open: the commands (c), the agents (a) and how the loop runs (l), x closes it.'
        : `The forge panel waits (${opened.reason}); /forge opens it.`;
    } catch {
      /* the line above stands */
    }
    return {
      text: `${where} Reply with that one line and nothing more: do not list the commands or agents, the panel does.`,
    };
  });

  on('ui.render', { component: 'Pane', requestId: PANE, surface: ['terminal', 'desktop'] }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e);
    const v = await read($, view);
    const s = await read($, skills);
    const cols = Math.max(24, e.props.bodyColumns);
    const groups: Group[] = [
      ...commandGroups(s.plugin),
      ...(v.upstream && s.upstream.length ? [upstreamGroup(s.upstream)] : []),
    ];
    const toggle = (tab: ForgeView['tab']) => {
      void update($, view, (cur) => ({ ...cur, tab }));
    };
    return (
      <Box flexDirection="column" width={cols}>
        {v.tab === 'commands' && (
          <Box key="commands" flexDirection="column">
            {s.plugin.length === 0 && <Text dimColor>no skills found under the plugin's skills folder</Text>}
            {groups.map((g) => (
              <Box key={`group-${g.title}`} flexDirection="column" marginBottom={1}>
                <Text bold underline>
                  {g.title}
                </Text>
                {g.rows.map((r) => (
                  <Box key={r.command} flexDirection="column">
                    <Text wrap="truncate-end">{r.hint ? `${r.command} ${r.hint}` : r.command}</Text>
                    <Text dimColor wrap="truncate-end">{`  ${r.description}`}</Text>
                  </Box>
                ))}
              </Box>
            ))}
          </Box>
        )}
        {v.tab === 'agents' && (
          <Box key="agents" flexDirection="column">
            {s.agents.length === 0 && <Text dimColor>no agents found under the plugin's agents folder</Text>}
            {agentRows(s.agents).map((r) => (
              <Box key={r.command} flexDirection="column" marginBottom={1}>
                <Box key="name" flexDirection="row">
                  <Text bold wrap="truncate-end">
                    {r.command}
                  </Text>
                  {r.hint ? <Text dimColor wrap="truncate-end">{`  ${r.hint}`}</Text> : null}
                </Box>
                <Text dimColor wrap="truncate-end">{`  ${r.description}`}</Text>
              </Box>
            ))}
          </Box>
        )}
        {v.tab === 'loop' && (
          <Box key="loop" flexDirection="column">
            {LOOP.map((stage) => (
              <Box key={stage.stage} flexDirection="column" marginBottom={1}>
                <Text bold>{stage.stage}</Text>
                <Text wrap="wrap">{`  ${stage.text}`}</Text>
                {stage.you && <Text color="yellow" wrap="wrap">{`  you: ${stage.you}`}</Text>}
              </Box>
            ))}
            <Box key="gates">
              <Text bold wrap="wrap">
                {GATES}
              </Text>
            </Box>
          </Box>
        )}
        <Box key="actions" flexDirection="row" gap={2} marginTop={1}>
          <Button key="commands-tab" label="commands" hotkey="c" onPress={() => toggle('commands')} />
          <Button key="agents-tab" label="agents" hotkey="a" onPress={() => toggle('agents')} />
          <Button key="loop-tab" label="loop" hotkey="l" onPress={() => toggle('loop')} />
          {v.tab === 'commands' && s.upstream.length > 0 && (
            <Button
              key="upstream"
              label={v.upstream ? `hide ${UPSTREAM}` : `${UPSTREAM} (${s.upstream.length})`}
              hotkey="m"
              onPress={() => {
                void update($, view, (cur) => ({ ...cur, upstream: !cur.upstream }));
              }}
            />
          )}
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
}
