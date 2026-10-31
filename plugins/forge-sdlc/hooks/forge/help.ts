// The /forge panel's tables and the reading of a skill's frontmatter. Pure:
// forge.tsx lists and reads the SKILL.md files and calls `$`; this module only
// decides what a row says and where it goes. No imports, so the node tests
// load it with its types stripped (tests/forge-help.test.mjs).

export const PLUGIN = 'forge-sdlc';
export const UPSTREAM = 'mattpocock-skills';

export type Skill = { name: string; description: string; hint?: string };
export type Row = { command: string; hint?: string; description: string };
export type Group = { title: string; rows: Row[] };

// The plugin's skills a driver types, in the loop's order. tests/forge-help
// fails when a skill is in no group and not hidden, so a new one is placed.
// `mods` marks the one group the mod's own commands (MOD_COMMANDS) join.
export const GROUPS: { title: string; skills: string[]; mods?: true }[] = [
  { title: 'Loop', skills: ['wayfinder', 'spec', 'plan', 'build'] },
  { title: 'Setup', skills: ['init'] },
  { title: 'Tools', skills: ['help', 'status', 'intent', 'slice-review'], mods: true },
];

// Skills run by agents only, or an alias kept one version: none today.
export const HIDDEN: string[] = [];

// The commands the mod registers itself (run-pane.tsx, forge.tsx, run-band.tsx
// and the workbench views: focus.tsx, boards.tsx, commands.tsx), after the
// skills of the `mods` group. tests/forge-help fails when a command the mod
// registers is missing here. Panels first, then the actions.
export const MOD_COMMANDS: Row[] = [
  {
    command: '/forge',
    hint: '[loop | agents | close]',
    description: 'This panel: the commands, the agents, and how the loop runs.',
  },
  {
    command: '/forge-pane',
    hint: '[history | export | close]',
    description: 'Context, cost, running agents and the frontier of the newest effort map.',
  },
  {
    command: '/focus-pane',
    description: 'This session at a glance: branch, ticket, MR with its merge checklist, usage, files.',
  },
  {
    command: '/boards',
    description: 'Every running Claude session: board, lanes, inbox, crew.',
  },
  {
    command: '/diff-pane',
    hint: '[branch | working | staged | <ref>]',
    description: 'A diff in a pane: the branch against the default branch, the working tree, the index, or any ref.',
  },
  {
    command: '/side-chat',
    hint: '<question>',
    description: 'A side question over this session, answered in a pane and never added to the conversation.',
  },
  {
    command: '/morning',
    description: "Every running session's MR checked: failed pipeline, conflicts, open threads.",
  },
  {
    command: '/crew',
    hint: '<agent type> <task>',
    description: 'Start a named background agent.',
  },
  {
    command: '/handoff-new',
    hint: '[focus]',
    description: 'Write a handoff of this conversation, then start a new one drafted to read it (the H button).',
  },
];

// The loop, stage by stage: what runs, and where the driver is needed (`you`).
export const LOOP: { stage: string; text: string; you?: string }[] = [
  {
    stage: 'Setup',
    text: 'once per host: /mattpocock-skills:setup-matt-pocock-skills, then /forge-sdlc:init derives the proof commands and branches from the repo and writes docs/agents/forge.md',
    you: 'answer what the repo cannot tell: the tracker, the gate policy, the risk paths, the crew theme',
  },
  {
    stage: 'Plan',
    text: '/forge-sdlc:wayfinder <idea | #issue | slug> charts a map on feat/<slug>, works its tickets (researcher, prototyper), writes intent.md and opens the draft PR',
    you: 'Gate 1: accept intent.md, or the policy does when no open: line remains; /forge-sdlc:wayfinder <slug> resumes a stopped effort at its next stage',
  },
  {
    stage: 'Design',
    text: '/forge-sdlc:spec <slug>: the spec-writer synthesises spec.md under the policy skills, committed on feat/<slug> and linked from the PR',
    you: 'Gate 2: approve spec.md, or the policy does when nothing is open or flagged; the tech lead too when risk: high',
  },
  {
    stage: 'Build',
    text: '/forge-sdlc:plan <slug> breaks the spec into tracer-bullet slices and publishes the tickets; /forge-sdlc:build <slug> runs unattended: one worktree and implementer per slice, test-first, the verifier, the three-axis review, merged --no-ff into feat/<slug> when clean, red after two fix rounds',
    you: "Gate 3: answer plan's quiz and approve the breakdown, or the policy answers it under autonomous",
  },
  {
    stage: 'Deploy',
    text: 'build marks the PR ready with the evidence and the red slices; only feat/<slug> is ever pushed',
    you: 'Gate 4: the code owner reviews the PR and merges it; always yours, whatever the policy',
  },
];
export const GATES =
  'Gates 1 to 3 pass by the gate policy under ## Gates in forge.md: attended, the default, stops at each one for you; autonomous passes a gate with no open: line, no flagged concern and normal risk. Gate 4 is always the code owner’s.';

// A SKILL.md's frontmatter to its name, the first sentence of its description
// and its argument hint; null when the file has no frontmatter or no name.
export function parseSkill(text: string): Skill | null {
  const head = text.match(/^---\n([\s\S]*?)\n---/)?.[1];
  if (!head) return null;
  const field = (key: string) => head.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'))?.[1]?.trim();
  const name = field('name');
  if (!name) return null;
  const description = (field('description') ?? '').replace(/^["']|["']$/g, '');
  const first = description.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? description;
  const hint = field('argument-hint')?.replace(/^["']|["']$/g, '');
  return { name, description: first, ...(hint ? { hint } : {}) };
}

// An agent file's frontmatter to its name, the first sentence of its
// description, and the model and effort it runs at; null without a name.
export type Agent = Skill & { model?: string; effort?: string };
export function parseAgent(text: string): Agent | null {
  const skill = parseSkill(text);
  if (!skill) return null;
  const head = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  const field = (key: string) => head.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'))?.[1]?.trim();
  const [model, effort] = [field('model'), field('effort')];
  return {
    name: skill.name,
    description: skill.description,
    ...(model ? { model } : {}),
    ...(effort ? { effort } : {}),
  };
}

// The plugin's agents as the panel lists them, by name: the subagent type an
// Agent call names (forge-sdlc:<name>), and its model and effort as the hint.
export const agentRows = (agents: Agent[]): Row[] =>
  [...agents]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((a) => {
      const hint = [a.model, a.effort].filter(Boolean).join(' · ');
      return { command: `${PLUGIN}:${a.name}`, ...(hint ? { hint } : {}), description: a.description };
    });

const row = (plugin: string, s: Skill): Row => ({
  command: `/${plugin}:${s.name}`,
  ...(s.hint ? { hint: s.hint } : {}),
  description: s.description,
});

// The plugin's skills into the groups, in each group's order; the mod's own
// commands in the `mods` group; a skill no group names (and not hidden) under Other.
export function commandGroups(skills: Skill[]): Group[] {
  const byName = new Map(skills.map((s) => [s.name, s]));
  const groups: Group[] = GROUPS.map((g) => ({
    title: g.title,
    rows: [
      ...g.skills.flatMap((n) => (byName.has(n) ? [row(PLUGIN, byName.get(n)!)] : [])),
      ...(g.mods ? MOD_COMMANDS : []),
    ],
  }));
  const placed = new Set([...GROUPS.flatMap((g) => g.skills), ...HIDDEN]);
  const other = skills.filter((s) => !placed.has(s.name)).sort((a, b) => a.name.localeCompare(b.name));
  if (other.length) groups.push({ title: 'Other', rows: other.map((s) => row(PLUGIN, s)) });
  return groups.filter((g) => g.rows.length > 0);
}

// mattpocock-skills' commands, by name.
export const upstreamGroup = (skills: Skill[]): Group => ({
  title: UPSTREAM,
  rows: [...skills].sort((a, b) => a.name.localeCompare(b.name)).map((s) => row(UPSTREAM, s)),
});

// Version directories newest first (`1.10.0` before `1.9.2`).
export const newestVersionFirst = (versions: string[]): string[] =>
  [...versions].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
