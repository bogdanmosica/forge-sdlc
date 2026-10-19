---
effort: cmux-members
stage: spec
status: accepted
risk: high
updated: 2026-10-19
---

# Spec: Visible implementers as cmux members

Intent: [intent.md](intent.md). Map: [map.md](map.md).

This spec replaces, whole, the spec of the first intent, which made crew.sh the transport; ticket 07 superseded it. Slice 02 of the first plan, the guardrail hooks finding the host state through git (`test-frozen` and `spec-frozen` read `.forge/state.json` from the parent of the edited file's checkout's git common dir), is already merged on `feat/cmux-members` (871b8ac) and stays. This spec builds on it and changes only its wording (see Implementation Decisions, "Slice 02 wording").

## Problem Statement

The owner of a host repo runs the loop from a lead in cmux, and the Claude button now starts that lead with agent teams enabled. Every agent the loop starts (researcher, prototyper, spec-writer, implementer, verifier, merger, reviewers) still runs as an unnamed background subagent, so the owner sees nothing: no pane, no row in the Crew panel, no way to click into a slice that is slow or stuck. Under a teams lead, a named Agent call would already open a visible pane, but the loop names none of its calls.

The live check (ticket 09) also found a gap in the Stop gate. A subagent's `SubagentStop` payload carries the directory the harness assigned it (the lead's root), never the worktree it `cd`'d into. So `verified-before-stop` has never gated a subagent implementer: it reads the effort branch, finds no slice, and allows the stop. Only the implementer's own step 5 has held that line.

## Solution

Every agent the loop starts is a **member**: an Agent call carrying a `name` drawn from the host's **crew theme**, one pool per role. Before each Agent call the dispatching skill runs `bin/crew-name.mjs`, which picks the role's next free name, records it in the effort's state, and prints it in the form the Agent tool accepts. Under a teams lead the call opens a visible pane under that name, listed in cmux's Crew panel. The lead learns that the member finished from the teammate's mailbox messages, and ends the teammate through the agent-teams shutdown request once its work is settled. Under a plain lead the same call runs as the subagent it always was, and only the name in the report is new.

Names are display only. The brief never tells an agent its name, and branches, commits, worktrees and records keep `<slug>-<nn>`. A slice keeps its implementer's name across fix rounds and resumes, and the Gate 4 report reads `<slug>-<nn>: <name>` per slice. `/forge-sdlc:init` asks the theme once: none, one of five presets carried over from prior-sdlc, or a free-text theme. `docs/agents/forge.md` holds the answer under `## Crew`.

The Stop gate holds for every implementer. In a pane it gates through the worktree cwd, as it does today. As a subagent it gates through the agent id the lead records on the slice right after the Agent call: on `SubagentStop`, when the cwd names no slice, `verified-before-stop` finds the slice whose `agent` matches the payload's `agent_id` and gates on that slice's verify record, as it does in a slice checkout.

## User Stories

1. As the owner running `/forge-sdlc:build` from a teams lead, I want one pane to open per frontier slice, so that I can watch each implementer work.
2. As the owner, I want each implementer's pane titled with a name from my crew theme, so that I can tell the slices apart at a glance.
3. As the owner, I want cmux's Crew panel to list every member of the run, so that I see which agents are running and which are idle.
4. As the owner, I want to click into a member's pane and read what it is doing, so that I can see why a slice is slow or stuck.
5. As the owner, I want the verifier and the merger the build starts to be named members too, so that the merge side of the build is visible as well.
6. As the owner running `/forge-sdlc:wayfinder` from a teams lead, I want each research ticket's researcher to open as a named pane, so that I can watch the research run in parallel.
7. As the owner running `/forge-sdlc:spec`, I want the spec-writer to be a named member, so that I can follow the synthesis.
8. As the owner, I want the prototyper to take a name too while it keeps its own throwaway worktree, so that a prototype never writes into my main checkout.
9. As the owner, I want the Gate 4 report to read `<slug>-<nn>: <name>` for every slice, so that I know which member built which slice.
10. As the owner, I want a slice to keep its implementer's name across fix rounds and a resumed build, so that one slice has one name for the whole build.
11. As the owner, I want a pool that runs out to restart with a number (`Scotty-2`), so that a long build never stops for lack of names.
12. As the owner, I want a name with a space or an apostrophe ("Seven of Nine", "O'Brien") turned into a form the Agent tool accepts (`Seven-of-Nine`, `OBrien`), so that a theme never breaks a spawn.
13. As the owner, I want a member's pane ended once its slice merges or goes red, so that panes do not pile up across a build.
14. As the owner, I want every other member's pane ended once the lead has acted on its report, so that the workspace holds only agents still at work.
15. As the owner, I want the build to stay unattended with named members, so that nothing between Gate 3 and Gate 4 needs me.
16. As the owner of a host with a plain lead, I want `/forge-sdlc:build` to run as before, so that I notice nothing beyond a name in the report and a Stop gate that now holds.
17. As the owner of a host with a plain lead, I want a subagent implementer that stops without a fresh green verify record to be blocked with the verify-record command, so that "done" is a record and not a claim in this transport too.
18. As the owner with a teams lead, I want a pane implementer that stops without a fresh green record to be blocked the same way, so that both transports hold the same gate.
19. As the owner, I want a subagent implementer refused three times to stop red and be marked red, so that the agent-id gate ends the same way the cwd gate does.
20. As the owner running `/forge-sdlc:init`, I want to be asked `Crew theme: which theme names the agents while they run?` with None, a preset, or my own theme, so that I choose the names once.
21. As the owner picking a preset, I want the five prior-sdlc themes (Warcraft, Star Trek, Star Wars, Game of Thrones, Super Mario), so that the names I know carry over.
22. As the owner typing my own theme, I want init to fill a pool for every role with characters of that theme, so that a free-text theme names every member.
23. As the owner typing a preset's name as free text ("Mario"), I want it read as that preset, so that I am not forced through the preset pages.
24. As the owner re-running init, I want the theme question to lead with my current theme, so that a re-run keeps my choice by default.
25. As the owner, I want `## Crew` in `forge.md` to hold only `theme` and optional per-role `names` overrides, so that the section stays readable and hand-editable.
26. As the owner, I want to override one role's pool by hand in `forge.md`, so that I can rename, say, the implementers without leaving a preset.
27. As the owner of a host set up before this change, I want a missing `## Crew` section to name implementers `<slug>-<nn>` and the others after their role, so that panes are still told apart without re-running init.
28. As the owner, I want `bin/forge-config.mjs` to print the `## Crew` section, so that I can check what the loop will read.
29. As the owner, I want the README to say in one line that a lead launched with agent teams enabled is what makes the names visible, so that I know why panes do or do not appear.
30. As the lead running build, I want one command that gives me the next name of a role and records it, so that I never track pools or used names myself.
31. As the lead, I want the slice's existing name back when I start an implementer for a slice that already has one, so that resumes and fix rounds reuse it without my asking.
32. As the lead, I want to record each implementer's agent id on its slice right after the Agent call, so that the Stop hook can find the slice a stopping subagent built.
33. As the lead under a teams lead, I want to treat the teammate's `idle_notification` as the member's report, so that my wait rests on the agent-teams protocol rather than a task notification that never comes.
34. As the lead, I want the member call described once, in one reference every dispatching skill points to, so that build, slice-review, wayfinder and spec start members the same way.
35. As the merger, I want the reviewers, the fix implementer and the verifier I start through slice-review to carry names from the same theme, so that every agent of the loop is a member.
36. As the merger, I want to start the fix implementer in the background and record its agent id before it can stop, so that the Stop gate holds for a fix round as it does for a first build.
37. As the merger, I want to clear the slice's agent id when I mark it merged or red, so that a stale id never gates a later stop.
38. As the implementer, I want my brief unchanged and my name kept out of it, so that I behave the same as a pane or a subagent.
39. As the implementer, I want my step 1 to keep "your first Bash call is `cd <worktree>`", so that in a pane the Stop hook still reads my slice branch from my working directory.
40. As the implementer running as a pane, I want the host config and state found from my project dir, the lead's root, so that the guardrails read the same files as for a subagent.
41. As a maintainer, I want name picking, the pools, the overrides, the handle form, the run-out numbering and the state record behind one script, so that the skills call one command and the behaviour changes in one place.
42. As a maintainer, I want the name script tested at its process boundary over fixture hosts, so that `npm test` pins every naming rule without a model call.
43. As a maintainer, I want the agent-id branch of `verified-before-stop` tested at its stdin/stdout seam and carried by its own guardrail eval case, so that the one hook change of this effort is pinned the way every hook is.
44. As a maintainer, I want the presets file checked structurally (five presets, eight roles, the pool sizes), so that a broken preset fails `npm test` instead of a spawn.
45. As a maintainer, I want the member transport and the agent-id gate recorded as `Decision:` lines in the design and as ADRs, so that the repo's convention for design changes holds.
46. As a maintainer, I want the slice-02 wording that called a member's project dir the slice worktree corrected, so that the docs match what the live check showed.

## Implementation Decisions

**The name script, `bin/crew-name.mjs` (new).** One deep module between the skills and the crew theme. Interface: `crew-name.mjs <role> --project <host> --effort <slug> [--slice <slug>-<nn>]`. It prints one line, the member's name in handle form, and exits 0; it exits 2 on bad usage (an unknown role, a missing flag). `<role>` is one of the eight pools: `researcher`, `prototyper`, `spec-writer`, `implementer`, `verifier`, `reviewer`, `merger`, `general`. Behind the interface:

- It reads `## Crew` from the host config and resolves the role's pool. A `names.<role>` override comes first. Otherwise it takes the preset the `theme` names, from the plugin's presets file. A host with no `## Crew`, `theme: none`, or a free-text theme without names for that role gets the fallback: `<slug>-<nn>` for an implementer called with `--slice`, `<role>` for every other call.
- It picks the first name of the pool not yet in the effort's `crew.<role>` list. When the pool has run out it starts again with `-2` appended, then `-3`. The fallback `<role>` numbers the same way (`verifier`, `verifier-2`), so two members of one role running at once still differ.
- With `--slice`: when the slice already has a `member`, it prints that name and records nothing new, so fix rounds and resumes reuse it. Otherwise it picks as above and writes the name to both `crew.<role>` and the slice's `member`.
- It emits the **handle form**: diacritics folded to ASCII, a space becomes `-`, every character other than letters, digits, `_` and `-` is dropped, and runs of `-` collapse. "Seven of Nine" becomes `Seven-of-Nine`, "Miles O'Brien" becomes `Miles-OBrien`, "Bowser Jr." becomes `Bowser-Jr`, "Padmé Amidala" becomes `Padme-Amidala`. Pools are stored in display form and compared in handle form.
- It writes state with `readState`/`writeState` from the hooks' lib, on `efforts.<slug>`, with `updatedAt` now. When the effort has no record in state, it prints the name and records nothing.

**The presets file, `crew.json` (new, in the plugin root).** It holds the five prior-sdlc themes under the ids `warcraft`, `star-trek`, `star-wars`, `got`, `mario`, each with a label and the eight forge pools rebuilt from prior-sdlc's: research to researcher, prototype to prototyper, spec to spec-writer, implementer to implementer, code-reviewer to reviewer, merger to merger, legacy-research to verifier, and implementer-markup together with prior-sdlc's general to general. Every pool holds at least three names and the implementer pool at least five. Where prior-sdlc's pool is shorter (every merger pool, Super Mario's spec pool), names from the same world are added. Names are stored in display form.

**State schema.** In `.forge/state.json` an effort gains `crew: { "<role>": ["<name>", …] }`, the handle-form names used so far. Each slice gains `member` (its implementer's name, or absent) and `agent` (the id of its current implementer, or absent). Both are additive: an absent field reads as none, and no migration runs. `docs/contracts.md` changes first (the state shape, the Names table rows for `crew-name.mjs` and `crew.json`), then the code. Design section 9's state line follows.

**Host config.** `docs/agents/forge.md` gains `## Crew` with `- theme: <preset id | none | free text>` and, optionally, one `- names.<role>: <name>, <name>, …` bullet per overridden role, names in display form, comma-separated. Nothing else lives there. `parseForgeConfig` already parses any section and any key, so `bin/forge-config.mjs` prints it as `crew` with no change. The init template gains the section with `- theme: none`, and design section 8 gains it.

**Init.** One new question after Policy skills, header `Crew`: `Crew theme: which theme names the agents while they run?`, with the options `None` (maps to `none`), `A preset`, and `My own theme`. `A preset` pages through the same dialog: `Warcraft`, `Star Trek`, `Star Wars`, `More presets`, then `Game of Thrones`, `Super Mario`, each mapped to its id. Free text that names a preset, in any case, maps to its id. Any other free text is the theme as typed, and init writes a `names.<role>` bullet for each of the eight roles with characters of that theme (at least five implementers and three of every other role). Init derives nothing for this section. On a re-run, the question leads with the current theme. This is prior-sdlc's question 8, minus its flags and script.

**The member call, written once.** A members reference beside the build skill defines the **member** call, and every dispatching skill (build, slice-review, wayfinder, spec) points to it by name at each Agent call it makes, naming the role. The reference says:

- Before the Agent call, run `crew-name.mjs <role>` (with `--slice` for an implementer) and pass its line as the call's `name`.
- After an implementer's call, write the id the Agent result names as the slice's `agent`.
- Under a plain lead a call is foreground or background as the skill says. Under a teams lead every member runs in the background (the Agent tool has no `run_in_background` there). Either way the wait is "the member's report arrives": the task notification or the foreground return under a plain lead, the teammate's `idle_notification` mailbox message, whose `result` is its final message, under a teams lead. The verify record stays the evidence under both.
- Under a teams lead the lead ends a teammate through the agent-teams shutdown request (a `SendMessage` shutdown request to the member's name). It ends an implementer after its slice merges or goes red, and any other member once the lead has acted on its report. Under a plain lead there is nothing to end.

The skills say neither "teammate" nor "task notification" outside this reference.

**Build skill.** Step 2's researcher, step 4's implementers, the verifier and step 5's merger become member calls with roles `researcher`, `implementer`, `verifier` and `merger`. Step 4 records `agent` after each implementer call. After a merger reports `merged` or `red`, the lead ends that slice's implementer. The Gate 4 report adds one line per slice, `<slug>-<nn>: <member>`. The wording "one foreground Agent call" becomes "one member call" whose wait the reference defines.

**Slice-review skill.** The three reviewer calls are member calls with role `reviewer`, and the verifier call one with role `verifier`. The fix implementer is a member call with role `implementer` and `--slice`, so it reuses the slice's name. It runs in the background, so the merger can write its `agent` on the slice before the implementer can stop; then the merger waits for its report. A foreground call returns the id only after the subagent's `SubagentStop` has already fired. The step's completion criterion stays: the implementer reported and the slice branch has a commit after the reviewed sha. Here the merger is the lead of the reference.

**Wayfinder and spec skills.** Research tickets are member calls with role `researcher`, and the spec-writer one with role `spec-writer`. The prototyper is a member call with role `prototyper` that also passes `isolation: "worktree"` on the call. That keeps it a subagent in its own worktree under a teams lead: a teammate ignores the frontmatter `isolation` and would run in the main checkout.

**Merger agent.** Its description drops "one foreground call per slice", since the merger is a member whose transport the lead decides. Step 4 (red) and step 3 (merged) also clear the slice's `agent`. The merger adds no other step; slice-review, which it follows by file, carries the member calls.

**Implementer agent.** No change. Step 1 keeps "your first Bash call is `cd <worktree>`" and its reason (the Stop hook reads the branch of the working directory), which holds as stated for a pane. The brief never learns its name or its transport.

**Hook: `verified-before-stop` gates a subagent by its agent id (the one hook change).** The cwd branch stays first and unchanged. When the payload is `SubagentStop`, carries an `agent_id`, and its cwd names no slice, the hook finds the host through git from the cwd (the lib's `hostDirOf`, falling back to the project dir). It then reads the host's state and looks for the slice, in any effort, whose `agent` equals `agent_id`. No match, or a match whose worktree `.forge/worktrees/<slug>-<nn>` no longer exists, allows as now. A match is gated exactly as a slice checkout is: fresh and green at the worktree's HEAD lets the stop through and clears the denials; otherwise the stop is blocked with the verify-record command naming that worktree and host, up to three times, after which one stop passes with the red reason. The red pass also clears the slice's `agent` beside writing `status: red`. The reason names the slice and its branch `slice/<slug>-<nn>`, never the agent id. Risk high: the hook's guardrail suite gains the agent-id case.

**Slice 02 wording.** The lookup through git that slice 02 merged stays: it is correct for any session whose project dir is a slice worktree, and harmless where the project dir is the main checkout. Its rationale ("a member's project dir is its slice worktree") was written for crew.sh and is false under the new glossary: a pane teammate's `CLAUDE_PROJECT_DIR` is the lead's root. Design section 7's Decision line, the lib's `hostDirOf` comment, the eval host helper's comment, the README's guardrails row, the two `*-member-denied` case descriptions and the two test names are reworded to "a session whose project dir is a slice worktree". The case folder names stay, so eval history keeps its keys.

**Design record.** Design section 5 (build, wayfinder, spec and slice-review frames) gains the member call and a `Decision:` line pointing to a new ADR, "Agents as named members". It records agent teams over crew.sh, names on every Agent call with no detection, display only, the crew theme, the wait on the agent-teams protocol, and shutdown on settle. Section 6 notes that every agent runs as a member. Section 7's `verified-before-stop` row gains the agent-id branch, plus a `Decision:` line pointing to a second new ADR, "The Stop gate finds a subagent's slice by its agent id". Section 8 gains `## Crew`, section 9 the state fields, section 11 the presets file and the script. CLAUDE.md's Commands list gains one line for `crew-name.mjs`, as it has for every other `bin/` script. The README gains one line saying that a lead launched with agent teams enabled (as `cmux claude-teams` does) is what makes the names visible, and the hooks table notes the agent-id branch. The glossary already defines **lead**, **member** and **crew theme**.

## Testing Decisions

A good test crosses the module's own seam and checks only what a caller sees: the line on stdout, the exit code, the state file, the hook's JSON decision. Nothing asserts on internals such as how the pool is searched or how diacritics are folded, only on the names that come out.

- **`crew-name.mjs`, at its process boundary** (the one new seam), over fixture hosts from the test support helper with `forge.md` and `state.json` written per case, against the shipped presets file:
  - a preset theme prints the role's first name in handle form and records it under `crew.<role>`; a second call prints the next one;
  - a pool run out restarts with `-2`, then `-3`;
  - `--slice` on a slice without a `member` picks a name and writes it on the slice; a second call with the same `--slice` prints the same name and records nothing new;
  - a `names.<role>` override replaces that role's pool and leaves the others on the preset;
  - a free-text theme with `names` bullets uses them, and a role it does not name falls back;
  - no `## Crew` and `theme: none` print `<slug>-<nn>` for an implementer with `--slice`, and `verifier` then `verifier-2` for two verifier calls;
  - handle form: "Seven of Nine" is `Seven-of-Nine`, "Miles O'Brien" is `Miles-OBrien`, and every printed name matches letters, digits, `_` and `-` only;
  - an effort absent from state prints a name and leaves the state file unchanged; an unknown role and a missing flag exit 2.
  - Prior art: `tests/verify-record.test.mjs` (a `bin/` script on a fixture host), `tests/effort-state.test.mjs` (stdout and exit codes of a `bin/` script).
- **The presets file, structurally:** the five ids with their labels, the eight roles in every preset, every pool at least three names and every implementer pool at least five, and handle forms unique within a pool. Prior art: `tests/manifests.test.mjs`.
- **`verified-before-stop`, at its stdin/stdout seam**, with a slice worktree and a state whose slice carries `agent`, and a `SubagentStop` payload whose cwd is the host on `feat/<slug>` and whose `agent_id` matches. Without a record it blocks, naming the slice's worktree and the host. A green record at the worktree's HEAD lets the stop through. Three blocks, then the red pass marks the slice `red` and clears its `agent`. An unmatched `agent_id`, a `Stop` payload with an `agent_id`, and a matched slice whose worktree is gone all allow. Every existing case stays green unchanged. Prior art: `tests/verified-before-stop.test.mjs`.
- **Guardrail eval case:** a new case, `verified-before-stop-agent-blocks`, with its own fixture (a host on `feat/<slug>`, a slice worktree, the slice's `agent` in state), a `seam.json` with the `SubagentStop` and `agent_id` shape and `expect: block`, and a `hook-*` grader naming the slice. `tests/evals.test.mjs` runs it. Prior art: the `verified-before-stop-blocks` case and slice 02's `*-member-denied` cases.
- **Host config:** `parseForgeConfig` reads `## Crew` as `crew.theme` and `crew["names.<role>"]`, and the init template carries the section. Prior art: `tests/config.test.mjs`.
- **Skills and agents, structurally:** the members reference exists and names `crew-name.mjs`, `name`, the `agent` write, the report wait and the shutdown request. Build, slice-review, wayfinder and spec link it at their Agent calls with their roles. Build has the Gate 4 member line and the shutdown after merged or red. Slice-review has the background fix call with `--slice` and the `agent` write. Wayfinder's prototyper call passes `isolation`. Init has the Crew question with the five presets. The merger clears `agent`, and the implementer still says "first Bash call is `cd <worktree>`". Prior art: `tests/build.test.mjs`, `tests/slice-review.test.mjs`, `tests/wayfinder.test.mjs`, `tests/spec.test.mjs`, `tests/agents.test.mjs`.

## Out of Scope

- Any change to cmux-config, including tracking crew.sh there, its hooks and its sidebars.
- crew.sh as a transport, and the two `crew.mjs` slices of the first plan, which are closed.
- Telling an agent its own name, or naming branches, commits, worktrees or records after it.
- Detecting a teams lead: the loop always names its calls, and a plain lead runs them as subagents.
- A `TeammateIdle` hook: `Stop` and `SubagentStop` already fire in a pane with the worktree cwd.
- Showing member names in `/forge-sdlc:status`.
- How a public host of forge-sdlc learns to launch a teams lead, beyond the one README line.
- Pane cleanup beyond the shutdown request (team deletion, a pane mod, closing panes by hand).

## Further Notes

- **Security considerations.** A pane teammate is a separate session. It starts with the lead's permission mode, loads the project's settings and hooks, and keeps the definition's denied tools (Agent and AskUserQuestion held in the live check), so the implementer's tool scoping is the same in both transports. The handle form leaves only letters, digits, `_` and `-`, so a name from a hand-edited `forge.md` is safe in the roster, in the mailbox file name `~/.claude/teams/<team>/inboxes/<name>.json` and in any shell line. The agent id written to state is a harness-assigned id, never a credential. The hook's reason never quotes it.
- **Hypotheses the first build from a teams lead confirms.** Neither the docs nor the live check settle these:
  - a pane teammate (the merger) keeps the Agent tool and can start subagents;
  - its nested named calls accept a name that an idle teammate already holds (the slice's implementer during a fix round);
  - a background call inside the merger brings its completion back to the merger;
  - whether one blocked stop in a pane fires both `Stop` and `SubagentStop`. If it does, the hook counts two denials per stop and the slice goes red after two refused stops instead of three. It still ends red, never merged.

  The verify record and the merger's freshness check are the backstop under each reading.
- **Concurrent state writes.** The lead, the merger and `crew-name.mjs` each write `state.json` read-modify-write. The atomic rename prevents a torn file, not a lost update. A lost `crew` entry costs a reused name. A lost `agent` costs one ungated subagent stop, which the merger's evidence step still catches.
- The map's "Not yet specified" items are settled or dropped by the second intent: agent teams is now the only transport; init asks the theme, whether or not cmux is installed; the per-slice transport line became the per-slice member line; publishing stays one README line.
- The frame eval suite needs no `## Crew`. The eval harness runs non-interactively, where a named call runs as a subagent even with agent teams enabled, so a frame run opens no pane.

## Affected users and systems

- Owner running the loop from a teams lead: sees a named pane and a Crew panel row per member, panes ended as their work settles, and a member line per slice in the Gate 4 report.
- Owner running a plain lead: no visible change beyond the member line in the report; subagent implementers are now held by the Stop gate.
- Owner running `/forge-sdlc:init`: one new question (crew theme) and one new `## Crew` section in `docs/agents/forge.md`.
- `bin/crew-name.mjs` (new): reads `docs/agents/forge.md` `## Crew`, the presets file and `.forge/state.json`; writes the effort's `crew` and the slice's `member` in state; is called by the build, slice-review, wayfinder and spec skills.
- `crew.json` (new, plugin root): is read by `crew-name.mjs` and the init skill.
- `verified-before-stop` hook (risk high): reads `.forge/state.json` for the slice whose `agent` matches a `SubagentStop`'s `agent_id`; reads that slice's verify record and denials; writes the denials count and, on the red pass, the slice's `status` and `agent`.
- `.forge/state.json`: migrates additively; efforts gain `crew`, slices gain `member` and `agent`.
- Build skill: calls `crew-name.mjs`; writes `agent` on each slice; waits on member reports; ends implementer teammates on merged or red; reports a member line per slice.
- Slice-review skill: calls `crew-name.mjs` for reviewers, the fix implementer and the verifier; starts the fix implementer in the background; writes its `agent`.
- Wayfinder skill: calls `crew-name.mjs` for researchers and the prototyper; passes `isolation` on the prototyper call.
- Spec skill: calls `crew-name.mjs` for the spec-writer.
- Members reference (new, beside the build skill): is read by the four dispatching skills.
- Init skill and its template: ask the crew theme; write `## Crew`.
- Merger agent: description reworded; clears `agent` on merged or red.
- Implementer agent: unchanged; is called by the build and by slice-review as a member.
- Claude Code agent teams (external): is called by every named Agent call under a teams lead; delivers the teammate's report and `idle_notification` to the lead's mailbox; receives the lead's shutdown requests.
- cmux (external, unchanged): renders each teammate as a pane and lists it in the Crew panel from the team roster.
- `docs/contracts.md`, `docs/design.md` sections 5, 6, 7, 8, 9 and 11, two new ADRs, CLAUDE.md Commands, README: updated.
- Slice 02's hooks, lib comment, eval helper, the two `*-member-denied` cases and their tests: reworded only.
- Guardrail eval suite: gains the `verified-before-stop-agent-blocks` case.

## Flagged concerns

- writing-for-agents: the user-level `cmux-crew` skill's always-loaded description triggers on a "cmux team or crew" and "visible" sessions, and names "slice-review", "implementer/merger" and "crew theme" as prior-sdlc's own. forge-sdlc now uses the same leading words (member, crew theme) for its named Agent calls. On a teams lead, that pointer can pull the lead toward crew.sh, or toward keeping plain subagents, when the owner asks to watch a build. It lives in cmux-config, which is out of scope, so the spec cannot sharpen its wording (section: Out of Scope). Settled on 2026-10-19: cmux-config commit f762734 names each pipeline and says forge-sdlc's members are Agent calls, never crew.sh.

## Assumptions to confirm

- recommended: the crew presets live in the plugin as `crew.json`, the five prior-sdlc themes with pools rebuilt for the eight forge roles, each pool at least three names and the implementer pool at least five, every name stored in display form and emitted by the script in handle form (letters, digits, `_`, `-`; a pool run out appends `-2`) (source: ticket 07; live check run 2, name charset)
- recommended: used names are recorded per effort in `state.json` under `crew: { "<role>": ["<name>", …] }` next to the slices, a slice's name under its `member` field and its implementer's id under `agent`, so a resumed build and a fix round reuse the name and the hook finds the slice (source: ticket 07, question 4; ticket 10)
- recommended: a host whose `forge.md` has no `## Crew` section, or `theme: none`, gets `<slug>-<nn>` as the implementer's name and `<role>` for the others, so panes are still told apart (source: none)
- recommended: the build's wait for a member is the teammate's `idle_notification` mailbox message under a teams lead and the task notification under a plain lead; the skills describe the wait as "the member's report arrives", and the verify record stays the evidence under both (source: live check run 2, (a))
- recommended: after a slice merges or goes red, the lead ends its teammate through the agent-teams shutdown request, so panes do not pile up across a build; under a plain lead there is nothing to end (source: live check run 2, "idle, not shut down"; agent-teams docs)
- recommended: the first intent's accepted lines on `cd <worktree>` in the implementer's step 1 and on `forge.md` committed on the effort branch stand unchanged; the live check showed the teammate's `CLAUDE_PROJECT_DIR` is the lead's root, so the host config is read from the host in both transports (source: live check run 2, (b))
- recommended: `risk: high` stands for the one hook change of ticket 10, the only path under `hooks/**` this effort touches (source: ticket 10; forge.md Risk)
- recommended: `crew-name.mjs` takes an optional `--slice <slug>-<nn>` beside the intent's `<role> --project --effort`; with it the slice's existing `member` is printed, else the next name is picked and written to the slice, which is how a slice keeps its name across fix rounds and resumes; the script prints one line and exits 0, or 2 on bad usage (source: ticket 07, answer 4; intent assumption on `crew` and `member`)
- recommended: the fallback `<role>` name numbers like a pool run out (`verifier`, `verifier-2`), so two members of one role running at once still differ (source: intent assumption on the fallback; ticket 07, a pool run out restarts with a number)
- recommended: the handle form folds diacritics to ASCII, turns a space into `-`, drops every other character outside letters, digits, `_` and `-`, and collapses runs of `-`, matching the live check's `Miles O'Brien` to `Miles-OBrien` (source: live check run 2, (d))
- recommended: when the effort has no record in `state.json`, `crew-name.mjs` prints the name and records nothing, as the hooks stay quiet without state (source: docs/contracts.md, missing state)
- recommended: `## Crew` holds `- theme: <id | none | free text>` and one `- names.<role>: <name>, …` bullet per overridden role, names in display form, so the section keeps the host config's one `- key: value` line per bullet (source: ticket 07, answer 2; design section 8, bullet shape)
- recommended: init asks the crew theme as its last question, after Policy skills, with prior-sdlc's options and preset pages; free text naming a preset maps to its id, any other free text makes init write `names.<role>` bullets for all eight roles with characters of that theme (source: prior-sdlc init, question 8; ticket 07, answer 2)
- recommended: the member call is defined once in a members reference beside the build skill, and build, slice-review, wayfinder and spec point to it at each Agent call with the role, so the transport rules have one source of truth (source: writing-for-agents, single source of truth)
- recommended: the lead writes on the slice whatever id the Agent result names for every implementer, under both transports; in a pane the cwd branch gates the stop whether or not that id matches the teammate's `SubagentStop` `agent_id` (source: ticket 10; live check run 2, (b))
- recommended: slice-review starts the fix implementer in the background and writes its `agent` before waiting for its report, because a foreground call returns the id only after the subagent's `SubagentStop` has fired (source: ticket 10, "slice-review for a fix round"; slice-review step 4)
- recommended: the merger stays a member like every other agent, and its own calls (reviewers, fix implementer, verifier) are named member calls that run as its subagents, since only the main conversation launches teammates; a pane teammate keeping the Agent tool, its nested calls accepting the slice's name while the implementer teammate idles, and a background call inside the merger reporting back to it are hypotheses the first build from a teams lead confirms (source: docs/research/cmux-members/named-teammates-under-a-teams-lead.md, Q1; ADR 0009)
- recommended: the prototyper call passes `isolation: "worktree"` on the call itself, which keeps it a subagent in its own worktree under a teams lead, because a teammate ignores the frontmatter `isolation` and runs in the main checkout (source: docs/research/cmux-members/named-teammates-under-a-teams-lead.md, Q1)
- recommended: under a teams lead the lead ends every non-implementer teammate once it has acted on its report (the researcher after its note is committed, the spec-writer after spec.md passes the spec skill's step 2, the verifier after the record check, the merger after its report) (source: live check run 2, "idle, not shut down"; intent assumption on ending implementers)
- recommended: the agent-id branch runs only on `SubagentStop` with an `agent_id` whose cwd names no slice; it finds the host through git from the cwd, allows when no slice matches or the matched worktree is gone, and its red pass clears `agent` with `status: red`; the merger clears `agent` when it writes `merged` or `red` (source: ticket 10)
- recommended: in a pane both `Stop` and `SubagentStop` fire with the worktree cwd and the hook stays unchanged there; if one blocked stop fires both, a pane slice goes red after two refused stops instead of three, which the first teams build shows and which still never merges a bad slice (source: live check run 2, (b); intent, "the hook holds there unchanged")
- recommended: the agent-id seam is a new guardrail case, `verified-before-stop-agent-blocks`, with its own fixture and `seam.json`, because a case folder holds one `seam.json`, as slice 02 added its member-shaped cases (source: ticket 10; ticket 02 of the first plan, first assumption)
- recommended: slice 02's lookup through git stays and only its wording changes, from "a member's project dir is its slice worktree" to "a session whose project dir is a slice worktree", in design section 7, the lib comment, the eval helper, the README row, the two case descriptions and the two test names; case folder names stay (source: live check run 2, (b); GLOSSARY.md, member)
- recommended: the `crew-name.mjs` tests run against the shipped `crew.json`, which a structural test also checks, so the script takes no presets-path flag (source: intent Constraints, proof by node tests)
- recommended: the member transport gets a `Decision:` line in design section 5 and an ADR, the agent-id gate a `Decision:` line in section 7 and its own ADR, and CLAUDE.md's Commands list a line for `crew-name.mjs` (source: CLAUDE.md Conventions)
- recommended: the frame eval scaffold carries no `## Crew` pin, because the eval harness runs non-interactively, where a named call is a subagent even with agent teams enabled (source: docs/research/cmux-members/named-teammates-under-a-teams-lead.md, Q1, `-p` and the Agent SDK)
