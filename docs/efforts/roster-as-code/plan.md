---
effort: roster-as-code
stage: plan
status: accepted
risk: high
updated: 2026-11-22
---

# Plan: Roster as code: forge-sdlc agents and skills from a YAML file

Spec: [spec.md](spec.md). Tickets: `.scratch/roster-as-code/issues/06-*` … `15-*` (slices 01–10; tickets 01–05 are the map's). The tracker carries the live state (claims, frontier, closed); this file is the approved breakdown.

## Slices

| nn | title | blocked by | delivers |
| --- | --- | --- | --- |
| 01 | Shared roster reader, loaded by the mod | none | One pure, no-import `.mjs` under the plugin's hooks folder exposing `parseYamlSubset(text) -> { value, errors }` and `resolveRoster(yamlText, forgeConfig) -> Roster`, never throwing: the strict YAML subset with located errors, the schema (version, enforce, roles, slots, policy, allow), defaults, precedence over `## Routing` and `## Policy skills`, and every problem line |
| 02 | bin/roster.mjs and readRoster | 01 | `lib.mjs` gains `readRoster(hostDir)`; `bin/roster.mjs <slot> --project <host>` prints the slot's skill or `disabled` (`policy` comma-separated or `none`), and `bin/roster.mjs --project <host>` prints the resolved roster as JSON with `problems`; exit 2 on an unknown slot or a missing `--project`; defaults without `forge.yaml` |
| 03 | The mod swaps roles at spawn | 01 | At `agent.spawn`, a plain spawn of `forge-sdlc:<role>` whose roster names another offered agent is rewritten to it, with one appended `role contract: <plugin root>/skills/build/ROLES.md#<role>` line; the roster's model and effort apply and win over `## Routing` key by key; forks, resumes and workflow agents keep their type; a pass-through `agent.offer` hook collects offered types and an unoffered target is reported and not swapped; the routing record gains `agent` and the `⇄ routed` mark shows; the state contract gains `AgentRouting.agent` |
| 04 | Roster problems in the band | 03 | A `roster` note section in the band beside routing, crew, mark and worktrees: each bad roster entry toasted once and kept in the band while it stays bad; deprecation toasts when `## Routing` has bullets or `## Policy skills` holds a value other than `none`, each naming `docs/agents/forge.yaml` and the key to move (and that non-role routing bullets stop with the section); a warning when `enforce` is unreadable |
| 05 | Enforcement: roster-guard.mjs | 02 | A PreToolUse command hook `roster-guard.mjs`, matcher `Agent|Skill`, on `lib.mjs` `run` and `deny`: no decision without forge.yaml or with enforce not on; under enforcement an Agent call passes for a role default, a roster agent or `allow.agents` (no type reads as `general-purpose`), a Skill call for a slot skill, a policy entry, a `forge-sdlc:*` skill or `allow.skills`; everything else denied for lead and members alike with the fixed reasons, never quoting the value; fail closed when `enforce: true` parses, open when unreadable; a decision for malformed payloads |
| 06 | ROLES.md and the self-resolving slot call sites | 02 | A new `ROLES.md` beside `MEMBERS.md`: each role's inputs, report shape, evidence and holding hooks, and the `## Slots` rule (run `bin/roster.mjs <slot> --project <host>`, call what it prints, skip on `disabled`) |
| 07 | Spec and slice-review resolve slots for their members | 06 | The spec skill resolves `spec-writer.codebase-design` and `policy` in step 1 and passes both as pointer lines; the spec-writer's prompt list gains the codebase-design line and its step 3 calls that skill or skips on `disabled`; slice-review resolves `policy` for the reviewer's Bugs and security prompt; the `## Policy skills` reading is replaced by the roster command |
| 08 | /forge panel shows the roster | 01 | The `/forge` help panel shows each role's resolved agent when swapped and its resolved model and effort, and a slots table with each slot's skill or `disabled`, read through the shared reader; without forge.yaml the panel is as today |
| 09 | Init writes forge.yaml | 01 | Init keeps its policy-skills question and writes the answer to `docs/agents/forge.yaml` as `version: 1` with `slots.policy` (an empty list for none), creating the file or rewriting only that key; its forge.md template drops `## Policy skills` |
| 10 | Docs, ADR and version | 03, 04, 05, 06, 07, 08, 09 | `hooks/ROUTING.md` becomes the roster and routing reference; README roster section; ADR 0024 "The roster in forge.yaml"; a `Decision:` line in design section 8 and the agent-table note; CLAUDE.md's host-config clause names the optional forge.yaml; `plugins/forge-sdlc` bumps to 0.8.0 with the roster in its description |

### Proofs

#### 01

```sh
node --test tests/roster-reader.test.mjs && claude plugin test plugins/forge-sdlc
```

passes: the reader's cases green and the mod's tests green with the validators imported from the shared `.mjs`

#### 02

```sh
node --test tests/roster-bin.test.mjs
```

passes against fixture hosts in a temp dir

#### 03

```sh
test -f plugins/forge-sdlc/hooks/run-pane.roster.test.tsx && claude plugin test plugins/forge-sdlc && npm run typecheck
```

passes: the new roster spawn tests and every existing mod test green, the mod typechecks

#### 04

```sh
test -f plugins/forge-sdlc/hooks/run-pane.roster-band.test.tsx && claude plugin test plugins/forge-sdlc && npm run typecheck
```

passes: the band tests green over the stand-in host

#### 05

```sh
node --test tests/roster-guard.test.mjs tests/evals.test.mjs
```

passes: unit cases and the two new guardrails eval cases green

#### 06

```sh
node --test tests/roster-slots.test.mjs tests/agents.test.mjs tests/wayfinder.test.mjs tests/intent.test.mjs
```

passes: the slot call-site checks and the existing text tests green

#### 07

```sh
node --test tests/roster-members.test.mjs tests/spec.test.mjs tests/slice-review.test.mjs
```

passes: the member-resolution checks and the existing spec and slice-review tests green

#### 08

```sh
test -f plugins/forge-sdlc/hooks/forge.roster.test.tsx && claude plugin test plugins/forge-sdlc && node --test tests/forge-help.test.mjs
```

passes: the panel's roster tests and the help-table test green

#### 09

```sh
node --test tests/roster-init.test.mjs tests/init.test.mjs
```

passes: the init roster checks and the updated init tests green

#### 10

```sh
npm run check
```

exits 0: validate, typecheck and every test green

## Order of work

- Frontier at start: 01
- 02, 03, 08, 09 after 01 (at most 3 at once: 02, 03, 08 first, then 09)
- 04 after 03; 05 and 06 after 02; 07 after 06
- 10 after 03, 04, 05, 06, 07, 08 and 09

## Risks

- The mod's `subagentType` rewrite at `agent.spawn` under auto mode, and `agent.offer` covering plugin and host-local types, are unproven live: checked by hand by the owner at Gate 4 (listed in the PR); slice 03's tests cover the mapping over the stand-in host.
- The mod bundler loading a `.mjs` from a `.ts` file: slice 01's proof runs `claude plugin test` with the validators imported from the shared file, so it fails early if not.
- A swapped-in implementer finishing a slice from the brief plus its `role contract:` line: checked by hand at Gate 4.
- Enforcement denying the loop itself: slice 05's pass rules test every forge role default, roster entry and `forge-sdlc:*` skill.
- Slices 03 and 04 both edit the run pane routing: 04 is blocked by 03.

## Prefactoring

- Moving the model and effort validators from the run pane's routing module into the shared reader, in slice 01, so later slices import one copy.
