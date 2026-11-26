---
effort: workflow-as-code
stage: plan
status: accepted
risk: high
updated: 2026-11-23
---

# Plan: Workflow as code: the forge-sdlc loop declared in forge.yaml and drawn as a diagram

Spec: [spec.md](spec.md). Tickets: `.scratch/workflow-as-code/issues/05-*` … `15-*` (slices 01–11; tickets 01–04 are the map's). The tracker carries the live state (claims, frontier, closed); this file is the approved breakdown.

## Slices

| nn | title | blocked by | delivers |
| --- | --- | --- | --- |
| 01 | workflow: knobs in the shared reader | none | `resolveRoster` accepts `workflow:` and returns `roster.workflow` (`policy`, `maxParallelSlices`, `gates.{intent,spec,plan}`, `sources`), merged with forge.md `## Gates` in the spec's precedence order; bad keys and values (`stages`, `gates.pr`, unknown keys, values other than `attended`/`policy`, a non-positive `max_parallel_slices` falling back to 3) and one deprecation line per present `## Gates` bullet join `problems`; `workflow` is no longer "not a roster key" |
| 02 | workflow.yaml and resolveWorkflow | 01 | The plugin's descriptive loop file `workflow.yaml` (stages `map` … `built` under `effort-state.mjs`'s names, gates `intent`/`spec`/`plan`/`pr`, the stop sets) and the pure `resolveWorkflow(workflowText, roster, { agentModels?, effort? })` in the shared reader: stages in order with roles (agent, model, effort, swapped) and slots, each gate's mode, source, stops and status, the effort's position, `risk: high` forcing attended, and the fixed stage list on a malformed file |
| 03 | readWorkflow and bin/workflow.mjs JSON and --gate | 02 | `lib.mjs` gains `readWorkflow(hostDir, effort?)` (plugin file, host roster, agents' frontmatter models); `bin/workflow.mjs [--project <host>]` prints the resolved workflow as JSON with `problems`, `--gate <intent\|spec\|plan\|pr>` prints `{ key, n, mode, source, stops }`; exit 0, 2 on bad usage; reads only |
| 04 | Mermaid A and the README diagram | 03 | `bin/workflow.mjs --mermaid [--effort <slug>]` prints the `flowchart TD` from the prototype's look: a box per stage with roles and models (`⇄` when swapped), a hexagon per gate, thin `passes unless …` edges for policy gates, thick edges for attended and owner gates, classes for passed, current and stopped positioned from `.forge/state.json`; the plugin README carries the defaults' diagram, held equal to the command by a test |
| 05 | The attended stop in effort-state and the state contract | 03 | `effort-state.mjs` keeps its keys and adds `gates` (`{ intent, spec, plan, pr }`, each `{ mode, source }` from `readWorkflow`); `STOP_WHY.attended` reads `gate <gate> is attended in forge.yaml (<key>)`, or `gate <gate> was attended in forge.yaml` when the settings no longer make it so; the state contract and `docs/contracts.md` gain `stop: 'attended'`, last in the closed set |
| 06 | The terminal loop layout function | 02 | A pure layout function in `hooks/forge/help.ts`, `(resolved workflow, columns) → rows of { text, tone }`: from 52 columns passed stages fold to one line with their gate at the right, the current and later stages are boxes with the gate in the bottom border, a stopped gate adds `why:` and `resume: /forge-sdlc:wayfinder <slug>` (only `attended` names its setting's source); below 52 columns one line per stage down to the 24-column floor; legend and glyphs from the prototype |
| 07 | The /forge loop tab draws the loop | 05, 06 | The `/forge` panel reads `workflow.yaml` from the plugin root through the shared reader and the newest effort's record in `.forge/state.json`, and its loop tab renders the layout function's rows, the `LOOP` prose kept under the diagram; `GATES` names forge.yaml's `workflow:` and the per-gate override; `workflow:` problems show in the band and toasts where roster problems do; the panel's types gain the resolved workflow |
| 08 | The gate policy and the stages read their gate from the workflow | 04, 05 | `GATE-POLICY.md` stays the one place the rule is stated: each gate's mode, source and stops read once per run from `bin/workflow.mjs --gate <key>`; mode `policy` passes on a clear stop rule, `attended` stops; the stop-reasons table names `plan.md` for `open` and gains `attended` last; the state write covers `attended` from forge.yaml; the report line keeps `Gate <n> passed:` and `, nothing open` with its middle naming the source (`policy autonomous`, `gates.<key> policy`, `only-on-open`). Wayfinder, spec and plan reduce their gate section to one pointer line plus their gate key, artifact and next command, and choose by the gate's mode; build reads `max_parallel_slices` from `bin/workflow.mjs`; status keeps printing the why |
| 09 | The PR body's Workflow section | 08 | Each stage that rewrites the PR body also rewrites its `## Workflow` section after its state write: the output of `bin/workflow.mjs --mermaid --effort <slug>` in a fenced `mermaid` block, every other section kept verbatim; without a remote the section goes into `PR.md`; intent writes it first |
| 10 | Init writes workflow: to forge.yaml | 01 | Init's Gates question asks the global policy, then under `attended` whether Gate 2 passes by policy, then `max_parallel_slices`, and writes `workflow.policy` and `workflow.max_parallel_slices` always and `workflow.gates.spec: policy` only when chosen to forge.yaml, keeping every other key; a re-run leads with the current `workflow:` values, else the `## Gates` bullets; the forge.md template drops `## Gates`; the frame evals' host fixture (`evals/lib/host.sh`) writes `workflow:` instead |
| 11 | Docs, ADR 0026 and version 0.9.0 | 07, 09, 10 | ADR 0026 (the descriptive workflow file, the per-gate override, the `attended` stop, superseding ADR 0018 in part, and the deprecation window moved: `## Routing`, `## Policy skills` and `## Gates` removed together in the next minor), a `Decision:` line in `docs/design.md`, `hooks/ROUTING.md` listing `## Gates` as deprecated with the restated removal, the README's `workflow:` schema, GLOSSARY's gate policy and host config entries, CLAUDE.md's Commands line for `bin/workflow.mjs` and the loop-tab clause, this repository's `## Gates` moved to `workflow:` in a new `docs/agents/forge.yaml`, and `plugins/forge-sdlc` at 0.9.0 |

### Proofs

#### 01

```sh
node --test tests/workflow-reader.test.mjs tests/roster-reader.test.mjs
```

passes: the workflow knob, precedence, problem and deprecation cases green, and the roster reader cases still green

#### 02

```sh
node --test tests/workflow-resolve.test.mjs tests/workflow-file.test.mjs
```

passes: resolveWorkflow cases and the shipped-file checks green

#### 03

```sh
node --test tests/workflow-bin.test.mjs
```

passes against fixture hosts in a temp dir

#### 04

```sh
node --test tests/workflow-mermaid.test.mjs
```

passes: the Mermaid cases and the README equality check green

#### 05

```sh
node --test tests/effort-state-workflow.test.mjs tests/effort-state.test.mjs && npm run typecheck
```

passes: the new effort-state cases and the existing ones green, the mod typechecks

#### 06

```sh
node --test tests/workflow-terminal.test.mjs tests/forge-help.test.mjs
```

passes: the layout cases at each width and the help-table tests green

#### 07

```sh
test -f plugins/forge-sdlc/hooks/forge.workflow.test.tsx && claude plugin test plugins/forge-sdlc && npm run typecheck
```

passes: the loop tab tests and every existing mod test green, the mod typechecks

#### 08

```sh
node --test tests/workflow-stages.test.mjs tests/wayfinder.test.mjs tests/spec.test.mjs tests/plan.test.mjs tests/build.test.mjs tests/status.test.mjs
```

passes: the stage gate checks and the existing stage text tests green

#### 09

```sh
node --test tests/workflow-pr-section.test.mjs
```

passes: each stage that rewrites the PR body names the Workflow section

#### 10

```sh
node --test tests/workflow-init.test.mjs tests/init.test.mjs tests/roster-init.test.mjs tests/evals.test.mjs
```

passes: the init workflow checks and the existing init, roster-init and evals tests green

#### 11

```sh
node --test tests/workflow-docs.test.mjs && npm run check
```

exits 0: the docs checks, validate, typecheck and every test green

## Order of work

- Frontier at start: 01
- 02 and 10 after 01
- 03 and 06 after 02
- 04 and 05 after 03
- 07 after 05 and 06; 08 after 04 and 05; 09 after 08
- 11 after 07, 09 and 10
- At most 3 slices building at once

## Risks

- GitHub's Mermaid rendering of `classDef` and the `{{ }}` hexagon, and the panel's `borderStyle` names: unproven live; checked by hand by the owner at Gate 4 on this PR's own body (listed in the PR). Slice 04 holds the output to the allowed syntax.
- `hooks/roster.mjs` grows past 534 lines with `resolveWorkflow`: slice 02 keeps it pure, no imports, never throwing; its tests cross only `resolveRoster` and `resolveWorkflow`.
- Slices 07, 08 and 09 touch shared files (the panel, the stage skills): 07 is blocked by 05 and 06, 09 by 08, so no two of them build at once on the same file.
- Changing the report line's middle could break wayfinder's Resume: slice 08 keeps `Gate <n> passed:` and `, nothing open` and runs `tests/wayfinder.test.mjs` in its proof.
- A host without `workflow:` must behave exactly as today: slices 01, 03 and 05 each test the no-forge.yaml host against today's output.

## Prefactoring

- `feat/workflow-as-code` takes `origin/main` by a merge before the first slice (PR #4's hidden commands, which edit `run-pane.tsx` and the help tables), so the slices build on the panel as it stands; no code refactor first.
