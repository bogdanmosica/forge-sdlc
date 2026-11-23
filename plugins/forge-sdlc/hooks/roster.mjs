// The roster reader: docs/agents/forge.yaml, the host's roster, read as a strict
// YAML subset and resolved over the defaults and forge.md's deprecated
// `## Routing` and `## Policy skills`. Shared by the hooks (lib.mjs), the bin
// scripts, the guard and the run pane mod, so there is one reading and no
// mirror. Pure, no imports and no Node API, so a mod and node both load it as
// it is; it never throws. Types for the mod's TypeScript: roster.d.mts.

/** @typedef {'low' | 'medium' | 'high' | 'xhigh' | 'max'} Effort */
/** @typedef {Record<string, Record<string, string>>} ForgeConfig */
/** @typedef {{ agent: string, model?: string, effort?: Effort, swapped: boolean }} RosterRole */
/**
 * @typedef {{
 *   present: boolean,
 *   version: number | null,
 *   enforce: 'on' | 'off' | 'unreadable',
 *   roles: Record<string, RosterRole>,
 *   slots: Record<string, string>,
 *   policy: string[],
 *   allow: { agents: string[], skills: string[] },
 *   workflow: Workflow,
 *   problems: string[],
 * }} Roster
 */
/** @typedef {'attended' | 'autonomous'} Policy */
/** @typedef {'attended' | 'policy'} GateMode */
/**
 * The host's workflow: knobs, merged with forge.md's deprecated `## Gates`;
 * each knob's source names where it came from (`default` when nowhere).
 * @typedef {{
 *   policy: Policy,
 *   maxParallelSlices: number,
 *   gates: { intent: GateMode, spec: GateMode, plan: GateMode },
 *   sources: { policy: string, maxParallelSlices: string, intent: string, spec: string, plan: string },
 * }} Workflow
 */

export const PLUGIN = 'forge-sdlc';
export const EFFORTS = /** @type {const} */ (['low', 'medium', 'high', 'xhigh', 'max']);

// A model alias Claude Code accepts, or a full id (`claude-opus-5-5`, with or
// without the `[1m]` context suffix). Values a host can mean, nothing else.
const ALIASES = new Set(['opus', 'sonnet', 'haiku', 'fable', 'best', 'default', 'opusplan', 'inherit']);
const FULL_ID = /^claude-[a-z0-9][a-z0-9-]*(\[1m\])?$/;
/** @param {unknown} v @returns {v is string} */
export const isModel = (v) => typeof v === 'string' && (ALIASES.has(v) || FULL_ID.test(v));
/** @param {unknown} v @returns {v is Effort} */
export const isEffort = (v) => typeof v === 'string' && /** @type {readonly string[]} */ (EFFORTS).includes(v);

export const ROLES = ['researcher', 'prototyper', 'spec-writer', 'implementer', 'verifier', 'reviewer', 'merger'];

// Each slot's default skill, and whether `disabled` may replace it.
const SLOTS = {
  'implementer.tdd': { skill: 'mattpocock-skills:tdd', required: true },
  'prototyper.prototype': { skill: 'mattpocock-skills:prototype', required: true },
  grilling: { skill: 'mattpocock-skills:grilling', required: true },
  'spec-writer.codebase-design': { skill: 'mattpocock-skills:codebase-design', required: false },
  'domain-modeling': { skill: 'mattpocock-skills:domain-modeling', required: false },
};
export const SLOT_NAMES = [...Object.keys(SLOTS), 'policy'];

/**
 * The roster: the YAML text of forge.yaml (undefined when there is none) over
 * the defaults and the parsed forge.md. Every problem is one band-ready line.
 * @param {string | undefined} yamlText
 * @param {ForgeConfig | undefined} forgeConfig
 * @returns {Roster}
 */
export function resolveRoster(yamlText, forgeConfig) {
  /** @type {Record<string, RosterRole>} */
  const roles = {};
  for (const role of ROLES) roles[role] = { agent: `${PLUGIN}:${role}`, swapped: false };
  /** @type {Record<string, string>} */
  const slots = {};
  for (const [slot, { skill }] of Object.entries(SLOTS)) slots[slot] = skill;
  /** @type {Roster} */
  const roster = {
    present: typeof yamlText === 'string',
    version: null,
    enforce: 'off',
    roles,
    slots,
    policy: [],
    allow: { agents: [], skills: [] },
    workflow: workflowOf(NO_SETTINGS, forgeConfig),
    problems: [],
  };
  fromForgeMd(roster, forgeConfig);
  if (typeof yamlText !== 'string') return roster;

  const say = (/** @type {string} */ line) => roster.problems.push(`roster: ${line}`);
  const { value, errors } = parseYamlSubset(yamlText);
  for (const e of errors) say(`line ${e.line}: ${e.message}`);
  const file = isMap(value) ? value : {};
  if (value !== null && !isMap(value)) say('the file is not a map of keys; nothing in it is read');

  for (const key of Object.keys(file)) if (!TOP_KEYS.includes(key)) say(`${keyOf(key)} is not a roster key (${TOP_KEYS.join(', ')}); ignored`);

  if (typeof file.version === 'number') roster.version = file.version;
  if (file.version === undefined || file.version === null) say('version is missing; read as version 1');
  else if (file.version !== 1) say(`version ${quote(file.version)} is not supported; read as version 1`);

  if (file.enforce === true) roster.enforce = 'on';
  else if (enforceHidden(yamlText, value, errors)) {
    roster.enforce = 'unreadable';
    say('enforce is unreadable; the roster is not enforced until the file is fixed');
  } else if (file.enforce !== false && file.enforce !== undefined && file.enforce !== null)
    say(`enforce ${quote(file.enforce)} is not true or false; the roster is not enforced`);

  for (const [role, entry] of entriesOf(file, 'roles', say)) {
    if (!ROLES.includes(role)) {
      say(`roles.${keyOf(role)} is not a role (${ROLES.join(', ')}); ignored`);
      continue;
    }
    if (entry === null) continue;
    if (!isMap(entry)) {
      say(`roles.${role} is not a map of agent, model and effort; ignored`);
      continue;
    }
    for (const field of Object.keys(entry))
      if (!ROLE_FIELDS.includes(field)) say(`roles.${role}.${keyOf(field)} is not agent, model or effort; ignored`);
    const base = /** @type {RosterRole} */ (roles[role]);
    let agent = base.agent;
    if (isName(entry.agent)) agent = entry.agent;
    else if (entry.agent != null) say(`roles.${role}.agent ${quote(entry.agent)} is not an agent type; the default kept`);
    if (entry.model != null && !isModel(entry.model))
      say(`roles.${role}.model ${quote(entry.model)} is no model alias or claude-* id; ignored`);
    if (entry.effort != null && !isEffort(entry.effort))
      say(`roles.${role}.effort ${quote(entry.effort)} is not ${EFFORTS.join('|')}; ignored`);
    roles[role] = roleOf(role, agent, isModel(entry.model) ? entry.model : base.model, isEffort(entry.effort) ? entry.effort : base.effort);
  }

  for (const [slot, skill] of entriesOf(file, 'slots', say)) {
    if (skill === null) continue;
    if (slot === 'policy') {
      const list = namesOf(skill, 'slots.policy', 'skill', say);
      if (list) roster.policy = list;
      continue;
    }
    const spec = Object.hasOwn(SLOTS, slot) ? SLOTS[/** @type {keyof typeof SLOTS} */ (slot)] : undefined;
    if (!spec) say(`slots.${keyOf(slot)} is not a slot (${SLOT_NAMES.join(', ')}); ignored`);
    else if (skill === 'disabled' && spec.required) say(`slots.${slot} is required and cannot be disabled; ${spec.skill} kept`);
    else if (!isName(skill)) say(`slots.${slot} ${quote(skill)} is not a skill name${spec.required ? '' : ' or disabled'}; ${spec.skill} kept`);
    else slots[slot] = skill;
  }

  for (const [kind, list] of entriesOf(file, 'allow', say)) {
    if (kind !== 'agents' && kind !== 'skills') {
      say(`allow.${keyOf(kind)} is not agents or skills; ignored`);
      continue;
    }
    const names = list === null ? [] : namesOf(list, `allow.${kind}`, kind === 'agents' ? 'agent type' : 'skill', say);
    if (names) roster.allow[kind] = names;
  }
  roster.workflow = workflowOf(settingsOf(file, say), forgeConfig);
  return roster;
}

/**
 * Whether the text is too broken to tell what `enforce` says: nothing in it
 * parsed though it has errors, the file is no map, or it sets no `enforce` and
 * an error sits on a line whose key is `enforce` (whatever its indent) or on a
 * top-level line whose key cannot be read as another one.
 * @param {string} text
 * @param {unknown} value
 * @param {YamlError[]} errors
 */
function enforceHidden(text, value, errors) {
  if (value === null) return errors.length > 0;
  if (!isMap(value)) return true;
  if (Object.hasOwn(value, 'enforce')) return false;
  const lines = text.split(/\r?\n/);
  return errors.some(({ line }) => {
    const raw = lines[line - 1] ?? '';
    const key = /^([A-Za-z0-9_.-]+)\s*:/.exec(raw.trimStart())?.[1];
    if (key === 'enforce') return true;
    return key === undefined && !/^\s/.test(raw);
  });
}

/**
 * A role entry with only the keys that are set.
 * @param {string} role
 * @param {string} agent
 * @param {string | undefined} model
 * @param {Effort | undefined} effort
 * @returns {RosterRole}
 */
const roleOf = (role, agent, model, effort) => ({
  agent,
  ...(model ? { model } : {}),
  ...(effort ? { effort } : {}),
  swapped: agent !== `${PLUGIN}:${role}`,
});

/**
 * forge.md's deprecated sections, read while they last: each valid `## Routing`
 * bullet for a role sets that role's model or effort (forge.yaml, read after,
 * wins key by key), and `## Policy skills` is the policy list until
 * `slots.policy` replaces it; `## Gates` is merged by workflowOf. Every bullet
 * still there is one deprecation line.
 * @param {Roster} roster
 * @param {ForgeConfig | undefined} config
 */
function fromForgeMd(roster, config) {
  for (const [key, value] of Object.entries(sectionOf(config, 'routing'))) {
    const m = /^(model|effort)\.(.+)$/.exec(key);
    const role = m?.[2] ?? '';
    if (!m || !ROLES.includes(role)) {
      roster.problems.push(
        `## Routing: ${keyOf(key)} is deprecated and has no docs/agents/forge.yaml equivalent; it stops working when ## Routing is removed`,
      );
      continue;
    }
    roster.problems.push(`## Routing: ${keyOf(key)} is deprecated; move it to roles.${role}.${m[1]} in docs/agents/forge.yaml`);
    const r = /** @type {RosterRole} */ (roster.roles[role]);
    if (m[1] === 'model') {
      if (isModel(value)) roster.roles[role] = roleOf(role, r.agent, value, r.effort);
      else roster.problems.push(`## Routing: ${keyOf(key)} ${quote(value)} is no model alias or claude-* id; ignored`);
    } else if (isEffort(value)) roster.roles[role] = roleOf(role, r.agent, r.model, value);
    else roster.problems.push(`## Routing: ${keyOf(key)} ${quote(value)} is not ${EFFORTS.join('|')}; ignored`);
  }
  for (const [key, value] of Object.entries(sectionOf(config, 'policy-skills'))) {
    const names = String(value ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && s !== 'none');
    if (!names.length) continue;
    const good = names.filter(isName);
    roster.policy.push(...good);
    roster.problems.push(`## Policy skills: ${keyOf(key)} is deprecated; move it to slots.policy in docs/agents/forge.yaml`);
    if (good.length < names.length)
      roster.problems.push(`## Policy skills: ${keyOf(key)} holds an item that is not a skill name; it is skipped`);
  }
  for (const [key, value] of Object.entries(sectionOf(config, 'gates'))) {
    const v = String(value ?? '').trim();
    const move = Object.hasOwn(GATES_MOVED, key) ? GATES_MOVED[key] : undefined;
    if (key === 'spec' && v === 'only-on-open') roster.problems.push(`## Gates: spec only-on-open is deprecated; move it to workflow.gates.spec: policy in ${ROSTER_FILE}`);
    else if (key === 'spec')
      roster.problems.push(`## Gates: spec ${v === 'always' ? v : quote(value)} is deprecated and has no ${ROSTER_FILE} equivalent; Gate 2 follows workflow.policy`);
    else if (move) roster.problems.push(`## Gates: ${keyOf(key)} is deprecated; move it to ${move} in ${ROSTER_FILE}`);
    else roster.problems.push(`## Gates: ${keyOf(key)} is deprecated and has no ${ROSTER_FILE} equivalent; it stops working when ## Gates is removed`);
  }
}

const ROSTER_FILE = 'docs/agents/forge.yaml';
/** @type {Record<string, string>} */
const GATES_MOVED = { policy: 'workflow.policy', max_parallel_slices: 'workflow.max_parallel_slices' };

export const GATE_KEYS = /** @type {const} */ (['intent', 'spec', 'plan']);
export const MAX_PARALLEL_SLICES = 3;

/**
 * What forge.yaml's workflow: sets, each value already checked.
 * (`maxParallelSlices` is `bad` for a value that is reported and replaced by the default.)
 * @typedef {{ policy?: Policy, maxParallelSlices?: number | 'bad', gates: Partial<Record<GateKey, GateMode>> }} Settings
 * @typedef {typeof GATE_KEYS[number]} GateKey
 */
/** @type {Settings} */
const NO_SETTINGS = { gates: {} };
const YAML = 'in forge.yaml';
const MD = 'in forge.md ## Gates';
const WORKFLOW_KEYS = ['policy', 'max_parallel_slices', 'gates'];

/**
 * forge.yaml's workflow: section, read key by key.
 * @param {Record<string, unknown>} file
 * @param {(line: string) => void} say
 * @returns {Settings}
 */
function settingsOf(file, say) {
  /** @type {Settings} */
  const out = { gates: {} };
  for (const [key, value] of entriesOf(file, 'workflow', say)) {
    if (value === null) continue;
    if (key === 'policy') {
      if (value === 'attended' || value === 'autonomous') out.policy = value;
      else say(`workflow.policy ${quote(value)} is not attended or autonomous; ignored`);
    } else if (key === 'max_parallel_slices') {
      if (Number.isInteger(value) && Number(value) > 0) out.maxParallelSlices = Number(value);
      else {
        say(`workflow.max_parallel_slices ${quote(value)} is not a positive integer; ${MAX_PARALLEL_SLICES} used`);
        out.maxParallelSlices = 'bad';
      }
    } else if (key === 'gates') {
      if (!isMap(value)) say('workflow.gates is not a map; ignored');
      for (const [gate, mode] of isMap(value) ? Object.entries(value) : []) {
        if (gate === 'pr') say('workflow.gates.pr is not a setting: Gate 4 is always the code owner’s; ignored');
        else if (!GATE_KEYS.includes(/** @type {GateKey} */ (gate))) say(`workflow.gates.${keyOf(gate)} is not a gate (${GATE_KEYS.join(', ')}); ignored`);
        else if (mode === 'attended' || mode === 'policy') out.gates[/** @type {GateKey} */ (gate)] = mode;
        else if (mode !== null) say(`workflow.gates.${gate} ${quote(mode)} is not attended or policy; ignored`);
      }
    } else if (key === 'stages') say('workflow.stages is not a host setting: the plugin’s workflow.yaml fixes the stages; ignored');
    else say(`workflow.${keyOf(key)} is not a workflow key (${WORKFLOW_KEYS.join(', ')}); ignored`);
  }
  return out;
}

/**
 * The workflow knobs: forge.yaml's settings over forge.md's `## Gates` over the
 * defaults, each with its source. A gate's mode is, first match wins: its
 * `gates.<key>`; for Gate 2, `## Gates` `spec: only-on-open` when forge.yaml
 * sets neither `workflow.policy` nor `gates.spec`; the global policy
 * (`workflow.policy`, else `## Gates` `policy`, else `attended`), where
 * `autonomous` is mode `policy` and anything else `attended`.
 * @param {Settings} settings
 * @param {ForgeConfig | undefined} config
 * @returns {Workflow}
 */
function workflowOf(settings, config) {
  const md = sectionOf(config, 'gates');
  const mdPolicy = typeof md.policy === 'string' ? md.policy.trim() : undefined;
  const mdMax = typeof md.max_parallel_slices === 'string' && /^\d+$/.test(md.max_parallel_slices.trim()) ? Number(md.max_parallel_slices.trim()) : 0;
  /** @type {Policy} */
  let policy = 'attended';
  let policySource = 'default';
  if (settings.policy) [policy, policySource] = [settings.policy, `workflow.policy ${YAML}`];
  else if (mdPolicy !== undefined) [policy, policySource] = [mdPolicy === 'autonomous' ? 'autonomous' : 'attended', `policy ${MD}`];
  let max = MAX_PARALLEL_SLICES;
  let maxSource = 'default';
  if (typeof settings.maxParallelSlices === 'number') [max, maxSource] = [settings.maxParallelSlices, `workflow.max_parallel_slices ${YAML}`];
  else if (!settings.maxParallelSlices && mdMax > 0) [max, maxSource] = [mdMax, `max_parallel_slices ${MD}`];
  /** @type {Workflow} */
  const out = {
    policy,
    maxParallelSlices: max,
    gates: { intent: 'attended', spec: 'attended', plan: 'attended' },
    sources: { policy: policySource, maxParallelSlices: maxSource, intent: policySource, spec: policySource, plan: policySource },
  };
  const onlyOnOpen = !settings.policy && !settings.gates.spec && String(md.spec ?? '').trim() === 'only-on-open';
  for (const gate of GATE_KEYS) {
    const set = settings.gates[gate];
    if (set) [out.gates[gate], out.sources[gate]] = [set, `gates.${gate} ${YAML}`];
    else if (gate === 'spec' && onlyOnOpen) [out.gates[gate], out.sources[gate]] = ['policy', `spec ${MD}`];
    else out.gates[gate] = policy === 'autonomous' ? 'policy' : 'attended';
  }
  return out;
}

// --- The workflow ------------------------------------------------------------
// The plugin's workflow.yaml (descriptive: the stages and gates are fixed, the
// file says what each does) joined with the resolved roster: each role's agent,
// model and effort, each slot's skill, each gate's mode with its source, and,
// for an effort, where it stands.

export const STAGES = /** @type {const} */ (['map', 'intent', 'spec', 'plan', 'build', 'built']);
/** The closed set of stop reasons, in write order. */
export const STOPS = /** @type {const} */ (['open', 'flagged', 'risk-high', 'attended']);

/**
 * @typedef {{ role: string, agent: string, model?: string, effort?: Effort, swapped: boolean }} WorkflowRole
 * @typedef {{ slot: string, skill: string }} WorkflowSlot
 * @typedef {'passed' | 'current' | 'ahead'} StageStatus
 * @typedef {'passed' | 'waiting' | 'stopped' | 'ahead'} GateStatus
 * @typedef {{ key: string, n: number, artifact: string, stops: string[], mode: GateMode | 'owner', source: string, status?: GateStatus }} WorkflowGate
 * @typedef {{ name: string, does: string, command?: string, roles: WorkflowRole[], slots: WorkflowSlot[], status?: StageStatus, gate?: WorkflowGate }} WorkflowStage
 * @typedef {{ slug: string, stage: string, gate: string, stop: string, risk: 'normal' | 'high' }} EffortPosition
 * @typedef {{ stages: WorkflowStage[], policy: Policy, maxParallelSlices: number, effort: EffortPosition | null, problems: string[] }} ResolvedWorkflow
 * @typedef {{ name: string, does: string, command?: string, roles: string[], slots: string[], gate?: { key: string, n: number, artifact: string, stops: string[] } }} Described
 */

/**
 * The loop: the plugin's workflow.yaml text joined with a resolved roster.
 * `agentModels` maps an agent type (`forge-sdlc:implementer`) to its frontmatter
 * model, read when the roster sets none. `effort`, an effort's record
 * (`{ slug, stage, gate, stop, risk }`), positions the loop: each stage
 * passed, current or ahead, and each gate passed, waiting (the record's gate),
 * stopped (that gate with a stop reason) or ahead.
 * @param {string | undefined} workflowText
 * @param {Roster | undefined} roster
 * @param {{ agentModels?: Record<string, string>, effort?: unknown }} [options]
 * @returns {ResolvedWorkflow}
 */
export function resolveWorkflow(workflowText, roster, options) {
  const r = isRoster(roster) ? roster : resolveRoster(undefined, undefined);
  const problems = [...r.problems];
  const agentModels = isMap(options?.agentModels) ? options.agentModels : {};
  const at = positionOf(options?.effort);
  const riskHigh = isMap(options?.effort) && options.effort.risk === 'high';
  const described = descriptionOf(workflowText, (line) => void problems.push(`workflow.yaml: ${line}`));
  /** @param {string} role @returns {WorkflowRole} */
  const roleIn = (role) => {
    const set = Object.hasOwn(r.roles, role) ? r.roles[role] : undefined;
    const rr = isMap(set) && typeof set.agent === 'string' ? set : { agent: `${PLUGIN}:${role}`, swapped: false };
    const model = rr.model ?? (Object.hasOwn(agentModels, rr.agent) && isModel(agentModels[rr.agent]) ? agentModels[rr.agent] : undefined);
    return { role, agent: rr.agent, ...(model ? { model } : {}), ...(rr.effort ? { effort: rr.effort } : {}), swapped: rr.swapped };
  };
  /** @param {string} slot @returns {WorkflowSlot} */
  const slotIn = (slot) => ({ slot, skill: slot === 'policy' ? r.policy.join(', ') || 'none' : String(Object.hasOwn(r.slots, slot) ? r.slots[slot] : '') });
  /** @param {NonNullable<Described['gate']>} g @returns {WorkflowGate} */
  const gateIn = (g) => {
    if (g.key === 'pr') return { ...g, mode: 'owner', source: 'always' };
    if (riskHigh) return { ...g, mode: 'attended', source: 'risk: high' };
    const key = /** @type {GateKey} */ (g.key);
    return { ...g, mode: r.workflow.gates[key], source: r.workflow.sources[key] };
  };
  const current = at ? described.findIndex((d) => d.name === at.stage) : -1;
  const waiting = at ? described.findIndex((d) => d.gate?.key === at.gate) : -1;
  /** The gate of the stage at index i, against the record's gate, else the stage. @param {number} i @returns {GateStatus} */
  const gateStatus = (i) => {
    if (i === waiting) return at?.stop === 'none' ? 'waiting' : 'stopped';
    return i < (waiting >= 0 ? waiting : current) ? 'passed' : 'ahead';
  };
  /** @type {(i: number) => StageStatus} */
  const stageStatus = (i) => (i < current ? 'passed' : i === current ? 'current' : 'ahead');
  const stages = described.map((d, i) => ({
    name: d.name,
    does: d.does,
    ...(d.command ? { command: d.command } : {}),
    roles: d.roles.map(roleIn),
    slots: d.slots.map(slotIn),
    ...(current >= 0 ? { status: stageStatus(i) } : {}),
    ...(d.gate ? { gate: { ...gateIn(d.gate), ...(current >= 0 ? { status: gateStatus(i) } : {}) } } : {}),
  }));
  return {
    stages,
    policy: r.workflow.policy,
    maxParallelSlices: r.workflow.maxParallelSlices,
    effort: current >= 0 ? at : null,
    problems,
  };
}

/**
 * An effort's record as the loop reads it, or null when it names no stage of
 * the loop; a gate or stop outside its closed set reads as `none`.
 * @param {unknown} effort
 * @returns {EffortPosition | null}
 */
function positionOf(effort) {
  if (!isMap(effort) || !STAGES.includes(/** @type {any} */ (effort.stage))) return null;
  const gate = ['intent', 'spec', 'plan', 'pr'].includes(/** @type {any} */ (effort.gate)) ? String(effort.gate) : 'none';
  const stop = STOPS.includes(/** @type {any} */ (effort.stop)) ? String(effort.stop) : 'none';
  return { slug: String(effort.slug ?? ''), stage: String(effort.stage), gate, stop, risk: effort.risk === 'high' ? 'high' : 'normal' };
}

/** The plugin's stages as workflow.yaml ships them: the loop drawn when the file is malformed. */
/** @type {readonly Described[]} */
const FIXED_STAGES = [
  {
    name: 'map',
    does: 'the map and its tickets, worked with the owner',
    command: '/forge-sdlc:wayfinder',
    roles: ['researcher', 'prototyper'],
    slots: ['grilling', 'prototyper.prototype', 'domain-modeling'],
  },
  {
    name: 'intent',
    does: 'intent.md and the draft PR',
    command: '/forge-sdlc:wayfinder',
    roles: [],
    slots: [],
    gate: { key: 'intent', n: 1, artifact: 'intent.md', stops: ['open', 'risk-high', 'attended'] },
  },
  {
    name: 'spec',
    does: 'spec.md under the policy skills',
    command: '/forge-sdlc:spec',
    roles: ['spec-writer'],
    slots: ['spec-writer.codebase-design', 'policy'],
    gate: { key: 'spec', n: 2, artifact: 'spec.md', stops: ['open', 'flagged', 'risk-high', 'attended'] },
  },
  {
    name: 'plan',
    does: 'plan.md, slices, the quiz',
    command: '/forge-sdlc:plan',
    roles: [],
    slots: [],
    gate: { key: 'plan', n: 3, artifact: 'plan.md', stops: ['open', 'risk-high', 'attended'] },
  },
  {
    name: 'build',
    does: 'one worktree per slice, merged when clean',
    command: '/forge-sdlc:build',
    roles: ['implementer', 'verifier', 'reviewer', 'merger'],
    slots: ['implementer.tdd'],
    gate: { key: 'pr', n: 4, artifact: 'the PR', stops: [] },
  },
  { name: 'built', does: 'ready for review; the code owner merges', roles: [], slots: [] },
];
const FILE_KEYS = ['version', 'stops', 'stages'];
const STAGE_FIELDS = ['does', 'command', 'roles', 'slots', 'human', 'lead', 'gate', 'end'];
const GATE_FIELDS = ['n', 'key', 'artifact', 'stops', 'owner'];

/**
 * workflow.yaml read against the fixed stages and gates: its stages, or, when
 * anything in it is wrong, each wrong thing reported and the fixed stages.
 * @param {unknown} text
 * @param {(line: string) => void} say
 * @returns {readonly Described[]}
 */
function descriptionOf(text, say) {
  /** @type {string[]} */
  const bad = [];
  const flag = (/** @type {string} */ line) => void bad.push(line);
  const { value, errors } = parseYamlSubset(typeof text === 'string' ? text : '');
  /** @type {Described[]} */
  const described = [];
  if (typeof text !== 'string') flag('the file is missing or unreadable');
  for (const e of errors) flag(`line ${e.line}: ${e.message}`);
  if (typeof text === 'string' && !isMap(value)) flag('the file is not a map of keys');
  if (isMap(value)) {
    for (const key of Object.keys(value)) if (!FILE_KEYS.includes(key)) flag(`${keyOf(key)} is not a workflow.yaml key (${FILE_KEYS.join(', ')})`);
    if (value.version !== 1) flag(`version ${quote(value.version ?? null)} is not 1`);
    if (!Array.isArray(value.stops) || value.stops.join() !== STOPS.join()) flag(`stops is not [${STOPS.join(', ')}]`);
    const stages = value.stages;
    if (!isMap(stages)) flag('stages is not a map');
    else {
      if (Object.keys(stages).join() !== STAGES.join()) flag(`stages are not ${STAGES.join(', ')}, in that order`);
      for (const fixed of FIXED_STAGES) if (Object.hasOwn(stages, fixed.name)) described.push(stageOf(fixed, stages[fixed.name], flag));
    }
  }
  if (!bad.length) return described;
  for (const line of bad) say(line);
  say('the plugin’s fixed stages are drawn until the file is fixed');
  return FIXED_STAGES;
}

/**
 * One stage of the file, checked against its fixed counterpart.
 * @param {Described} fixed
 * @param {unknown} s
 * @param {(line: string) => void} flag
 * @returns {Described}
 */
function stageOf(fixed, s, flag) {
  const where = `stages.${fixed.name}`;
  if (!isMap(s)) {
    flag(`${where} is not a map`);
    return fixed;
  }
  for (const key of Object.keys(s)) if (!STAGE_FIELDS.includes(key)) flag(`${where}.${keyOf(key)} is not a stage key (${STAGE_FIELDS.join(', ')})`);
  if (typeof s.does !== 'string' || !s.does) flag(`${where}.does is not a line of text`);
  if (s.command != null && typeof s.command !== 'string') flag(`${where}.command is not a command`);
  /** @type {Described} */
  const out = {
    name: fixed.name,
    does: String(s.does ?? ''),
    ...(typeof s.command === 'string' ? { command: s.command } : {}),
    roles: knownOf(s.roles, `${where}.roles`, ROLES, 'role', flag),
    slots: knownOf(s.slots, `${where}.slots`, SLOT_NAMES, 'slot', flag),
  };
  const g = s.gate;
  if (!fixed.gate) {
    if (g != null) flag(`${where}.gate: the ${fixed.name} stage ends at no gate`);
    return out;
  }
  if (!isMap(g)) {
    flag(`${where}.gate is not a map`);
    return out;
  }
  for (const key of Object.keys(g)) if (!GATE_FIELDS.includes(key)) flag(`${where}.gate.${keyOf(key)} is not a gate key (${GATE_FIELDS.join(', ')})`);
  if (g.key !== fixed.gate.key || g.n !== fixed.gate.n) flag(`${where}.gate is not Gate ${fixed.gate.n}, key ${fixed.gate.key}`);
  if (typeof g.artifact !== 'string' || !g.artifact) flag(`${where}.gate.artifact is not a line of text`);
  const owners = fixed.gate.key === 'pr';
  if (owners && g.stops != null) flag(`${where}.gate.stops: Gate 4 is the code owner’s and stops on nothing`);
  if (!owners && g.owner != null) flag(`${where}.gate.owner: only Gate 4 is the code owner’s`);
  out.gate = { key: fixed.gate.key, n: fixed.gate.n, artifact: String(g.artifact ?? ''), stops: owners ? [] : knownOf(g.stops, `${where}.gate.stops`, STOPS, 'stop reason', flag) };
  return out;
}

/**
 * A list whose every item is one of `known`; anything else is flagged.
 * @param {unknown} list
 * @param {string} key
 * @param {readonly string[]} known
 * @param {string} what
 * @param {(line: string) => void} flag
 * @returns {string[]}
 */
function knownOf(list, key, known, what, flag) {
  if (list == null) return [];
  if (!Array.isArray(list)) {
    flag(`${key} is not a list`);
    return [];
  }
  for (const item of list) if (!known.includes(item)) flag(`${key} holds ${quote(item)}, not a ${what} (${known.join(', ')})`);
  return list.filter((item) => known.includes(item));
}

/** Whether a value has the fields the join reads off a roster. @param {unknown} r @returns {r is Roster} */
const isRoster = (r) =>
  isMap(r) &&
  isMap(r.roles) &&
  isMap(r.slots) &&
  Array.isArray(r.policy) &&
  Array.isArray(r.problems) &&
  isMap(r.workflow) &&
  isMap(r.workflow.gates) &&
  isMap(r.workflow.sources);

/** A forge.md section as a map, anything else as none. */
const sectionOf = (/** @type {ForgeConfig | undefined} */ config, /** @type {string} */ name) => {
  const section = isMap(config) ? config[name] : undefined;
  return isMap(section) ? section : {};
};

const TOP_KEYS = ['version', 'enforce', 'roles', 'slots', 'allow', 'workflow'];
const ROLE_FIELDS = ['agent', 'model', 'effort'];

/** An agent type or skill name as the Agent and Skill tools name them. */
const isName = (/** @type {unknown} */ v) => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(v);

/**
 * The entries of a top-level section that must be a map; anything else is reported.
 * @param {Record<string, unknown>} file
 * @param {string} key
 * @param {(line: string) => void} say
 * @returns {[string, unknown][]}
 */
function entriesOf(file, key, say) {
  const section = file[key];
  if (section === undefined || section === null) return [];
  if (isMap(section)) return Object.entries(section);
  say(`${key} is not a map; ignored`);
  return [];
}

/**
 * A list of names, each bad item reported and dropped; undefined when it is no list.
 * @param {unknown} list
 * @param {string} key
 * @param {string} what
 * @param {(line: string) => void} say
 * @returns {string[] | undefined}
 */
function namesOf(list, key, what, say) {
  if (!Array.isArray(list)) {
    say(`${key} is not a list of ${what} names; ignored`);
    return undefined;
  }
  const names = list.filter(isName);
  if (names.length < list.length) say(`${key} holds an item that is not a ${what} name; it is skipped`);
  return names;
}

/**
 * A value as a problem line shows it: JSON, with DEL, C1 controls and the line
 * separators escaped too, so a file's bytes never reach the band raw.
 * @param {unknown} v
 */
const quote = (v) =>
  String(JSON.stringify(v)).replace(/[\u007f-\u009f\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

/** A key from the file as a problem line shows it: bare when it is a plain name, else quoted. */
const keyOf = (/** @type {string} */ k) => (/^[A-Za-z0-9_.:-]+$/.test(k) ? k : quote(k));

/** @param {unknown} v @returns {v is Record<string, unknown>} */
const isMap = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

// --- The YAML subset ---------------------------------------------------------
// 2-space maps; scalar lists, block (`- x`, at the key's indent or 2 deeper) or
// one-line flow (`[a, b]`); plain, 'single' and "double" quoted scalars (only
// \" and \\ escaped); true, false, integers, null, ~ and empty as null; `#`
// comments at a line's start or after a space. Each unsupported construct is
// an error naming its line; the line (and anything nested under it) is skipped
// and the rest is still read.

/** @typedef {{ line: number, message: string }} YamlError */
/** @typedef {{ line: number, indent: number, text: string }} Row */

/** A plain object whose own keys may be any string, `__proto__` included. */
const put = (/** @type {Record<string, unknown>} */ obj, /** @type {string} */ key, /** @type {unknown} */ value) =>
  Object.defineProperty(obj, key, { value, enumerable: true, writable: true, configurable: true });

/**
 * A line without its comment: `#` at the start or after whitespace, outside quotes.
 * @param {string} line
 */
function stripComment(line) {
  let open = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (open) {
      if (c === '\\' && open === '"') i++;
      else if (c === open) open = '';
    } else if (c === '"' || c === "'") {
      if (i === 0 || /[\s:[,-]/.test(line[i - 1] ?? '')) open = c;
    } else if (c === '#' && (i === 0 || /\s/.test(line[i - 1] ?? ''))) {
      return line.slice(0, i);
    }
  }
  return line;
}

const KEY = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[A-Za-z0-9_.-]+)\s*:(?:\s+(.*))?$/;
const isItem = (/** @type {string} */ text) => text === '-' || text.startsWith('- ');

/**
 * @param {string} text
 * @returns {{ value: unknown, errors: YamlError[] }}
 */
export function parseYamlSubset(text) {
  /** @type {YamlError[]} */
  const errors = [];
  const fail = (/** @type {number} */ line, /** @type {string} */ message) => {
    errors.push({ line, message });
  };

  /** @type {Row[]} */
  const rows = [];
  let dropped = -1; // the indent of the last dropped row: rows nested under it go too
  String(text ?? '')
    .split(/\r?\n/)
    .forEach((raw, i) => {
      const line = i + 1;
      const body = stripComment(raw).trimEnd();
      if (!body.trim()) return;
      const indent = body.length - body.replace(/^ +/, '').length;
      if (dropped >= 0 && indent > dropped) return;
      dropped = -1;
      const drop = (/** @type {string} */ message) => {
        fail(line, message);
        dropped = indent;
      };
      if (body.includes('\t')) return drop('a tab: indent and separate with spaces');
      if (/^(---|\.\.\.)(\s|$)/.test(body)) return drop('document markers (--- or ...) are not supported: one document per file');
      if (indent % 2) return drop(`an indent of ${indent} spaces: indent by 2`);
      rows.push({ line, indent, text: body.slice(indent) });
    });

  let at = 0;
  // Skip a row and every row nested deeper than `indent` under it.
  const skipFrom = (/** @type {number} */ indent) => {
    at++;
    while (at < rows.length && /** @type {Row} */ (rows[at]).indent > indent) at++;
  };

  /**
   * A scalar or a one-line flow list.
   * @param {string} text
   * @param {number} line
   * @returns {{ ok: true, value: unknown } | { ok: false }}
   */
  function scalar(text, line, inFlow = false) {
    const bad = (/** @type {string} */ message) => (fail(line, message), /** @type {{ ok: false }} */ ({ ok: false }));
    const lead = text[0] ?? '';
    if (lead === '&') return bad('anchors (&) are not supported: repeat the value');
    if (lead === '*') return bad('aliases (*) are not supported: repeat the value');
    if (lead === '!') return bad('tags (!) are not supported');
    if (lead === '|' || lead === '>') return bad('block scalars (| or >) are not supported: keep the value on one line');
    if (lead === '{') return bad('flow maps ({...}) are not supported: nest the keys by 2 spaces');
    if (lead === '@' || lead === '`' || lead === '%') return bad(`a value starting with ${lead} must be quoted`);
    if (lead === '-' && (text === '-' || text.startsWith('- '))) return bad('nested lists are not supported');
    if (lead === '[' && inFlow) return bad('nested flow lists are not supported');
    if (text.startsWith('[')) {
      if (!text.endsWith(']')) return bad('multi-line flow lists are not supported: close the [...] on its line');
      const inner = text.slice(1, -1).trim();
      if (!inner) return { ok: true, value: [] };
      /** @type {unknown[]} */
      const items = [];
      for (const part of splitFlow(inner)) {
        const item = scalar(part.trim(), line, true);
        if (!item.ok) return { ok: false };
        items.push(item.value);
      }
      return { ok: true, value: items };
    }
    if (text.startsWith('"')) {
      const m = /^"((?:[^"\\]|\\.)*)"$/.exec(text);
      if (!m) return bad('a double-quoted value must close at the end of its line');
      if ((m[1] ?? '').replace(/\\["\\]/g, '').includes('\\')) return bad('only \\" and \\\\ escapes are supported in a double-quoted value');
      return { ok: true, value: (m[1] ?? '').replace(/\\(.)/g, '$1') };
    }
    if (text.startsWith("'")) {
      const m = /^'((?:[^']|'')*)'$/.exec(text);
      if (!m) return bad('a single-quoted value must close at the end of its line');
      return { ok: true, value: (m[1] ?? '').replace(/''/g, "'") };
    }
    if (text === '' || text === '~' || text === 'null') return { ok: true, value: null };
    if (text === 'true') return { ok: true, value: true };
    if (text === 'false') return { ok: true, value: false };
    if (/^-?\d+$/.test(text)) return { ok: true, value: Number(text) };
    if (/:(\s|$)/.test(text)) return bad('a plain value holding ": " or ending in ":" must be quoted');
    return { ok: true, value: text };
  }

  /**
   * The block starting at the current row, at `indent`.
   * @param {number} indent
   * @returns {unknown}
   */
  function block(indent) {
    const first = rows[at];
    return first && isItem(first.text) ? list(indent) : map(indent);
  }

  /** @param {number} indent */
  function list(indent) {
    /** @type {unknown[]} */
    const items = [];
    while (at < rows.length) {
      const row = /** @type {Row} */ (rows[at]);
      if (row.indent !== indent || !isItem(row.text)) break;
      const text = row.text.slice(1).trim();
      if (KEY.test(text)) {
        fail(row.line, 'lists of maps are not supported: list plain values');
        skipFrom(indent);
        continue;
      }
      const item = scalar(text, row.line);
      skipFrom(indent);
      if (item.ok) items.push(item.value);
    }
    return items;
  }

  /** @param {number} indent */
  function map(indent) {
    /** @type {Record<string, unknown>} */
    const out = {};
    while (at < rows.length) {
      const row = /** @type {Row} */ (rows[at]);
      if (row.indent < indent) break;
      const skip = (/** @type {string} */ message) => {
        fail(row.line, message);
        skipFrom(row.indent);
      };
      if (row.indent > indent) {
        skip(`an indent of ${row.indent} spaces where ${indent} was expected`);
        continue;
      }
      if (row.text.startsWith('<<')) {
        skip('merge keys (<<) are not supported: repeat the keys');
        continue;
      }
      if (isItem(row.text)) {
        skip('a list item where a `key: value` was expected');
        continue;
      }
      const m = KEY.exec(row.text);
      if (!m) {
        skip('expected `key: value`');
        continue;
      }
      const raw = /** @type {string} */ (m[1]);
      const quoted = /^["']/.test(raw) ? scalar(raw, row.line) : undefined;
      if (quoted && !quoted.ok) {
        // scalar() reported it; the row and what is nested under it go
        skipFrom(row.indent);
        continue;
      }
      const key = quoted ? String(quoted.value) : raw;
      if (Object.hasOwn(out, key)) {
        skip(`duplicate key ${keyOf(key)}: the first is kept`);
        continue;
      }
      const rest = (m[2] ?? '').trim();
      at++;
      const next = rows[at];
      if (rest) {
        const v = scalar(rest, row.line);
        if (v.ok) put(out, key, v.value);
      } else if (next && next.indent === indent && isItem(next.text)) {
        put(out, key, list(indent));
      } else if (next && next.indent > indent) {
        if (next.indent !== indent + 2) {
          fail(next.line, `an indent of ${next.indent} spaces under a key at ${indent}: nest by 2`);
          at--;
          skipFrom(indent);
          continue;
        }
        put(out, key, block(next.indent));
      } else {
        put(out, key, null);
      }
    }
    return out;
  }

  try {
    const value = rows.length ? block(0) : null;
    // Only a top-level list stops short of the last row: the file is a list
    // or a map, never both.
    const left = rows[at];
    if (left) fail(left.line, 'a row that is no list item after a top-level list: the file is a list or a map, not both; the rest is not read');
    return { value, errors };
  } catch {
    // Not reached by any known input; a reader that never throws holds anyway.
    return { value: null, errors: [...errors, { line: 0, message: 'the text could not be read' }] };
  }
}

/**
 * The items of a flow list's inside, split at commas outside quotes.
 * @param {string} inner
 */
function splitFlow(inner) {
  /** @type {string[]} */
  const parts = [];
  let open = '';
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (open) {
      if (c === '\\' && open === '"') i++;
      else if (c === open) open = '';
    } else if (c === '"' || c === "'") open = c;
    else if (c === ',') {
      parts.push(inner.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(inner.slice(start));
  return parts;
}
