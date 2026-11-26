---
effort: workflow-as-code
stage: spec
status: accepted
risk: high
updated: 2026-11-23
---

# Spec: Workflow as code: the forge-sdlc loop declared in forge.yaml and drawn as a diagram

Intent: [intent.md](intent.md) · Map: [map.md](map.md)

## Problem Statement

The owner of a host cannot see the forge-sdlc loop as a whole. Its shape (map, intent, spec, plan, build; Gates 1 to 4; who passes each gate; what stops a run) is written only as prose: in each stage's skill, in the gate policy reference, in ADR 0018 and in the `/forge` panel's loop table. Its knobs sit in forge.md `## Gates` (`policy`, `spec`, `max_parallel_slices`). So the owner cannot tell which gates pass by themselves under `autonomous` or why a run stopped where it did. They also cannot tune autonomy one gate at a time: the only per-gate knob is Gate 2's `spec: only-on-open`, and it works only under `attended`. A reviewer reading an effort's PR cannot see where the effort stands in the loop. The roster (`docs/agents/forge.yaml`, effort `roster-as-code`) already declares the loop's agents and skills, and it reserves a `workflow:` key. The loop itself has no declaration.

## Solution

The plugin describes its own loop in one file, `plugins/forge-sdlc/workflow.yaml`. The file lists the stages in order under `effort-state.mjs`'s names (`map`, `intent`, `spec`, `plan`, `build`, `built`). For each stage it gives what the stage does, its roles and slots, and the gate it ends at (`intent`, `spec`, `plan`, `pr`), with that gate's own list of stop reasons. The description is descriptive only: a host cannot reorder, add or remove stages.

A host tunes the loop under a `workflow:` key in its roster, `docs/agents/forge.yaml`, and nowhere else. The knobs are the global `policy`, `max_parallel_slices`, and `gates.intent`, `gates.spec` and `gates.plan`. Each gate knob is `attended` or `policy` and overrides the global policy for that gate alone. The stop rules (`open`, `flagged`, `risk-high`) are fixed, and `risk: high` still makes every gate stop. A gate set attended in forge.yaml stops with a new stop reason, `attended`, and `effort-state.mjs` explains it: `gate plan is attended in forge.yaml`. Any gate passed by policy continues in the same run. forge.md `## Gates` is still read for one minor version, with a deprecation line naming the forge.yaml key to move each bullet to. `/forge-sdlc:init` writes the knobs to forge.yaml instead of writing `## Gates`.

The same resolved workflow (the plugin's description plus the host's knobs plus the roster) is drawn in two places, generated each time and never kept by hand:

- `node plugins/forge-sdlc/bin/workflow.mjs --mermaid` prints a Mermaid flowchart, for the README and for each effort's PR body. It is one top-down chain: a hexagon per gate showing who passes it, the stops on the edges, and the agent and model of each stage's roles. With `--effort <slug>` it marks passed, current and stopped.
- The `/forge` panel's loop tab draws the same picture in the terminal. Passed stages fold to one line each. The gate sits on its stage's box border. A stopped gate shows `why:` and `resume:` lines under it. Below 52 columns the view falls back to one line per stage.

A host with no `workflow:` section reads and runs exactly as today.

## User Stories

1. As a host owner, I want the whole loop drawn in one diagram, so that I can see every stage, every gate and who passes each without reading five skill files.
2. As a host owner, I want to set `gates.plan: attended` under `workflow:` in forge.yaml, so that the plan quiz always waits for me while Gates 1 and 2 still pass by policy.
3. As a host owner, I want to set `gates.intent: policy` under a global `attended` policy, so that a clean intent flows into spec without my typing the next command.
4. As a host owner, I want `gates.spec: policy` to do what `spec: only-on-open` did, so that my old setting has a direct replacement.
5. As a host owner, I want every `workflow:` key to be optional, so that I write only the knob I change.
6. As a host owner, I want `workflow.policy` in forge.yaml to win over forge.md's `## Gates` `policy`, so that there is one place that decides.
7. As a host owner with forge.md `## Gates` and no `workflow:`, I want my loop to behave exactly as today, so that upgrading the plugin changes nothing I did not ask for.
8. As a host owner with forge.md `## Gates`, I want one deprecation line per bullet naming the forge.yaml key to move it to, so that I can migrate without reading docs.
9. As a host owner with `spec: only-on-open`, I want the deprecation line to tell me to write `gates.spec: policy`, so that the mapping is not mine to work out.
10. As a host owner with `spec: always`, I want the deprecation line to tell me the bullet has no forge.yaml equivalent because Gate 2 already follows the global policy, so that I can simply delete it.
11. As a host owner, I want `gates.pr` reported as an error that says Gate 4 is always the code owner's, so that I never think I made Gate 4 pass by itself.
12. As a host owner, I want an unknown gate key, an unknown `workflow:` key or a value other than `attended` or `policy` reported with its key, so that a typo never silently changes who passes a gate.
13. As a host owner, I want a bad `max_parallel_slices` (not a positive integer) reported and replaced by the default 3, so that the build never runs with a nonsense limit.
14. As a host owner, I want `risk: high` to stop every gate whatever my settings, so that risky changes are always attended.
15. As a host owner, I want the stop rules (`open`, `flagged`, `risk-high`) to stay fixed, so that no setting can make a gate pass over an open question or a flagged concern.
16. As a host owner, I want a run that stops at a gate I set attended to record `stop: attended`, so that the state says why it stopped.
17. As a host owner, I want `effort-state.mjs` to say `why: gate plan is attended in forge.yaml` and name the key that set it, so that I know which setting to change.
18. As a host owner, I want `/forge-sdlc:status` to show each stopped effort's stop reason and why line, `attended` included, so that one command tells me where every effort waits.
19. As a host owner, I want any gate passed by policy to continue in the same run, so that per-gate autonomy saves commands the way global autonomy does.
20. As a host owner, I want a policy-passed gate's report line to name the setting that passed it (`policy autonomous`, `gates.spec policy`), so that I can tell a global pass from an override.
21. As a host owner, I want `/forge-sdlc:init` to ask the gate policy, the Gate 2 override and `max_parallel_slices`, and write them under `workflow:` in forge.yaml, so that a new host never gets a deprecated section.
22. As a host owner re-running init, I want init to lead with my current `workflow:` values, or else with my `## Gates` values, and to keep every other forge.yaml key, so that a re-run never loses my roster.
23. As a host owner, I want `bin/workflow.mjs` to print the resolved workflow as JSON with its problems, so that I can check my settings in one command.
24. As a host owner, I want `bin/workflow.mjs --gate <key>` to print a gate's mode, its source and its stop list, so that a skill and I read the same answer.
25. As a host owner, I want the diagram to show each stage's roles with the agent and model the roster resolves, marked when swapped, so that I see who will actually run.
26. As a host owner, I want the diagram to draw a policy gate with a thin arrow and its stops on the edge (`passes unless open · flagged · risk-high`), and an attended or owner gate with a thick arrow, so that I see at a glance where the run will wait.
27. As a host owner, I want Gate 2 alone to list `flagged` among its stops, so that the diagram shows the real rule for each gate.
28. As a host owner, I want the `/forge` loop tab to draw the loop from the declared workflow, highlighting where the newest effort stands and the gate it waits at, so that I see the picture without leaving the terminal.
29. As a host owner, I want a stopped gate in the `/forge` view to show `why:` from the effort's stop reason and `resume: /forge-sdlc:wayfinder <slug>`, so that I know what to do next.
30. As a host owner on a narrow terminal, I want the loop view to fall back to one line per stage below 52 columns, down to the 24-column floor, so that it stays readable.
31. As a host owner, I want the `/forge` loop tab to keep the prose on what I do at each stage under the diagram, so that the help it gave before is not lost.
32. As a host owner, I want problems in my `workflow:` section shown where roster problems are shown (toasts and band lines), so that I have one place to look.
33. As a reviewer of an effort's PR, I want a `## Workflow` section with the Mermaid diagram marking the effort's position, so that I see where the effort stands without running anything.
34. As a reviewer, I want that section refreshed at every stage's gate record, so that the picture is never stale.
35. As a reviewer, I want the README's diagram generated by the same command and held equal to its output by a test, so that the published picture of the loop cannot drift from the code.
36. As the wayfinder, spec and plan stages, I want to read my gate's mode, source and stop list from the resolved workflow, so that the prose rule and the diagram cannot disagree.
37. As the build stage, I want to read `max_parallel_slices` from the resolved workflow, so that the knob has one reader.
38. As the gate policy reference, I want my stop-reasons table to gain `attended` and to name `plan.md` for `open`, so that it matches the stop rule it states.
39. As `effort-state.mjs`, I want a `gates` field listing each gate's mode and source, so that status and the panel read one answer.
40. As a maintainer, I want one pure reader to resolve the roster and the workflow, so that hooks, bin scripts and the mod share one reading with no mirror.
41. As a maintainer, I want `workflow.yaml` parsed by the same YAML subset as forge.yaml, so that the plugin adds no dependency.
42. As a maintainer, I want an ADR recording the descriptive workflow file and the per-gate override, so that ADR 0018's single global policy is superseded on the record.
43. As a maintainer of the prior-sdlc port, I want the schema documented once, so that the port can take it later.
44. As an owner, I want charting, grilling tickets and Gate 4 to stay mine under every setting, so that "autonomous" never means the loop decides what only I can.

## Implementation Decisions

**The plugin's loop description.** A new plugin file, `workflow.yaml`, at the plugin root, written in the forge.yaml YAML subset (block maps, one-line flow lists, scalars). It is descriptive: the plugin validates it against fixed stage and gate names, and a test holds it to them. Its shape comes from the prototype's sample, with the stages renamed to `effort-state.mjs`'s names:

```yaml
# from the prototype (docs/research/workflow-as-code/diagram-prototype/workflow.yaml), stages renamed
version: 1
stops: [open, flagged, risk-high, attended]   # the closed set, in write order
stages:
  map:
    does: the map and its tickets, worked with the owner
    command: /forge-sdlc:wayfinder
    roles: [researcher, prototyper]
    slots: [grilling, prototyper.prototype, domain-modeling]
    human: charting and grilling stay the owner's
  intent:
    does: intent.md and the draft PR
    command: /forge-sdlc:wayfinder
    gate:
      n: 1
      key: intent
      artifact: intent.md
      stops: [open, risk-high, attended]
  spec:   # roles [spec-writer], slots [spec-writer.codebase-design, policy]; gate 2 on spec.md, stops [open, flagged, risk-high, attended]
  plan:   # roles [], lead: the plan quiz; gate 3 on plan.md, stops [open, risk-high, attended]
  build:  # roles [implementer, verifier, reviewer, merger], slots [implementer.tdd]; gate 4, key pr, the PR, owner: always
  built:
    does: ready for review; the code owner merges
    end: true
```

**The host's knobs.** `workflow:` in `docs/agents/forge.yaml` holds only `policy` (`attended` | `autonomous`), `max_parallel_slices` (a positive integer) and `gates.{intent,spec,plan}` (`attended` | `policy`). Every key is optional. A `stages` key, `gates.pr`, any other key, or a bad value is a reported problem and is ignored.

**Precedence of a gate's mode**, first match wins. The mode's source travels with it:
1. `gates.<key>` in forge.yaml (source `gates.<key> in forge.yaml`);
2. forge.md `## Gates` `spec: only-on-open`, Gate 2 only, read only when forge.yaml sets no `workflow.policy` and no `gates.spec` (source `spec in forge.md ## Gates`), which maps to `policy`;
3. the global policy: `workflow.policy` in forge.yaml (source `workflow.policy in forge.yaml`), else `## Gates` `policy` (source `policy in forge.md ## Gates`), else the default `attended` (source `default`). `autonomous` gives a gate the mode `policy`; anything else gives `attended`, as today.

Gate 4 (`pr`) is always mode `owner`. For a `risk: high` effort the diagram shows every gate as attended with source `risk: high`. At run time the fixed `risk-high` stop does this, so no setting is consulted.

**The shared reader** (`hooks/roster.mjs`, pure, no imports, never throws) is the one module every consumer crosses. Its interface grows by one field and one function:
- `resolveRoster(yamlText, forgeConfig)` accepts `workflow` as a top-level key. It returns `roster.workflow`: `{ policy, maxParallelSlices, gates: { intent?, spec?, plan? }, sources }`, already merged with forge.md `## Gates`. Its `problems` gain the `workflow.` lines and the `## Gates` deprecation lines, in the same band-ready form as the `## Routing` ones. Examples: `## Gates: policy is deprecated; move it to workflow.policy in docs/agents/forge.yaml`, `## Gates: spec only-on-open is deprecated; move it to workflow.gates.spec: policy in docs/agents/forge.yaml`, `## Gates: spec always is deprecated and has no docs/agents/forge.yaml equivalent; Gate 2 follows workflow.policy`. A deprecation line fires only for a bullet that is present.
- `resolveWorkflow(workflowText, roster, { agentModels?, effort? })` joins the plugin's description with the resolved roster. `agentModels` holds each plugin agent's frontmatter model; `effort`, when given, is `{ slug, stage, gate, stop, risk }`. It returns `{ stages, policy, maxParallelSlices, problems }` in stage order. Each stage carries `name`, `does`, `command`, `roles` (each `{ role, agent, model, effort, swapped }`), `slots` (each `{ slot, skill }`), `status` (`passed` | `current` | `ahead`, when an effort is given) and `gate`. Each gate carries `{ key, n, artifact, stops, mode, source, status }`, the gate's status being `passed` | `waiting` | `stopped` | `ahead`. A malformed `workflow.yaml` is a reported problem, and the result falls back to the fixed stage list, so every consumer always gets a whole loop to read.

**lib.mjs** gains `readWorkflow(hostDir, effort?)`. It reads the plugin's `workflow.yaml`, the host's roster (`readRoster`) and the plugin agents' frontmatter models, and returns `resolveWorkflow`'s result. `readHostConfig` and `forge-config.mjs` are unchanged, so `## Gates` still prints there.

**A new bin script, `bin/workflow.mjs`**, in the shape of `bin/roster.mjs`. All forms take `--project <host>`, defaulting to the cwd:
- `workflow.mjs` prints the resolved workflow as JSON with `problems`;
- `workflow.mjs --gate <intent|spec|plan|pr>` prints `{ key, n, mode, source, stops }` as JSON;
- `workflow.mjs --mermaid [--effort <slug>]` prints Mermaid A, positioned from the effort's record in `.forge/state.json` (risk from that record) when `--effort` is given.

Exit 0, or 2 on bad usage. The script reads only.

**Mermaid A**, from the prototype's `mermaidA`: `flowchart TD`. Each stage is a box `["<name><br/><does><br/><role> · <model> per role>"]`, with `⇄` and the agent when swapped. Each gate is a hexagon `{{"Gate <n> · <mode>"}}`. A policy gate passes on a thin `-->` edge labelled `passes unless <stops joined by ' · '>`; an attended or owner gate passes on a thick `==>` edge. `classDef` classes mark passed, current (`▶`) and stopped (`■ … STOPPED: <reason>`) nodes. An attended gate's label names its source, as in `attended · gates.plan in forge.yaml`. Only long-standing syntax is used, with short edge labels.

**Terminal B** is a pure layout function in the `/forge` panel's tables module (`hooks/forge/help.ts`). It takes `(resolved workflow, columns)` and returns rows of `{ text, tone }`, which the panel renders with `Box`/`Text`. From 52 columns up, passed stages fold to one line each with their gate at the right. The current stage and the stages ahead are boxes, each with its gate written into the bottom border. A stopped gate adds `why: <from the stop reason>` and `resume: /forge-sdlc:wayfinder <slug>`; only `attended` names where its setting came from. Below 52 columns there is one line per stage, down to the 24-column floor. Its legend and glyphs come from the prototype's `compact` and `wide` views.

**The `/forge` panel** (`hooks/forge.tsx`) reads `workflow.yaml` from the plugin root and resolves it through the shared reader, as it already reads the roster. The loop tab draws terminal B for the effort the run pane follows (the newest map under `docs/efforts/`, positioned from `.forge/state.json`), or the loop with no position when there is none. The `LOOP` table keeps only its prose, under the diagram: what the driver does at each stage. Its structure comes from the workflow. `GATES` names forge.yaml's `workflow:` and the per-gate override. The state contract (`hooks/types/index.d.ts`) gains `stop: 'attended'`, and the panel's own types gain the resolved workflow.

**Stop reason `attended`**, last in the closed set `open`, `flagged`, `risk-high`, `attended`. It holds when a gate's mode is `attended` and its source is forge.yaml (`gates.<key>` or `workflow.policy`). An attended stop whose source is `## Gates` or the default writes no `stop`, exactly as today. When several reasons hold, the first is written and the report names all of them (the existing rule). The state contract and `docs/contracts.md` list the four.

**`effort-state.mjs`** keeps its output keys and adds `gates`: `{ intent, spec, plan, pr }`, each `{ mode, source }` from `readWorkflow`. `policy` stays the resolved global policy. `STOP_WHY.attended` reads `gate <gate> is attended in forge.yaml (<key>)`, where `<gate>` is the record's gate and `<key>` is the resolved source key (`gates.plan` or `workflow.policy`). If the current settings no longer make that gate attended, it reads `gate <gate> was attended in forge.yaml`.

**The gate policy reference** (`skills/wayfinder/GATE-POLICY.md`) stays the one place the rule is stated. Its changes:
- Each gate's mode, source and stop list are read from `bin/workflow.mjs --gate <key>` once per run, never from state.
- A gate in mode `policy` passes when the fixed stop rule is clear. A gate in mode `attended` stops for the owner.
- The stop-reasons table gains `plan.md` for `open` and a row for `attended`.
- The state write covers `attended` (from forge.yaml) as well as the autonomous stops.
- The report line keeps its prefix `Gate <n> passed:`, and its tail names the mode's source: `policy autonomous` for the global policy, `gates.<key> policy` for a forge.yaml override, `only-on-open` for the deprecated Gate 2 key. All three end `, nothing open`.

Wayfinder's Resume continues on any `Gate <n> passed` line, as it does today. The plan quiz's lines end `(source: <the same tail>)`.

**The stages.** Each stage file follows writing-for-agents' single source of truth. The rules for reading a gate's mode, for the stop, the report line and the state write are written once, in GATE-POLICY.md. A stage's gate section is one pointer line to it, plus what belongs to that stage alone: its gate key, its artifact and its next command.
- Wayfinder (Gate 1), spec (Gate 2) and plan (Gate 3) choose their gate line by the gate's mode, not by the global policy. A pass continues the run; a stop by `open`, `flagged` or `risk-high` reports as today's autonomous stop; a stop by mode `attended` reports as today's attended stop plus the source.
- Build reads `maxParallelSlices` from `bin/workflow.mjs`.
- Status prints the `why` as before. It needs no new line, since `why` already carries the source.
- Each stage that rewrites the PR body also rewrites its `## Workflow` section after its state write. The section holds the output of `bin/workflow.mjs --mermaid --effort <slug>` in a fenced `mermaid` block, every other section kept verbatim. Without a remote, the section goes into `PR.md`.

**Init** asks, under its Gates question, the global policy, then (under `attended`) whether Gate 2 passes by policy, then `max_parallel_slices`. It writes them under `workflow:` in forge.yaml: `policy` and `max_parallel_slices` always, `gates.spec: policy` only when chosen. It keeps every other key of an existing forge.yaml, and its forge.md template drops `## Gates`. A re-run leads with the current `workflow:` values, else the `## Gates` bullets.

**Docs and version.**
- A new ADR, `0026`, records the descriptive workflow file, the per-gate override and the `attended` stop reason, superseding ADR 0018's single global policy in part.
- `docs/design.md` gets a `Decision:` line.
- The README gains the defaults' Mermaid block and the `workflow:` schema. `hooks/ROUTING.md`'s deprecation section adds `## Gates`.
- `GLOSSARY.md`'s **gate policy** and **host config** entries name `workflow:` in forge.yaml.
- CLAUDE.md gains one `## Commands` line for `bin/workflow.mjs`, as for every bin script. Its run-pane paragraph names the loop tab's diagram in a clause. The schema's detail lives in the README and the ADR, since CLAUDE.md is always in context.
- `plugins/forge-sdlc` ships as 0.9.0.
- This repository's own host config moves its `## Gates` to `workflow:` in a new `docs/agents/forge.yaml` in the last slice.

**Deprecation window.** 0.9.0 still reads `## Routing`, `## Policy skills` and `## Gates`. All three are removed together in the next minor. ADR 0025's and `hooks/ROUTING.md`'s "removed in 0.9.0" promise is restated to match, and the new ADR records the change.

## Testing Decisions

A good test exercises a module only through its interface: the reader's two functions, a bin script's stdout and exit code against a fixture host, the panel's rendered rows over the stand-in host, or a skill file's text where the text is the contract. A test never reaches into a helper's internals.

- **The shared reader** (prior art: `tests/roster-reader.test.mjs`):
  - `resolveRoster` reads every `workflow:` knob and reports each bad key and value, `gates.pr` included.
  - It gives the precedence table one case per row and writes the `## Gates` deprecation lines. Each line names its key, `only-on-open` maps to `gates.spec: policy`, and `spec: always` says it has no equivalent.
  - With no forge.yaml and no `## Gates` it yields today's defaults.
  - `resolveWorkflow` returns the stages in order with roles resolved through a swapped roster, the per-gate stop lists (`flagged` only at Gate 2), the position classes for each effort stage and stop, `risk: high` forcing attended, and the fallback on a malformed `workflow.yaml`.
- **`workflow.yaml` itself:** a test parses the shipped file with no problems. Its stage names equal `effort-state.mjs`'s, its gate keys equal `intent`, `spec`, `plan`, `pr`, and every role and slot it names is one the roster knows.
- **`bin/workflow.mjs`** against fixture hosts (prior art: `tests/roster-bin.test.mjs`, `tests/effort-state.test.mjs`):
  - It prints JSON, `--gate` and `--mermaid`, and exits 2 on bad usage.
  - On a host with `gates.plan: attended` and an effort stopped at plan with `stop: attended`, the Mermaid marks Gate 3 stopped and names `gates.plan in forge.yaml`.
  - The output uses only the allowed syntax (`{{ }}`, `==>`, `:::`, `<br/>`) and has no edge label over the length the prototype found to wrap.
- **`effort-state.mjs`** (prior art: `tests/effort-state.test.mjs`): `stop: attended` gives the `why` naming `gates.plan` or `workflow.policy`. The `gates` field reports each mode and source. A host with `## Gates` and no forge.yaml prints what it printed before, apart from the new `gates` field.
- **The README:** its Mermaid block equals `bin/workflow.mjs --mermaid` on a host with no forge.yaml and no `## Gates`.
- **The `/forge` panel** over the stand-in host (prior art: `hooks/forge.roster.test.tsx`, `hooks/forge.test.tsx`): the loop tab renders the diagram with the current stage and a stopped gate's `why:` and `resume:`, shows the prose rows under it, and narrows to one line per stage below 52 columns. The layout function is tested under node beside the panel tables (prior art: `tests/forge-help.test.mjs`) at 72, 52, 51 and 24 columns.
- **Skill texts** (prior art: `tests/spec.test.mjs`, `tests/wayfinder.test.mjs`, `tests/plan.test.mjs`, `tests/config.test.mjs`, `tests/init.test.mjs`, `tests/roster-init.test.mjs`, `tests/build.test.mjs`, `tests/status.test.mjs`): GATE-POLICY.md names `attended` last in the closed set and `plan.md` for `open`. The report line keeps `Gate <n> passed:`. The stages read their gate from `bin/workflow.mjs`. Init writes `workflow:` and its template has no `## Gates`. Build reads `max_parallel_slices` from the workflow.
- **Evals:** the frame evals' host fixture writes `workflow:` in forge.yaml instead of `## Gates`, so the evals run the new path. No hook script changes, so no guardrail case is added.
- `npm test`, `npm run typecheck` (the panel's new types against the engine declarations) and `npm run validate` stay green.

## Out of Scope

- A prescriptive workflow: reordering, adding or removing stages, or swapping an upstream procedure.
- Automating charting, grilling or Gate 4.
- Turning a stop rule off or adding one.
- Triggers (issue labels, schedules) and measurement layers.
- An interactive artifact page of the diagram.
- The prior-sdlc side, which takes the schema in its own port.
- Removing `## Routing`, `## Policy skills` or `## Gates`; that is the next minor.

## Further Notes

- Builds on `roster-as-code` (merged to `main` as 0.8.0): same file, same parser, same problem lines. `workflow` stops being reported as "not a roster key".
- Open hypotheses from the research note, checked by hand at Gate 4 on this PR's own body: GitHub's Mermaid version draws `classDef` styling and the `{{ }}` hexagon as the prototype's PNG shows, and the panel's `borderStyle` names are as declared.
- The prototype under `docs/research/workflow-as-code/diagram-prototype/` is throwaway. Its `mermaidA`, `wide` and `compact` encode the accepted look, and the build reimplements them against the resolved workflow rather than copying the file.
- Port notes for prior-sdlc: the schema (`workflow.yaml` shape, the `workflow:` knobs, the precedence table), the `attended` stop reason, and `bin/workflow.mjs`'s three forms.

## Affected users and systems

- Host owners: tune gates under `workflow:` in forge.yaml. They see the loop in `/forge` and in the README, and get one deprecation line per `## Gates` bullet; without `workflow:`, nothing changes.
- PR reviewers: read a `## Workflow` Mermaid section in each effort's PR body, refreshed at each gate.
- prior-sdlc port: is called by nothing here; it reads the documented schema later.
- `plugins/forge-sdlc/workflow.yaml` (new): is read by the shared reader through `lib.mjs`, the `/forge` panel and the tests.
- `docs/agents/forge.yaml` (host roster): is read for `workflow:`, and is written by init (`workflow:` keys, other keys kept).
- `docs/agents/forge.md` (host config): its `## Gates` is read as deprecated; init stops writing the section.
- `hooks/roster.mjs` (shared reader, sensitive: under `hooks/**`): writes the new `workflow` field, `resolveWorkflow` and the deprecation problems; called by `lib.mjs`, the bin scripts and the mod.
- `hooks/scripts/lib.mjs` (sensitive: under `hooks/**`): gains `readWorkflow`; is called by the bin scripts.
- `hooks/forge.tsx` and `hooks/forge/help.ts` (the `/forge` panel, sensitive: under `hooks/**`): read the resolved workflow and `.forge/state.json`, and draw terminal B.
- `hooks/types/index.d.ts` (state contract, sensitive: under `hooks/**`): `stop` gains `attended`.
- `hooks/ROUTING.md`: lists `## Gates` as deprecated and restates the removal version.
- `bin/workflow.mjs` (new): reads the plugin file, the roster and the state, and prints JSON or Mermaid.
- `bin/effort-state.mjs`: reads the resolved workflow, gains `gates` and `STOP_WHY.attended`; is called by wayfinder, status and the run pane.
- `.forge/state.json`: is written with `stop: attended` by the stages.
- `skills/wayfinder/GATE-POLICY.md`, `skills/wayfinder/SKILL.md`, `skills/spec/SKILL.md`, `skills/plan/SKILL.md`, `skills/build/SKILL.md`, `skills/status/SKILL.md`: read the gate from `bin/workflow.mjs` and write the `## Workflow` PR section.
- `skills/init/SKILL.md` and its forge.md template: write `workflow:` to forge.yaml, drop `## Gates`.
- GitHub PR bodies and the README: render the Mermaid block.
- `docs/contracts.md`, `docs/design.md`, `GLOSSARY.md`, `docs/adr/` (new 0026), `plugins/forge-sdlc/README.md`: document the schema and the stop reason.
- `CLAUDE.md`: gains one Commands line for `bin/workflow.mjs` and a clause on the loop tab's diagram.
- `plugins/forge-sdlc/.claude-plugin/plugin.json` (sensitive: under `.claude-plugin/**`): version 0.9.0.
- `evals/lib/host.sh`: its fixture host writes `workflow:` in forge.yaml.
- This repository's host config: `## Gates` moves to `workflow:` in a new `docs/agents/forge.yaml`.

## Flagged concerns

- none

## Assumptions to confirm

- recommended: the build waits for `roster-as-code` to merge to `main`; this effort's branch is rebased onto it before the plan stage, since it extends the shared reader and `forge.yaml` (source: Destination)
- recommended: the PR body's `## Workflow` section carries the Mermaid diagram, written at intent and refreshed by each stage's gate record with the effort's position marked (source: none)
- recommended: `effort-state.mjs`, `/forge-sdlc:status` and GATE-POLICY.md read gate modes and stop lists from the resolved workflow (plugin `workflow.yaml` plus host knobs), so the prose rule and the diagram cannot disagree; GATE-POLICY.md's stop-reasons table gains `plan.md` for `open` (source: The diagram)
- recommended: `## Gates` and its `spec` key are removed in the minor version after this one ships; the toast names `forge.yaml` and the key to move, `spec: only-on-open` as `gates.spec: policy` (source: Per-gate autonomy)
- recommended: the `/forge` panel's `LOOP` table text stays as prose under the diagram for what the driver does at each stage; only its structure comes from `workflow.yaml` (source: none)
- recommended: Mermaid uses only long-standing syntax (`{{ }}`, `==>`, `:::class`, `<br/>`) and short edge labels; GitHub's Mermaid version is checked by hand at Gate 4 on the PR body itself (source: The diagram)
- recommended: an ADR records the descriptive workflow file and the per-gate override, superseding ADR 0018's single global policy in part (source: CLAUDE.md Conventions)
- recommended: `plugins/forge-sdlc` bumps a minor after roster's 0.8.0 (source: CLAUDE.md)
- recommended: the branch takes `main` by a merge, not a rebase, since `feat/workflow-as-code` is pushed; this is how the first assumption is met (source: owner's run instructions; ADR 0003)
- recommended: the version is 0.9.0, and 0.9.0 still reads `## Routing` and `## Policy skills`, which `hooks/ROUTING.md` and ADR 0025 said 0.9.0 removes; all three deprecated sections (`## Routing`, `## Policy skills`, `## Gates`) are removed together in the next minor, and the new ADR records the changed promise (source: intent Constraints, "No `workflow:` section is exactly today's behaviour"; the intent names no removal)
- recommended: `stop: attended` is written only when the attended mode comes from forge.yaml (`gates.<key>` or `workflow.policy`); an attended stop from `## Gates` or the default writes no `stop`, so a host without `workflow:` reads as today and the `why` always says "in forge.yaml" (source: intent Outcome and Constraints; Per-gate autonomy Q3)
- recommended: `effort-state.mjs`'s attended `why` is `gate <gate> is attended in forge.yaml (<key>)`, re-derived from the current settings on each call like `policy`, and `gate <gate> was attended in forge.yaml` when the settings no longer make it so (source: Per-gate autonomy Q3; `effort-state.mjs` reads the policy on each call)
- recommended: a gate's mode resolves in the order `gates.<key>` in forge.yaml, then `## Gates` `spec: only-on-open` for Gate 2 when forge.yaml sets neither `workflow.policy` nor `gates.spec`, then `workflow.policy`, then `## Gates` `policy`, then `attended`; each mode carries its source (source: The workflow schema Q3, "forge.yaml wins"; Per-gate autonomy Q1)
- recommended: `spec: always` has no forge.yaml equivalent; its deprecation line says Gate 2 follows `workflow.policy` (source: Per-gate autonomy Q1; GATE-POLICY.md, `always` is the default)
- recommended: the policy-passed report line keeps `Gate <n> passed:` and `, nothing open`, its middle naming the mode's source (`policy autonomous`, `gates.<key> policy`, `only-on-open`), so wayfinder's Resume and its test hold; the plan quiz's lines end `(source: <that middle>)` (source: GATE-POLICY.md Report line; ADR 0018)
- recommended: the test seam is the shared reader's `resolveRoster` and a new `resolveWorkflow`, both in the one pure no-import `hooks/roster.mjs`, crossed by every consumer; `bin/workflow.mjs` and `effort-state.mjs` over fixture hosts and the `/forge` panel over the stand-in host are the existing seams beside it (source: roster spec, no imports between pure files; codebase-design)
- recommended: `roster.workflow` holds the knobs already merged with `## Gates` and their sources, and `workflow:` problems join the roster's `problems` lines (source: ADR 0025, same problem reporting; intent Constraints)
- recommended: `resolveWorkflow` takes the agents' frontmatter models as an argument, so it stays pure; `lib.mjs` gains `readWorkflow(hostDir, effort?)` to read the files (source: codebase-design, accept dependencies; the roster's `readRoster`)
- recommended: `bin/workflow.mjs` has three forms (JSON, `--gate <key>` JSON, `--mermaid [--effort <slug>]`), takes `--project <host>` defaulting to the cwd, and exits 0, or 2 on bad usage (source: `bin/roster.mjs`; intent Outcome)
- recommended: the stages read their gate through `bin/workflow.mjs --gate <key>` and build reads `max_parallel_slices` from `bin/workflow.mjs`; `forge-config.mjs` stays unchanged (source: The diagram; the codebase, `skills/build/SKILL.md`)
- recommended: `effort-state.mjs` keeps its output keys and adds `gates`, each gate's `{ mode, source }` (source: The diagram, "the diagram reads both the gate's mode with its source and the effort's stop reason")
- recommended: terminal B is a pure layout function beside the panel tables, `(resolved workflow, columns) → rows`, tested under node; the panel only renders its rows (source: Drawing the loop in the terminal; the codebase, `tests/forge-help.test.mjs`)
- recommended: the `/forge` loop tab positions the effort the run pane follows, the newest map under `docs/efforts/`, from `.forge/state.json`, and draws the loop unpositioned when there is none (source: CLAUDE.md, the run pane's frontier)
- recommended: `workflow.yaml`'s stage `map` has no gate, `intent` ends at Gate 1, `build` ends at Gate 4 (`pr`), and `built` is the end; its gates use block maps, since the YAML subset has no flow maps (source: The diagram; the codebase, `parseYamlSubset`)
- recommended: init writes `workflow.policy` and `workflow.max_parallel_slices` always and `workflow.gates.spec: policy` only when chosen, keeps every other forge.yaml key, and drops `## Gates` from its forge.md template (source: The workflow schema Q3; roster spec, init writes forge.yaml)
- recommended: the new ADR is 0026, the next free number after the roster's 0025, with a `Decision:` line in `docs/design.md` (source: CLAUDE.md Conventions; `docs/adr/`)
- recommended: the frame evals' host fixture writes `workflow:` in forge.yaml, and no guardrail eval case is added, since no hook script changes (source: CLAUDE.md Conventions)
- recommended: this repository's own `## Gates` moves to `workflow:` in a new `docs/agents/forge.yaml` in the last slice, so the plugin's own runs use the new path (source: intent Observable)
- recommended: the gate rules (reading a gate's mode, the stop, the report line, the state write) are written once, in GATE-POLICY.md; each stage's gate section is one pointer line plus its own gate key, artifact and next command, and the stage text tests change with it (source: writing-for-agents, single source of truth; GATE-POLICY.md "the one place the rule is stated")
- recommended: CLAUDE.md changes by one Commands line for `bin/workflow.mjs` and one clause on the loop tab's diagram; the schema's detail stays in the README and ADR 0026 (source: writing-for-agents, context load; CLAUDE.md lists every bin script)
