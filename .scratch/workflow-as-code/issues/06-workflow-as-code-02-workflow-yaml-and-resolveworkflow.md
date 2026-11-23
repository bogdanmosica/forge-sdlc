# 06: workflow-as-code-02: workflow.yaml and resolveWorkflow

Type: slice
Status: open
Labels: ready-for-agent
Spec: `docs/efforts/workflow-as-code/spec.md` on `feat/workflow-as-code`

**What to build:** The plugin's descriptive loop file `workflow.yaml` (stages `map` … `built` under `effort-state.mjs`'s names, gates `intent`/`spec`/`plan`/`pr`, the stop sets) and the pure `resolveWorkflow(workflowText, roster, { agentModels?, effort? })` in the shared reader: stages in order with roles (agent, model, effort, swapped) and slots, each gate's mode, source, stops and status, the effort's position, `risk: high` forcing attended, and the fixed stage list on a malformed file

**Blocked by:** workflow-as-code-01

- [ ] the shipped file parses with no problems; stage names equal `effort-state.mjs`'s, gate keys equal intent, spec, plan, pr; every role and slot is one the roster knows
- [ ] `flagged` only in Gate 2's stops; Gate 4 mode `owner`
- [ ] roles resolved through a swapped roster
- [ ] passed/current/ahead stages and passed/waiting/stopped/ahead gates for each effort stage and stop
- [ ] `risk: high` shows every gate attended with source `risk: high`
- [ ] a malformed file is a problem and falls back to the fixed stages; the reader stays pure, no imports, never throws

## Proof

```sh
node --test tests/workflow-resolve.test.mjs tests/workflow-file.test.mjs
```

passes: resolveWorkflow cases and the shipped-file checks green

## Assumptions

- recommended: `agentModels` is keyed by the agent type as the Agent tool names it (`forge-sdlc:implementer`); a role's model is the roster's, else that agent's frontmatter model, else none (source: spec "agentModels holds each plugin agent's frontmatter model"; roster roles carry `agent` in that form)
- recommended: a role's `model` and `effort` are left out when unset, as `RosterRole` does; a stage's `command` and `gate` likewise (built has neither) (source: roster reader's `roleOf`)
- recommended: the `policy` slot's skill is the policy list joined with `, `, or `none`, as `bin/roster.mjs policy` prints it (source: CLAUDE.md, roster.mjs "for policy the names comma-separated or none")
- recommended: Gate 4 resolves `{ mode: 'owner', source: 'always', stops: [] }`, from `owner: always` in the file (source: spec "Gate 4 (pr) is always mode owner"; the spec's workflow.yaml sketch)
- recommended: `risk: high` forces Gates 1 to 3 attended with source `risk: high` and leaves Gate 4 `owner`; it is read from `effort.risk` even when the effort's stage is not positioned (source: spec "Gate 4 (pr) is always mode owner"; "For a risk: high effort the diagram shows every gate as attended")
- recommended: the position reads the record's `gate` as the gate the effort waits at: that gate is `waiting`, or `stopped` with a stop in the closed set; gates before it `passed`, after it `ahead`; with `gate: none` the gates of stages before the current one are `passed` (so `plan`/`plan` waits at Gate 3, `built`/`pr` waits at Gate 4, `build`/`none` has Gate 4 ahead) (source: docs/contracts.md "gate is the gate the effort waits at (none while a stage runs)")
- recommended: the result also carries `effort`, the normalized `{ slug, stage, gate, stop, risk }` or `null`, so the Mermaid and terminal views (slices 04, 06) can write `STOPPED: <reason>`, `why:` and `resume: … <slug>` from the resolved workflow alone (source: spec terminal B "(resolved workflow, columns)" and its why/resume lines)
- recommended: `problems` holds the roster's problems first (the `workflow:` lines included, so `bin/workflow.mjs` shows the settings' problems) and then the `workflow.yaml: ` lines (source: spec user story 23 "print the resolved workflow as JSON with its problems, so that I can check my settings")
- recommended: anything wrong in workflow.yaml (a parse error, a version other than 1, `stops` other than the closed set, stages not exactly map … built in order, an unknown stage or gate key, a role, slot or stop the reader does not know, a gate under the wrong key or on a stage that has none) is one problem line each plus `the plugin’s fixed stages are drawn until the file is fixed`, and the whole loop falls back to `FIXED_STAGES` in roster.mjs, which a test holds equal to the shipped file's resolution (source: spec "A malformed workflow.yaml is a reported problem, and the result falls back to the fixed stage list")
- recommended: the shipped file gives `intent` and `plan` explicit empty `roles` and `slots`, and keeps the sketch's `human` and `lead` lines as description the reader accepts but does not return (source: spec workflow.yaml sketch)
