// Types of the shared roster reader (roster.mjs) for the mod's TypeScript; the
// JSDoc there is the source, keep the two in step.
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
export type ForgeConfig = Record<string, Record<string, string>>;
export type RosterRole = { agent: string; model?: string; effort?: Effort; swapped: boolean };
export type Roster = {
  present: boolean;
  version: number | null;
  enforce: 'on' | 'off' | 'unreadable';
  roles: Record<string, RosterRole>;
  slots: Record<string, string>;
  policy: string[];
  allow: { agents: string[]; skills: string[] };
  workflow: Workflow;
  problems: string[];
};
export type Policy = 'attended' | 'autonomous';
export type GateMode = 'attended' | 'policy';
export type Workflow = {
  policy: Policy;
  maxParallelSlices: number;
  gates: { intent: GateMode; spec: GateMode; plan: GateMode };
  sources: { policy: string; maxParallelSlices: string; intent: string; spec: string; plan: string };
};
export type YamlError = { line: number; message: string };
export type Stage = 'map' | 'intent' | 'spec' | 'plan' | 'build' | 'built';
export type Stop = 'open' | 'flagged' | 'risk-high' | 'attended';
export type WorkflowRole = { role: string; agent: string; model?: string; effort?: Effort; swapped: boolean };
export type WorkflowSlot = { slot: string; skill: string };
export type StageStatus = 'passed' | 'current' | 'ahead';
export type GateStatus = 'passed' | 'waiting' | 'stopped' | 'ahead';
export type WorkflowGate = {
  key: string;
  n: number;
  artifact: string;
  stops: string[];
  mode: GateMode | 'owner';
  source: string;
  status?: GateStatus;
};
export type WorkflowStage = {
  name: string;
  does: string;
  command?: string;
  roles: WorkflowRole[];
  slots: WorkflowSlot[];
  status?: StageStatus;
  gate?: WorkflowGate;
};
export type EffortPosition = { slug: string; stage: string; gate: string; stop: string; risk: 'normal' | 'high' };
export type ResolvedWorkflow = {
  stages: WorkflowStage[];
  policy: Policy;
  maxParallelSlices: number;
  effort: EffortPosition | null;
  problems: string[];
};

export declare const PLUGIN: 'forge-sdlc';
export declare const EFFORTS: readonly ['low', 'medium', 'high', 'xhigh', 'max'];
export declare const ROLES: string[];
export declare const SLOT_NAMES: string[];
export declare const GATE_KEYS: readonly ['intent', 'spec', 'plan'];
export declare const MAX_PARALLEL_SLICES: 3;
export declare const STAGES: readonly ['map', 'intent', 'spec', 'plan', 'build', 'built'];
export declare const STOPS: readonly ['open', 'flagged', 'risk-high', 'attended'];
export declare function isModel(v: unknown): v is string;
export declare function isEffort(v: unknown): v is Effort;
export declare function parseYamlSubset(text: string): { value: unknown; errors: YamlError[] };
export declare function resolveRoster(yamlText: string | undefined, forgeConfig: ForgeConfig | undefined): Roster;
export declare function resolveWorkflow(
  workflowText: string | undefined,
  roster: Roster | undefined,
  options?: { agentModels?: Record<string, string>; effort?: unknown },
): ResolvedWorkflow;
