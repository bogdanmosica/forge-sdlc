---
effort: roster-as-code
stage: spec
status: draft
risk: high
updated: 2026-11-22
---

# Spec: Roster as code: forge-sdlc agents and skills from a YAML file

Intent: [intent.md](intent.md) · Map: [map.md](map.md)

## Problem Statement

The owner of a host cannot choose which agent fills a forge-sdlc role or which skill a stage calls. Each role is fixed by the plugin's agent frontmatter, each skill call site is hard-coded in the skills' and agents' text, and only model and effort can be overridden, through `## Routing` in `docs/agents/forge.md`. So the owner cannot swap in their own reviewer or implementer, cannot try another TDD skill, and cannot drop an optional skill to see whether the loop does better without it. A platform owner cannot hand teams a standard set of agents and skills and hold them to it. The inventory found seven roles and six skill call sites, and every one is fixed in plugin text. This is the first layer of a "factory as code": the agents, skills and models of the loop in one declarative file that can be branched, reviewed, rolled back and later measured.

## Solution

A host may commit `docs/agents/forge.yaml`, the **roster**. For each of the seven roles it names the agent that fills the role and that agent's model and effort. For each of the six slots it names the skill that fills the slot, or `disabled` where the slot is optional. It can also turn enforcement on.

- **Roles** are swapped without any change to the leads: the run pane mod rewrites the agent type at `agent.spawn`, where it already applies `## Routing`. It also applies the role's model and effort there. `MEMBERS.md` and every member call stay as they are, still naming `forge-sdlc:<role>`.
- **Slots** are resolved explicitly. Each slot's call site calls the skill that `bin/roster.mjs <slot> --project <host>` prints, and skips the call when it prints `disabled`.
- **Enforcement** is opt-in. With `enforce: true`, the PreToolUse hook `roster-guard.mjs` denies, across the whole host session, every Agent or Skill call that the roster does not account for.
- **Visibility**: `bin/roster.mjs --project <host>` prints the resolved roster as JSON with its problems. The `/forge` help panel shows the resolved agents, models and slot skills. Each bad entry is skipped on its own and reported in the band above the prompt.
- **Defaults**: without `forge.yaml`, behaviour is exactly today's. `forge.yaml` wins over forge.md's `## Routing` and `## Policy skills`, which are still read for one minor version with a deprecation toast. `## Crew` stays in forge.md.

Observable: on this repo, a `forge.yaml` that names another agent for `reviewer` and `disabled` for `domain-modeling` has two effects. The next slice-review dispatches that agent, and its row in the band shows `⇄ routed`. The next grilling skips domain modeling. With `enforce: true`, an `Explore` call that is not under `allow.agents` is denied, and the reason names `docs/agents/forge.yaml`. Without `forge.yaml`, every test and eval passes unchanged.

## User Stories

1. As a host owner, I want to commit an optional `docs/agents/forge.yaml` beside forge.md, so that my crew's setup is versioned, reviewed and branchable like code.
2. As a host owner without `forge.yaml`, I want the loop to behave exactly as it does today, so that adopting the plugin upgrade costs me nothing.
3. As a host owner, I want to name another installed agent for the `reviewer` role, so that my own review agent reviews every slice.
4. As a host owner, I want to name a host-local agent by its Agent-tool type, so that I can fill a role with an agent defined in my repository's `.claude/agents/`.
5. As a host owner, I want to swap the `implementer` role, so that I can compare another implementer against the plugin's on the same plan.
6. As a host owner, I want to set a role's `model` and `effort` in the roster, so that cost and quality are tuned in the same file that picks the agent.
7. As a host owner, I want to set only the model or only the effort of a role without swapping its agent, so that the roster replaces `## Routing` without forcing a swap.
8. As a lead (a forge-sdlc command or the merger), I want to keep calling `forge-sdlc:<role>` unchanged, so that no dispatching skill learns about the roster.
9. As a swapped-in agent, I want to receive the forge brief with one added line pointing at `ROLES.md`, so that the pointers, the report shape and the evidence the loop expects reach me as they reach the default agent, and the role contract behind them reaches me too.
10. As a host owner, I want a role-contract reference listing each role's inputs, report shape and evidence, so that I can tell whether a replacement agent can fill the role before I swap it in.
11. As a host owner, I want the band to show `⇄ routed` on the row of an agent the roster swapped or re-routed, so that I can see at a glance that the roster took effect.
12. As a host owner, I want a roster role naming an agent that is not installed to be skipped and reported, so that a typo does not refuse every dispatch of that role.
13. As a host owner, I want to swap the `implementer.tdd` slot for another TDD skill, so that I can try another test-first method in the build.
14. As a host owner, I want to swap the `prototyper.prototype` slot, so that prototype tickets use my prototyping skill.
15. As a host owner, I want to swap the `grilling` slot, so that wayfinder and intent grill with my own interview skill, which still lets the human answer.
16. As a host owner, I want to disable the optional `domain-modeling` slot, so that I can measure whether the loop does better without glossary and ADR upkeep.
17. As a host owner, I want to disable the optional `spec-writer.codebase-design` slot, so that the spec-writer works from the template alone.
18. As a host owner, I want to list my policy skills under the `policy` slot, so that the spec-writer and the reviewer apply them from the roster.
19. As a host owner, I want an attempt to disable a required slot to be reported and the default kept, so that the loop's test-first, prototype and human-in-the-loop guarantees survive a mistake.
20. As an implementer, prototyper, wayfinder or intent session, I want one command that prints the skill for my slot, so that every call site resolves a slot in the same way.
21. As the spec-writer, which has no Bash, I want the spec skill to give me my slot's resolved skill in my prompt, so that I resolve the slot without a tool I lack.
22. As the reviewer, I want the merger to pass me the policy skills from the roster, so that the Bugs and security axis applies the host's current list.
23. As a host owner, I want `bin/roster.mjs --project <host>` to print the resolved roster as JSON with every problem, so that I can check the file before a run.
24. As a host owner, I want the `/forge` help panel to show the resolved agent, model and effort of each role and the skill of each slot, so that I can see what the loop will run without reading the YAML.
25. As a host owner, I want each bad roster entry skipped on its own and reported once as a toast and in the band while it stays bad, so that one error never discards the rest of the file.
26. As a host owner, I want an unknown top-level key to be reported and ignored, so that a misspelt key is visible and does not break the file.
27. As a host owner, I want a missing or unsupported `version` to be reported, so that a file written for a later schema is not silently misread.
28. As a host owner, I want the YAML parser to reject anchors, tags, block scalars and other unsupported YAML with an error that names the line, so that I know which line to rewrite.
29. As a host owner still using `## Routing`, I want it to keep working for one minor version with a toast that names `forge.yaml` and the key to move, so that I can migrate on my own schedule.
30. As a host owner still using `## Policy skills`, I want the same deprecation path, so that my policy skills keep applying while I migrate.
31. As a host owner who sets a role in both forge.yaml and `## Routing`, I want the roster's value to win key by key, so that the precedence is predictable.
32. As a platform owner, I want to set `enforce: true`, so that every Agent and Skill call in the host is held to the roster.
33. As a platform owner, I want enforcement to cover the lead and the members alike, in and out of an effort, so that no session path escapes it.
34. As a platform owner, I want to allow chosen built-ins and extra skills under `allow.agents` and `allow.skills`, so that teams keep `Explore` or a utility skill without filling a role with it.
35. As a platform owner, I want `forge-sdlc:*` skills, role defaults, roster agents, slot skills and policy skills to always pass under enforcement, so that the loop itself is never denied.
36. As a team member under enforcement, I want a denied call's reason to name `docs/agents/forge.yaml` and say what to do instead, without quoting the value I used, so that I can fix the call or ask for the roster to change.
37. As a platform owner, I want enforcement to stay on whenever `enforce: true` parses, even when other entries are bad, so that a broken entry does not switch governance off.
38. As a platform owner, I want a file too broken to read `enforce` to be left unenforced with a warning in the band, so that a corrupt file never locks a team out of every agent.
39. As a platform owner, I want no environment or settings bypass of enforcement, so that turning it off is always a reviewed edit of `forge.yaml`.
40. As a host owner without `forge.yaml` or with `enforce` not `true`, I want the guard hook to print no decision, so that I pay nothing for a feature I do not use.
41. As a maintainer of this plugin, I want one pure parser and roster reader shared by the hooks, the bin scripts and the mod, so that there is no second reading to keep in step.
42. As a maintainer, I want the repository to keep zero npm dependencies, so that hooks still run straight from the checkout.
43. As a maintainer, I want the first slice to prove live that the mod's type rewrite passes auto mode and that the mod loads the shared `.mjs`, so that the rest of the build does not rest on an unproven mechanism.
44. As a maintainer, I want an ADR and a `Decision:` line for the second host config file, so that the change to "hosts configure the plugin in forge.md only" is recorded.
45. As the prior-sdlc maintainer, I want a short port section naming the schema, the parser file, the hook and the mod change, so that the port is its own effort with one source of truth for the schema.
46. As a host owner running `/forge-sdlc:init`, I want init to ask for policy skills and write them to `forge.yaml` (`version: 1`, `slots.policy`), so that a new host starts with the roster file in place and the deprecated `## Policy skills` section is never written again.
47. As a host owner, I want the README and `hooks/ROUTING.md` to document the roster, so that I can learn the shape without reading the code.
48. As a maintainer editing a skill or agent file, I want the slot rule defined once and each call site to be one line naming its slot, so that changing how slots resolve is a one-place edit.

## Implementation Decisions

### The roster file

Security note before the block below: the file holds only references to installed agents and skills, never a prompt, a credential or an inline definition. Enforcement reasons never echo the values in it.

```yaml
version: 1                      # required when the file exists
enforce: false                  # only the literal true enforces
roles:                          # researcher, prototyper, spec-writer, implementer, verifier, reviewer, merger
  reviewer:
    agent: my-plugin:reviewer   # the Agent-tool type: plugin:agent, or a host-local agent's type
    model: sonnet               # an alias or a claude-* id, as ## Routing accepts
    effort: medium              # low | medium | high | xhigh | max
slots:
  implementer.tdd: other-plugin:tdd     # required: swap only
  prototyper.prototype: <skill>         # required
  grilling: <skill>                     # required
  spec-writer.codebase-design: disabled # optional: swap or disable
  domain-modeling: disabled             # optional
  policy: [writing-for-agents]          # optional list; [] or absent means none
allow:
  agents: [Explore]
  skills: []
```

- Every key is optional except `version`. There are no list-of-maps, so the parser grammar stays maps, scalar lists and scalars. The schema leaves room for later top-level keys (`procedures:`, workflow, measurement) without building them. Until a later version defines such a key, it is reported as unknown.
- Roles and slots are closed sets. An unknown role or slot name is a reported problem; the seven roles and six slots are the whole vocabulary.
- Defaults: each role is filled by `forge-sdlc:<role>`, with model and effort from its agent frontmatter. Each slot is filled by today's skill: `mattpocock-skills:tdd`, `mattpocock-skills:prototype`, `mattpocock-skills:grilling`, `mattpocock-skills:codebase-design`, `mattpocock-skills:domain-modeling`. `policy` falls back to `## Policy skills`, then to none.

### Modules

- **Shared roster reader**: one pure, no-import `.mjs` module under the plugin's hooks folder, with JSDoc types. Its interface is two functions, and it never throws:
  - `parseYamlSubset(text) -> { value, errors }`. The strict subset of the research note: 2-space maps, scalar lists (block and one-line flow), plain and quoted scalars, booleans, integers, null, comments. Anchors, aliases, tags, merge keys, block scalars, multi-line flow, multiple documents, tabs and duplicate keys are each rejected with an error that names the line.
  - `resolveRoster(yamlText | undefined, forgeConfig | undefined) -> Roster`. `Roster` is `{ present, version, enforce: 'on' | 'off' | 'unreadable', roles: { <role>: { agent, model?, effort?, swapped } }, slots: { <slot>: <skill> | 'disabled' }, policy: string[], allow: { agents, skills }, problems: string[] }`. Each problem is one band-ready line that starts with `roster:` or names the deprecated section. The forge.md config is passed in already parsed, so the module needs no import. The model and effort validators move here from the run pane's routing module, which imports them back. This is the deep module: the YAML subset, the schema, the defaults, the precedence and every problem string sit behind those two functions.
- **Hook helpers** (`lib.mjs`): add `readRoster(hostDir)`. It reads `docs/agents/forge.yaml` and forge.md from the host and returns `resolveRoster(...)`. `run(check)` keeps its signature. Only the scripts that need the roster call the helper; the other hooks read forge.md alone, as today.
- **`bin/roster.mjs`**: a new bin script on `lib.mjs`.
  - `bin/roster.mjs <slot> --project <host>` prints one line: the slot's skill, or `disabled`. For `policy` it prints the names comma-separated, or `none`.
  - `bin/roster.mjs --project <host>` prints the resolved roster as JSON with `problems`.
  - Exit 0, or exit 2 for bad usage: an unknown slot, or a missing `--project`. Without `forge.yaml` it prints the defaults.
- **`roster-guard.mjs`**: a new PreToolUse command hook, matcher `Agent|Skill`, built on `lib.mjs` `run` and `deny`, registered in `hooks.json`.
  - No `forge.yaml`, or `enforce` not `on`: no decision.
  - Agent call: it passes when its `subagent_type` (absent reads as `general-purpose`) is a role default `forge-sdlc:<role>`, a role's resolved `agent`, or listed in `allow.agents`.
  - Skill call: it passes when its `skill` is a slot's resolved skill, a `policy` entry, a `forge-sdlc:*` skill, or listed in `allow.skills`.
  - Name matching: a plugin-qualified entry matches exactly. A bare entry matches that name with or without any plugin prefix.
  - Every other call is denied, whether the caller is the lead or a member (`agent_id` is not consulted).
  - The reasons are fixed text: `Agent call outside the roster (docs/agents/forge.yaml, enforce: true): fill a role with it or list it under allow.agents, or use a roster agent.` The Skill form reads `Skill call outside the roster (docs/agents/forge.yaml, enforce: true): fill a slot with it or list it under allow.skills, or use a roster skill.` A reason names the file and the keys, never the matched value.
  - The hook stays under the design's 100 ms per call. It returns a decision for every payload, malformed ones included, because a thrown error is exit 1 with no decision, which lets the call through.
- **Run pane mod, spawn routing** (the run pane's routing module and its `agent.spawn` handler): at each spawn it reads forge.yaml and forge.md fresh and resolves the roster through the shared reader.
  - Only a plain spawn of `forge-sdlc:<role>` is swapped. A swapped role rewrites `subagentType` to the role's `agent` in the same `next({...})` that applies the model, and appends one line to the spawn's `prompt`: `role contract: <plugin root>/skills/build/ROLES.md#<role>`. The rest of the brief is unchanged; an unswapped spawn's prompt is untouched.
  - Forks, `resume` spawns and workflow agents keep their type.
  - The effort is applied on the agent's `turn.step`s, as today.
  - A swap target is used only when the session's `agent.offer` events have offered that type. The mod registers a pass-through `agent.offer` hook to collect them. Otherwise the default agent spawns and the entry is reported as naming no offered agent.
  - The routing record stays keyed by agent id. It gains the swapped-in type as `agent`. Its lookups go by role, not by the spawned type.
  - The `overridden` mark is true for any swap. The swapped-in definition's frontmatter is unknown, and an unknown default already counts as changed.
- **Run pane mod, band and toasts**: a new `roster` note section beside `routing`, `crew`, `mark` and `worktrees`, through the existing say-once path.
  - Deprecation toasts fire when `## Routing` has bullets, or when `## Policy skills` holds a value other than `none`. Each toast names `docs/agents/forge.yaml` and the key to move.
  - When `enforce` is unreadable, the band warns that the roster is not enforced.
- **Precedence**: forge.yaml wins over `## Routing` key by key. A role's `model` or `effort` in the roster beats the matching `model.<role>` or `effort.<role>` bullet. A bullet for a key the roster leaves unset still applies while the section is deprecated. `## Routing` bullets for non-role types (`Explore`) apply only through the deprecated section, so they stop working when it is removed, and the deprecation toast says so. `slots.policy`, when present, replaces `## Policy skills` whole. The engine's forcing variables and effort cap stay above both.
- **State contract** (`types/index.d.ts`): `RunPaneNotes` gains `roster?`, and `AgentRouting` gains `agent?` (the swapped-in type). Only these run-pane types change.
- **`/forge` help panel** (`forge.tsx`, `forge/help.ts`): each agent row shows the resolved agent when it is swapped, and the resolved model and effort. A new slots table lists each slot's skill or `disabled`, read through the shared reader. Without `forge.yaml` the panel is as today.
- **The slot rule**: one source of truth, the `## Slots` section of `ROLES.md`. It says: run `bin/roster.mjs <slot> --project <host>`, call the skill it prints, and skip the call when it prints `disabled`. Each call site is one line in its own file's voice that names three things: the slot, by its glossary word; its default skill; and the command. The step's completion criterion is unchanged, so a disabled optional slot skips the call and still ends on the step's own "Done when".
  - implementer step 3 (`implementer.tdd`) and the prototyper (`prototyper.prototype`) run the command themselves, since both have Bash.
  - wayfinder step 2 and its grilling row, and intent (`grilling`, `domain-modeling`), run in the main session.
  - The spec skill resolves `spec-writer.codebase-design` and `policy` in step 1. Step 2 adds a pointer line for the codebase-design slot's skill (or `disabled`) beside the policy skills. spec-writer's "Your prompt gives" list gains that line. Its step 3 calls the skill the line names, or skips the call on `disabled`.
  - slice-review step 1 resolves `policy` for the reviewer's Bugs and security prompt.
  - The `## Policy skills` reading in spec and slice-review is replaced by the roster command, whose fallback still reads the section.
- **Role-contract reference**: a new `ROLES.md` beside `MEMBERS.md`, written for the owner choosing a replacement. It holds:
  - for each of the seven roles: its inputs (the brief's pointers), its report shape, the evidence it leaves (the implementer's verify record and slice `agent`, the merger's review record, and so on), and the hooks that hold it (Stop gate, test-frozen, context budget);
  - the `## Slots` section above.
  - `hooks/ROUTING.md` and the README link it, with the condition "before filling a role with another agent".
  - `MEMBERS.md` stays unchanged, since leads make the same calls.
  - No runtime check beyond the existing hooks.
- **Init**: init keeps asking for policy skills and writes the answer to `docs/agents/forge.yaml` as `version: 1` with `slots.policy` (an empty list for none), creating the file or rewriting only that key when it exists; every other roster key is left as the owner wrote it. Its forge.md template drops `## Policy skills`, because that section is deprecated. The README points owners to the rest of the roster.
- **Docs**:
  - `hooks/ROUTING.md` becomes the roster and routing reference: shape, precedence, deprecation, invalid entries, the `⇄ routed` mark.
  - The README gets a roster section.
  - ADR 0024, "The roster in forge.yaml".
  - A `Decision:` line in design section 8, plus the design's agent table note that frontmatter is the default.
  - CLAUDE.md, which is always in context, changes by one clause: its convention "Hosts configure the plugin in `docs/agents/forge.md` only" becomes forge.md plus the optional `forge.yaml`. The detail lives in `hooks/ROUTING.md`.
  - `GLOSSARY.md` already defines roster, slot, host config and policy skill on this branch.
- **Version**: `plugins/forge-sdlc` bumps to 0.8.0. The `plugin.json` description mentions the roster.

### Seams

1. **The shared roster reader's two functions**: the one interface every consumer crosses (`bin/roster.mjs`, `roster-guard.mjs`, the mod's spawn routing, the help panel). Almost all behaviour is tested here, under node, from fixture texts.
2. **Existing seam: the guardrail `check(payload, { projectDir, config })` behind `lib.mjs` `run`**, with its guardrails eval `seam.json`.
3. **Existing seam: the mod's `agent.spawn` and `turn.step` handlers over the stand-in host**, as `## Routing` is tested today.
4. **Existing seam: bin scripts run as processes against a fixture host in a temp dir**, as `crew-name.mjs` and `forge-config.mjs` are.

## Testing Decisions

- A good test drives a module through its interface and asserts what a caller sees: the printed line, the JSON, the decision, the spawn input the engine receives, the band note. Parse-tree shapes and private helpers stay untested.
- **Shared roster reader** (node, new tests beside `tests/run-pane-config.test.mjs`, fixture texts inline):
  - the parser's accepted subset;
  - each rejected construct, with its line number;
  - `resolveRoster` with no file, which yields exactly today's defaults;
  - each role and slot entry kind, and each bad entry skipped on its own with its problem line;
  - a required slot disabled, which is reported with the default kept;
  - an unknown top-level key, role or slot;
  - a missing or unsupported `version`;
  - `enforce` as `true`, `false`, another value, and unreadable;
  - precedence over `## Routing` and `## Policy skills` key by key, with the deprecation problems.
- **`bin/roster.mjs`** (node, fixture host in a temp dir, prior art `tests/crew-name.test.mjs` and `tests/config.test.mjs`):
  - each slot's line;
  - `disabled`;
  - `policy` as a comma-separated list or `none`;
  - the JSON form with problems;
  - exit 2 on an unknown slot or a missing `--project`;
  - defaults without `forge.yaml`.
- **`roster-guard.mjs`** (node unit tests in the style of `tests/context-budget.test.mjs`):
  - no decision without the file or with `enforce` off;
  - each pass rule;
  - deny for a built-in not allowed, an unrelated skill, and an Agent call with no type;
  - lead and member payloads alike;
  - bare and qualified name matching;
  - fail closed with bad entries;
  - fail open when unreadable;
  - a decision for malformed payloads;
  - the reason never contains the matched value.
  - Two guardrails eval cases, an Agent deny and a Skill deny, each with `seam.json` and a fixture host holding `forge.yaml`, run by `tests/evals.test.mjs`.
- **Mod spawn routing** (`run-pane.routing.test.tsx` over `run-pane.fixture.tsx`):
  - a swapped role rewrites `subagentType`;
  - the roster's model and effort apply, and win over `## Routing`;
  - a non-swapped role is untouched;
  - forks and resumes keep their type;
  - a target not offered is reported and not swapped;
  - the `⇄ routed` mark and the routing record carry the swapped-in type;
  - a bad entry shows in the band once as a toast;
  - the deprecation toasts appear;
  - no file means no change.
- **Help panel** (`forge.test.tsx`; `tests/forge-help.test.mjs` keeps holding the tables to the plugin's skills): resolved agents, models and slot skills with a roster, and today's rows without one.
- **Skill text tests** (`tests/build.test.mjs`, `tests/wayfinder.test.mjs`, `tests/intent.test.mjs`, `tests/spec.test.mjs`, `tests/slice-review.test.mjs`, a new check in `tests/agents.test.mjs`):
  - each call site names its slot, the roster command and the default skill, so today's assertions on the default skill names keep holding;
  - `ROLES.md` holds the `## Slots` rule.
  - `tests/init.test.mjs` changes with the init question list.
- **Regression**: without `forge.yaml`, `npm test`, `npm run typecheck`, `npm run validate` and the guardrails evals pass with no change to their expectations other than the text tests above.
- **Live checks, by hand**:
  - The first slice is a spike. In an auto-mode session on this repo, a swapped `subagentType` at `agent.spawn` spawns the swapped agent and is not refused, and the mod loads the shared `.mjs` from a `.ts` file (`claude plugin validate`, `claude plugin test`, one session). The spike also confirms that `agent.offer` offers plugin and host-local agent types before dispatch.
  - At Gate 4, one build slice is run with a swapped implementer from the brief with its `role contract:` line.

## Out of Scope

- The workflow as code: stages, order, gates and triggers in YAML. A later layer.
- Measurement: online evals, benchmarks, roster A/B, self-improvement PRs against the YAML. A later layer.
- Inline agent or skill definitions in the YAML.
- Building the prior-sdlc side: its own effort, in its own repository.
- Adding roles or stages.
- Making the upstream procedures read by file (`to-spec`, `to-tickets`, `implement-spec`, `wayfinder`, `pr`, `setup-matt-pocock-skills`) swappable.
- Swapping the researcher's research method, which is inline and not a Skill call. Swapping the researcher role covers it.
- Hiding non-roster agents from the model's listing through `agent.offer`. The mod only observes offers.
- A managed-settings lock on the roster, and any environment bypass of enforcement.
- A transparent Skill swap through `tool.call`, PreToolUse `updatedInput` or `skill.prompt`.
- Checking that a slot's skill is installed. A missing skill fails visibly as the Skill tool's error.

## Further Notes

- **Limits of enforcement.** The guard sees Agent and Skill tool calls only. A slash command the human types bypasses PreToolUse, and the procedures read by file are not Skill calls. Enforcement governs what agents call; the human's own commands stay theirs. Like every guardrail here, it is a reminder backed by review, not a sandbox: a crash in the hook means no decision, which is why the guard's tests cover malformed payloads.
- **Roles keep their contract.** A swapped-in agent runs its own definition with the forge brief plus one `role contract:` line pointing at its `ROLES.md` section. The worktree, the proof, the verify record and the Stop gate still hold it, and ADR 0011's write scopes become the replacement's to honour. A swapped implementer that skips `verify-record.mjs` is stopped by the Stop gate exactly as the default would be.
- **`## Routing` for non-role types.** `model.Explore` and similar bullets have no roster equivalent, because roles are closed. They work until the section is removed in 0.9.0, and the deprecation toast names this.
- **Shape stays open.** `version: 1` plus "unknown keys reported" lets a later version add `procedures:`, workflow or measurement keys while v1 readers keep working.

### Port to prior-sdlc

The prior-sdlc effort ports, without changing it:
1. The schema above and its problem strings.
2. The shared roster reader file as is: pure, no imports, both functions.
3. `roster-guard.mjs`, with its matcher, pass rules, reasons and fail-closed/fail-open rule, on that plugin's own hook helper.
4. The mod's spawn swap, model and effort, and the `agent.offer` collection, in that plugin's run pane.
5. `ROLES.md` with its `## Slots` rule.
6. Its own slot call sites.

That plugin's state contract takes the same two type additions. No code outside this repository is written by this effort.

## Affected users and systems

- Host owners (this repo, personal hosts): may commit `docs/agents/forge.yaml` to swap role agents, set model and effort, and swap or disable slots. They see the roster in `/forge` and in the band, and get deprecation toasts for `## Routing` and `## Policy skills`.
- Platform owners (through the prior-sdlc port): may set `enforce: true` and `allow`, holding every session in the host to the roster.
- Team members in an enforced host: Agent and Skill calls outside the roster are denied with a reason naming the file.
- Shared roster reader (new pure module): is called by `lib.mjs`, `bin/roster.mjs`, `roster-guard.mjs`, the run pane mod and the help panel. Reads YAML text and the parsed forge.md.
- `lib.mjs`: calls the shared reader. Reads `docs/agents/forge.yaml` through the new `readRoster`.
- `bin/roster.mjs` (new): reads the host's forge.yaml and forge.md, and is called by the implementer, the prototyper and the wayfinder, intent, spec and slice-review skills.
- `roster-guard.mjs` (new PreToolUse hook, `Agent|Skill`): reads forge.yaml and denies calls. A sensitive path (`hooks/**`, `risk: high`).
- `hooks.json`: writes a new PreToolUse matcher entry.
- Run pane mod (`run-pane.tsx`, its routing module): reads forge.yaml at each spawn, rewrites `subagentType`, model and effort at `agent.spawn`, observes `agent.offer`, and writes the routing record and band notes. A sensitive path (`hooks/**`).
- State contract (`types/index.d.ts`): migrates `RunPaneNotes` (adds `roster`) and `AgentRouting` (adds `agent`).
- `/forge` help panel (`forge.tsx`, `forge/help.ts`): reads the resolved roster.
- Agents `implementer`, `prototyper`, `spec-writer`: their slot call sites are rewritten, and spec-writer's prompt list gains the codebase-design slot line. `reviewer`, `researcher`, `verifier` and `merger` are unchanged.
- Skills `wayfinder`, `intent`, `spec`, `slice-review`: their slot call sites and policy-skill reading are rewritten. `build` and `MEMBERS.md` are unchanged.
- `ROLES.md` (new, beside `MEMBERS.md`): written. Holds the role contracts and the slot rule.
- `init` skill and its forge.md template: the Policy skills answer is written to `forge.yaml`'s `slots.policy`; the forge.md section is removed.
- `GLOSSARY.md`, `docs/design.md`, `docs/adr/` (0024), `CLAUDE.md` (one clause), README, `hooks/ROUTING.md`: written.
- `.claude-plugin/plugin.json`: writes version 0.8.0 and the description. A sensitive path (`.claude-plugin/**`, `risk: high`).
- Tests under `tests/`, mod tests under `hooks/`, guardrails evals: written and extended.
- Claude Code engine: is called through `agent.spawn` (type rewrite), `agent.offer` (observed) and PreToolUse deny decisions.
- prior-sdlc plugin: is called by nothing in this effort. It receives the port section.

## Flagged concerns

- none

## Assumptions to confirm

- recommended: on a swap the mod appends one line, `role contract: <plugin root>/skills/build/ROLES.md#<role>`, to the spawn's prompt, so the replacement reaches the role contract; this revises The forge.yaml schema's "brief unchanged" (source: owner at Gate 2, settling the writing-for-agents flagged concern)
- recommended: the first slice is a spike proving the two live hypotheses before the rest builds on them: the mod's `subagentType` rewrite at `agent.spawn` passes auto mode, and the mod bundler loads the shared `.mjs` parser from a `.ts` file (source: Rewriting a call's target; YAML without a dependency)
- recommended: whether a swapped-in implementer completes a slice from the brief with its `role contract:` line is checked by hand once at Gate 4, not by an automated proof; the role-contract doc is the guard (source: Rewriting a call's target)
- recommended: `/forge-sdlc:init` writes `forge.yaml` with `version: 1` and `slots.policy` from its policy-skills question; every other roster key stays optional and untouched by init (source: owner at Gate 2, overturning the intent's "init does not write forge.yaml"; workflow-as-code The workflow schema, Q3)
- recommended: forge.md `## Routing` and `## Policy skills` are removed in the minor version after this one ships; the toast names `forge.yaml` and the key to move (source: The forge.yaml schema)
- recommended: `roster-guard.mjs` prints no decision when there is no `forge.yaml` or `enforce` is not `true`, so hosts without a roster pay nothing (source: Enforcement scope)
- recommended: the ADR is 0024, "The roster in forge.yaml", with a `Decision:` line in `docs/design.md` amending the forge.md-only convention in CLAUDE.md (source: CLAUDE.md Conventions)
- recommended: the spec carries a short port section for prior-sdlc (schema, parser file, hook, mod change) and no code outside this repo (source: Destination)
- recommended: `plugins/forge-sdlc` bumps to 0.8.0, a minor, since a new host file and a new hook ship (source: CLAUDE.md)
- recommended: the test seam is the shared roster reader's two functions, `parseYamlSubset` and `resolveRoster`, crossed by every consumer; the guardrail `check`, the mod's `agent.spawn` over the stand-in host and bin scripts over a fixture host are the existing seams beside it (source: The forge.yaml schema; codebase-design)
- recommended: the YAML parser and the roster resolution live in the one pure no-import `.mjs`, and the model and effort validators move into it from the run pane's routing module, so there is no mirror and no import between pure files (source: YAML without a dependency)
- recommended: `lib.mjs` gains `readRoster(hostDir)` and `run(check)` is unchanged, so only scripts that need the roster read it (source: the codebase, `lib.mjs` `run`)
- recommended: forge.yaml wins over `## Routing` key by key, a bullet for a key the roster leaves unset still applying while deprecated, and `slots.policy` replaces `## Policy skills` whole (source: intent Constraints)
- recommended: `## Routing` bullets for non-role types such as `Explore` have no roster equivalent and stop working when the section is removed; the deprecation toast says so (source: intent Constraints, roles cannot be added)
- recommended: the implementer and the prototyper run `bin/roster.mjs` at their own call sites; the spec skill resolves `spec-writer.codebase-design` and `policy` and passes them in the spec-writer's prompt, since the spec-writer has no Bash; slice-review resolves `policy` for the reviewer (source: ADR 0011, the agents' tool lists)
- recommended: the slot rule is written once, in `ROLES.md` `## Slots`; each call site is one line naming its slot, its default skill and the roster command, so the existing text tests on the default names keep holding and a change to slot resolution is a one-place edit (source: writing-for-agents; the codebase, `tests/build.test.mjs`, `tests/wayfinder.test.mjs`, `tests/intent.test.mjs`)
- recommended: `bin/roster.mjs <slot>` prints one line, `policy` comma-separated or `none`; exit 0, 2 on bad usage (source: `bin/crew-name.mjs`, forge.md's `listOf` reading)
- recommended: the mod swaps only to a type the session's `agent.offer` events offered, else spawns the default and reports the entry; the first slice's spike confirms `agent.offer` covers plugin and host-local types (source: Rewriting a call's target, `agent.offer` findings)
- recommended: fork, `resume` and workflow-agent spawns keep their type (source: Rewriting a call's target, `AgentSpawnInput` findings)
- recommended: in the guard a plugin-qualified entry matches exactly and a bare entry matches that name with or without a plugin prefix (source: none)
- recommended: an Agent call with no `subagent_type` is treated as `general-purpose` by the guard (source: none)
- recommended: only the literal `enforce: true` enforces; another value is a reported problem and not enforced, a file too broken to read `enforce` is not enforced and the band warns (source: Enforcement scope)
- recommended: a missing or unsupported `version` is reported and the file is still read entry by entry as version 1, so enforcement neither drops silently nor locks out (source: The forge.yaml schema; Enforcement scope)
- recommended: init keeps its policy-skills question and writes the answer to `forge.yaml`'s `slots.policy`; its forge.md template drops `## Policy skills`, which is deprecated (source: owner at Gate 2)
- recommended: the deprecation toasts fire only when `## Routing` has bullets or `## Policy skills` holds a value other than `none` (source: `hooks/ROUTING.md`, a missing section says nothing)
- recommended: the role-contract reference is `ROLES.md` beside `MEMBERS.md`, written for the owner and linked from `hooks/ROUTING.md` and the README; `MEMBERS.md` stays unchanged, as the intent requires (source: The forge.yaml schema; intent Outcome)
- recommended: the state contract gains `RunPaneNotes.roster` and `AgentRouting.agent` only (source: the codebase, `types/index.d.ts`)
- recommended: CLAUDE.md changes by one clause in its host-config convention, the roster's detail living in `hooks/ROUTING.md`, since CLAUDE.md is always in context (source: writing-for-agents)
