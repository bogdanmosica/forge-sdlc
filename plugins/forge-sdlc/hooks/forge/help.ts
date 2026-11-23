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
    description: 'The run pane: context, cost, the agents by crew name and the frontier of the newest effort map.',
  },
  {
    command: '/focus-pane',
    description: 'This session at a glance: branch, ticket, MR with its merge checklist, usage, files.',
  },
  {
    command: '/boards',
    description: 'Every running Claude session: board, lanes, inbox, and the crew of a `cmux claude-teams` lead.',
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
    stage: 'Watch',
    text: 'start the host session with `cmux claude-teams` and every agent the loop spawns opens in its own cmux pane (the Crew panel, /boards Crew tab); a plain `claude` runs them as named subagents, listed in /forge-pane and the band',
    you: 'run /forge-pane to see the run (it opens by itself on /forge-sdlc:wayfinder and /forge-sdlc:build from 144 columns); hover a band figure for what it counts',
  },
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

// The host roster as the panel reads it (docs/agents/forge.yaml through the
// shared reader, hooks/roster.mjs): each role's resolved agent, model and effort.
export type PanelRole = { agent: string; model?: string; effort?: string; swapped: boolean };
export type PanelRoster = { roles: Record<string, PanelRole>; slots: Record<string, string>; policy: string[] };

// The plugin's agents as the panel lists them, by name: the subagent type an
// Agent call names (forge-sdlc:<name>), and its model and effort as the hint.
// With a roster, a role filled by another agent shows it first (`⇄ <agent>`),
// and the roster's model and effort replace the frontmatter's where it sets them.
// A swapped role shows only the roster's own model and effort: the default
// agent's frontmatter is not the agent that runs, and the swapped-in one's is unknown.
export const agentRows = (agents: Agent[], roster?: PanelRoster): Row[] =>
  [...agents]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((a) => {
      const role = roster && Object.hasOwn(roster.roles, a.name) ? roster.roles[a.name] : undefined;
      const fallback: Partial<Agent> = role?.swapped ? {} : a;
      const swap = role?.swapped ? `⇄ ${role.agent}` : undefined;
      const hint = [swap, role?.model ?? fallback.model, role?.effort ?? fallback.effort].filter(Boolean).join(' · ');
      return { command: `${PLUGIN}:${a.name}`, ...(hint ? { hint } : {}), description: a.description };
    });

// The roster's slots as the panel's table, in the reader's order, each a line:
// the slot, padded to the longest, and its skill or `disabled`; `policy` last,
// its skills comma-separated or `none`.
export function slotLines(roster: PanelRoster): string[] {
  const rows: [string, string][] = [
    ...Object.entries(roster.slots),
    ['policy', roster.policy.length ? roster.policy.join(', ') : 'none'],
  ];
  const width = Math.max(...rows.map(([slot]) => slot.length));
  return rows.map(([slot, skill]) => `${slot.padEnd(width)}  ${skill}`);
}

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

// The loop as the /forge loop tab draws it (terminal B), from the resolved
// workflow (hooks/roster.mjs resolveWorkflow) and the panel's width: rows of
// text, each as wide as the panel, and the tone the panel paints it in. From
// LOOP_BOXES columns passed stages fold to one line with their gate at the
// right, and the current stage and those ahead are boxes with their gate in
// the bottom border; below it, one line per stage, down to LOOP_FLOOR.
// The shapes here are the reader's, written out: this module has no imports.
export type LoopTone = 'title' | 'legend' | 'plain' | 'passed' | 'current' | 'ahead' | 'stopped' | 'swapped' | 'note';
export type LoopRow = { text: string; tone: LoopTone };
export type LoopGate = {
  key: string;
  n: number;
  artifact: string;
  stops: string[];
  mode: string;
  source: string;
  status?: 'passed' | 'waiting' | 'stopped' | 'ahead';
};
export type LoopStage = {
  name: string;
  does: string;
  command?: string;
  roles: { role: string; agent: string; model?: string; effort?: string; swapped: boolean }[];
  slots: { slot: string; skill: string }[];
  status?: 'passed' | 'current' | 'ahead';
  gate?: LoopGate;
};
export type LoopWorkflow = {
  stages: LoopStage[];
  policy: string;
  maxParallelSlices: number;
  effort: { slug: string; stage: string; gate: string; stop: string; risk: string } | null;
};
export const LOOP_BOXES = 52;
export const LOOP_FLOOR = 24;
export const LOOP_LEGEND = ['▶ here', '✓ passed', '■ stopped', '○ ahead', '⇄ swapped in forge.yaml'];

// Cut to w with an ellipsis, or padded to w.
const cut = (s: string, w: number): string => (s.length > w ? `${s.slice(0, Math.max(0, w - 1))}…` : s);
const fit = (s: string, w: number): string => cut(s, w).padEnd(w);

export function loopRows(workflow: LoopWorkflow, columns: number): LoopRow[] {
  const W = Math.max(LOOP_FLOOR, Math.floor(columns));
  return W >= LOOP_BOXES ? boxes(workflow, W) : lines(workflow, W);
}

const GATE_GLYPH = { passed: '✓', waiting: '▶', stopped: '■', ahead: '○' } as const;

// A gate's text in its stage's bottom border.
function gateText(g: LoopGate, stop: string): string {
  const glyph = GATE_GLYPH[g.status ?? 'ahead'];
  if (g.status === 'passed')
    return `${glyph} Gate ${g.n} · passed by ${g.mode === 'policy' ? 'policy' : g.mode === 'owner' ? 'the code owner' : 'you'}`;
  if (g.status === 'stopped') return `${glyph} Gate ${g.n} · ${g.mode} · STOPPED: ${stop}`;
  if (g.status === 'waiting') return `${glyph} Gate ${g.n} · ${g.mode} · waiting`;
  if (g.mode === 'policy') return `${glyph} Gate ${g.n} · policy · stops on ${g.stops.filter((s) => s !== 'attended').join(' · ')}`;
  return `${glyph} Gate ${g.n} · ${g.mode} · always stops`;
}

function boxes(wf: LoopWorkflow, W: number): LoopRow[] {
  const out: LoopRow[] = [];
  const push = (text: string, tone: LoopTone) => out.push({ text: fit(text, W), tone });
  const effort = wf.effort;
  const title = effort
    ? `${effort.slug} · policy ${wf.policy} · risk ${effort.risk} · ≤${wf.maxParallelSlices} slices`
    : `the loop · policy ${wf.policy} · ≤${wf.maxParallelSlices} slices`;
  push(title, 'title');
  for (const line of legendLines(W)) push(line, 'legend');
  const inner = W - 4;
  wf.stages.forEach((s, i) => {
    if (s.status === 'passed') {
      const who = s.roles.length ? s.roles.map((r) => r.role + (r.swapped ? ' ⇄' : '')).join(' · ') : 'lead';
      const right = s.gate ? `Gate ${s.gate.n} ✓ ${s.gate.mode}` : '';
      const left = `${fit(`✓ ${s.name}`, 10)}${who}`;
      push(right ? `${fit(left, W - right.length - 1)} ${right}` : left, 'passed');
      return;
    }
    const tone: LoopTone = s.status === 'current' ? 'current' : s.status === 'ahead' ? 'ahead' : 'plain';
    if (!s.gate && i === wf.stages.length - 1) {
      push(`  ▼ ${s.status === 'current' ? '▶ ' : ''}${s.name}  ${s.does}`, tone);
      return;
    }
    const tag = s.status === 'current' ? ' ▶ here ' : '';
    const name = fit(` ${s.name} `, Math.min(s.name.length + 2, W - 4 - tag.length)).trimEnd() + ' ';
    out.push({ text: `╭─${name}${'─'.repeat(W - 3 - name.length - tag.length)}${tag}╮`, tone });
    const row = (text: string, t: LoopTone = tone) => out.push({ text: `│ ${fit(text, inner)} │`, tone: t });
    row(s.does);
    const roleW = 12;
    const modelW = 16;
    const models = s.roles.map((r) => [r.model, r.effort].filter(Boolean).join(' · '));
    const agentW = inner - roleW - 1 - (models.some(Boolean) ? modelW + 1 : 0);
    if (!s.roles.length) row(`${fit('lead', roleW)} ${s.command ?? ''}`);
    s.roles.forEach((r, k) => {
      const agent = fit((r.swapped ? '⇄ ' : '') + r.agent, agentW);
      row(`${fit(r.role, roleW)} ${agent}${models.some(Boolean) ? ` ${models[k]}` : ''}`, r.swapped ? 'swapped' : tone);
    });
    const skills = s.slots.map((k) => k.skill.slice(k.skill.lastIndexOf(':') + 1)).filter((k) => k && k !== 'none');
    if (skills.length) row(`skills  ${skills.join(' · ')}`);
    if (!s.gate) {
      out.push({ text: `╰${'─'.repeat(W - 2)}╯`, tone });
      return;
    }
    const g = s.gate;
    const gt = ` ${cut(gateText(g, effort?.stop ?? 'none'), W - 6)} `;
    out.push({ text: `╰─${gt}${'─'.repeat(W - 3 - gt.length)}╯`, tone: g.status === 'stopped' ? 'stopped' : tone });
    if (g.status === 'stopped' && effort) for (const line of stopLines(g, effort)) push(`  ${line}`, 'note');
  });
  return out;
}

// What a stopped gate adds under it: why, from the stop reason (only
// `attended` names where its setting came from), and the command that resumes.
function stopLines(g: LoopGate, effort: NonNullable<LoopWorkflow['effort']>): string[] {
  const why: Record<string, string> = {
    open: `an open: line in ${g.artifact}`,
    flagged: `a flagged concern in ${g.artifact}`,
    'risk-high': 'risk: high, every gate attended',
    attended: `attended by ${g.source}`,
  };
  return [`why: ${why[effort.stop] ?? effort.stop}`, `resume: /forge-sdlc:wayfinder ${effort.slug}`];
}

// The legend, its entries kept whole, as many to a line as the width holds.
function legendLines(W: number): string[] {
  const out: string[] = [];
  for (const item of LOOP_LEGEND) {
    const last = out.length - 1;
    if (last >= 0 && out[last].length + 2 + item.length <= W) out[last] += `  ${item}`;
    else out.push(item);
  }
  return out;
}

function lines(wf: LoopWorkflow, W: number): LoopRow[] {
  const out: LoopRow[] = [];
  const push = (text: string, tone: LoopTone) => out.push({ text: fit(text, W), tone });
  push(wf.effort?.slug || 'the loop', 'title');
  push(`policy ${wf.policy}`, 'legend');
  const STAGE_GLYPH = { passed: '✓', current: '▶', ahead: '○' } as const;
  for (const s of wf.stages) {
    const swap = s.roles.some((r) => r.swapped) ? ' ⇄' : '';
    push(`${STAGE_GLYPH[s.status ?? 'ahead']} ${s.name}${swap}`, s.status ?? 'plain');
    const g = s.gate;
    if (!g) continue;
    const status = g.status ?? 'ahead';
    const tone: LoopTone = !g.status ? 'plain' : status === 'waiting' ? 'current' : status;
    push(`${GATE_GLYPH[status]}   G${g.n} ${g.mode}`, tone);
    if (status === 'stopped' && wf.effort) for (const line of stopLines(g, wf.effort)) push(`  ${line}`, 'note');
  }
  return out;
}

// Version directories newest first (`1.10.0` before `1.9.2`).
export const newestVersionFirst = (versions: string[]): string[] =>
  [...versions].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
