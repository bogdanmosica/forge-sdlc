---
effort: cmux-members
stage: spec
status: accepted
risk: high
updated: 2026-10-18
---

# Spec: Visible implementers as cmux members

Intent: [intent.md](intent.md). Map: [map.md](map.md).

## Problem Statement

The owner of a host repo runs `/forge-sdlc:build` from a lead that lives inside cmux, and every implementer of the build disappears into a background Agent subagent. There is no tab to watch, no status in the Crew panel, and no way to click into a slice that is taking long or has stopped. During the first build of this plugin the owner got that view only by spawning a crew through crew.sh by hand, outside the loop, and wants the loop itself to give it. A host that is not in cmux must see nothing change.

## Solution

When the lead runs inside cmux, each implementer the build or the merger's fix loop starts is a **member**: a visible cmux session named `<slug>-<nn>` that hosts `forge-sdlc:implementer` in the slice's own worktree. The lead spawns it through crew.sh, waits for it through crew.sh's status and the slice's verify record, and closes its tab when the slice merges. A red slice's tab stays open for the owner to inspect. Anywhere else, or when crew.sh is missing, not executable, or fails to spawn, that slice's implementer is the Agent subagent it is today. The build report names, for every slice, whether it ran as a member or a subagent, and why it fell back when it did.

The implementer reads the same pointers, works in the same worktree, is held by the same Stop hook and is proven by the same verify record in both modes. One host knob, `## Crew` in `docs/agents/forge.md`, lets a host force either mode; init writes it with `mode: auto` and asks nothing.

## User Stories

1. As the owner running `/forge-sdlc:build` from a cmux lead, I want one tab to open per frontier slice, so that I can watch each implementer work.
2. As the owner, I want each tab named `<slug>-<nn>`, so that I can tell at a glance which slice it builds.
3. As the owner, I want the Crew panel to list every member of the build with its status, so that I see which slices are running, done or waiting on me.
4. As the owner, I want to click into a member's tab and read its transcript, so that I can see why a slice is slow or stuck.
5. As the owner, I want a member's tab to close when its slice merges, so that the workspace holds only slices still in flight or red.
6. As the owner, I want a red slice's tab to stay open after the build, so that I can read what the implementer did before it stopped red.
7. As the owner, I want the build to stay unattended with members, so that Gate 3 to Gate 4 still needs nobody.
8. As the owner, I want the Gate 4 report to name, per slice, whether it ran as a member or a subagent, so that I know what I could have watched.
9. As the owner, I want a slice that fell back to a subagent to say why in the report, so that I can fix a broken crew.sh.
10. As the owner, I want a failed spawn to fall back for that one slice only, so that one bad spawn does not cost me visibility of the others.
11. As the owner, I want members spawned with `--permission-mode auto`, so that an unattended member does not stop at its first permission prompt.
12. As the owner, I want a member that shows "needs you" to keep its slice waiting rather than be killed, so that I can unblock it in its tab.
13. As the owner, I want the slice's verify record, not the member's "done" status, to decide that a member finished, so that a stop the Stop hook blocked never sends a half-built slice to the merger.
14. As the owner, I want up to four "finished" wake-ups per slice to be harmless, so that a member that was blocked three times still merges once.
15. As the owner, I want a member that stops red after three blocks to be treated as finished red, so that the merger marks it red and the build moves on.
16. As the owner, I want a member whose session ended without a green record to be treated like a subagent that reported without one, so that the verifier and the merger still settle the slice.
17. As the owner resuming a build, I want the lead to await the members already running instead of spawning new ones, so that a resumed build does not double-build a slice.
18. As the owner resuming a build, I want the lead to close the right tab when a slice merges, so that a resumed build tidies the members an earlier run spawned.
19. As the owner, I want the records of closed members forgotten as they close, so that the Crew panel does not fill with finished slices.
20. As the owner, I want forge-sdlc to touch only the members it spawned, so that other crews in my workspace stay as they are.
21. As the merger, I want to start a fix-mode implementer through the same spawn as the build, so that fix rounds are visible too.
22. As the merger, I want to wait for a fix member in the foreground, within the Bash tool's limit, repeating until it settles, so that slice-review's fix loop keeps its order.
23. As the merger, I want the slice's previous member closed before a fix member is spawned, so that the fix member gets the name `<slug>-<nn>` and the slice has one live member.
24. As the implementer, I want the same pointers whether I am a member or a subagent, so that I behave the same in both.
25. As the implementer running as a member, I want every pointer to be an absolute path, so that pointers resolve even though my working directory is the worktree.
26. As the implementer, I want my step 1 to keep "your first Bash call is `cd <worktree>`" with a reason that holds for both transports, so that the Stop hook keeps reading my slice branch.
27. As the implementer running as a member in fix mode, I want the test-frozen hook to hold my tests still, so that fix mode means the same in a member as in a subagent.
28. As the implementer running as a member, I want the spec-frozen hook to protect the effort's intent, spec and plan, so that a member cannot rewrite the source of truth.
29. As the owner of a host outside cmux, I want `/forge-sdlc:build` to run exactly as before, so that I notice nothing.
30. As the owner of a host in cmux who wants subagents, I want `mode: agent` under `## Crew`, so that I can opt out without leaving cmux.
31. As the owner who expects members, I want `mode: crew` to report a fallback as a warning, so that a missing crew.sh does not go unnoticed.
32. As the owner of a host set up before this change, I want a missing `## Crew` section to read as `mode: auto` with the default script, so that I need not rerun init.
33. As the owner running `/forge-sdlc:init`, I want `## Crew` written as `mode: auto` and the default script without a question, so that setup stays as short as it is.
34. As the owner, I want `bin/forge-config.mjs` to print the `## Crew` section, so that I can check what the build will read.
35. As the owner, I want `docs/agents/forge.md` committed on the effort branch to be a stated build precondition, so that a member's hooks read the host config from its own checkout.
36. As the owner, I want forge-sdlc enabled at user or project scope to be a stated precondition of the member path, so that a member's session loads the implementer agent and its Stop hook.
37. As the owner running the frame evals from a cmux terminal, I want the eval fixture host to use `mode: agent`, so that an eval run never opens real tabs.
38. As a maintainer of forge-sdlc, I want detection, crew.sh's flags, the member record and the settle rule in one script, so that the skills call one command and the behaviour changes in one place.
39. As a maintainer, I want crew.sh tested through a fake that records its arguments and writes a report, so that `npm test` needs no cmux.
40. As a maintainer, I want the fallback tested with the cmux variable unset, the script missing, the script not executable and a failing spawn, so that every fallback reason is pinned.
41. As a maintainer, I want a Stop payload with a subfolder cwd tested against `verified-before-stop`, so that a member that `cd`s into a subfolder is still gated.
42. As a maintainer, I want the hook change, if it lands, carried by its own risk-high slice with a guardrail eval case, so that the intent's rule for hook changes holds.
43. As a maintainer, I want the member transport recorded as a Decision line in the design and an ADR, so that the repo's convention for design changes holds.

## Implementation Decisions

**The `crew.mjs` script (new, in the plugin's `bin/`).** One deep module between the lead and crew.sh, with three verbs. It reads the host config, applies the detection, wraps crew.sh, owns the slice's `member` field in `.forge/state.json`, and never makes the Agent call itself. Every verb prints one JSON object on stdout; exit 0 for an answer, 2 for bad usage, and `await` exits 2 on its own timeout too (crew.sh's convention). Its interface:

- `spawn --slice <slug>-<nn> --project <host> --task <file>`: decides the transport and, for a member, spawns it. Detection: `## Crew` `mode` is `auto` (the default) or `crew`, `CMUX_WORKSPACE_ID` is set, and the `script` path (default `~/.config/cmux/scripts/crew.sh`, `~` expanded) exists and is executable. Then it calls crew.sh `spawn` with role `forge-sdlc:implementer`, `--task @<file>`, `--repo <worktree>` (the contract worktree `.forge/worktrees/<slug>-<nn>` under the host), `--permission-mode auto`, `--name <slug>-<nn>`, and no `--worktree`, `--model` or `--effort`. It parses crew.sh's `MEMBER=… RECORD=…` line, writes `member: { id, record }` on the slice, and prints `{ "transport": "member", "member": { "id", "record" } }`. Any failed condition, `mode: agent`, or a crew.sh exit other than 0 prints `{ "transport": "agent", "reason": "<one line naming the condition>" }` and writes `member: null`. The reason names the variable, the path or the exit code, never crew.sh's full output.
- `await --slice <slug>-<nn> --project <host> [--timeout <s>]`: waits until the slice's member is **settled** and prints `{ "slice", "member", "settled": "green" | "red" | "ended", "report" }`. Settled `green`: `.forge/verify/<slug>-<nn>.json` is green, its `head` equals the worktree's HEAD, and `<slug>-<nn>.denials` is absent. Settled `red`: the slice's status in state is `red` and the denials file is gone. Settled `ended`: crew.sh reports the member `ended`, `closed` or unknown while neither holds. A crew.sh `done` with none of these is still running: `await` polls again, so the up-to-four `done` statuses a blocked member produces settle nothing. On `--timeout` it prints `{ "slice", "member", "settled": null }` and exits 2; the member keeps running.
- `close --slice <slug>-<nn> --project <host>`: closes the slice's member tab through crew.sh `close <id>` (never `--remove-worktree`; the merger removes the worktree), forgets that one record through crew.sh `forget <id>`, and writes `member: null`. A slice with no member is a no-op with exit 0, so callers close every merged slice without asking how it ran. It only ever names member ids from state, never `done`, `closed` or `all`, so other crews in the workspace stay untouched.

**State schema.** In `.forge/state.json` each slice gains `member`: `{ id, record }` while a member hosts it, `null` for a subagent or after `close`. `docs/contracts.md`'s state shape and its Names table (a row for `crew.mjs`) change first, then the code. Design section 9's state line follows.

**Host config.** `docs/agents/forge.md` gains a `## Crew` section with two bullets: `- mode: auto` (comment: or crew, agent) and `- script: ~/.config/cmux/scripts/crew.sh`. `parseForgeConfig` already parses any section, so `bin/forge-config.mjs` prints it as `crew` with no change. The init template gains the section, init derives it without a question, and design section 8 gains it. `mode` means: `auto`, members when detection passes, else subagents with the reason in the report; `crew`, the same, with a fallback reported as a warning line at the top of the Gate 4 report; `agent`, subagents always, crew.sh never called.

**One dispatch procedure, written once.** Build step 4 and slice-review's fix step both dispatch implementers. The dispatch is written once in a reference file beside the build skill and linked from both: write the implementer's pointer lines to the task file `.forge/notes/<slug>/members/<slug>-<nn>.md`; call `crew.mjs spawn`; on `member`, await it; on `agent`, make the Agent call with the same lines as its prompt. Every pointer line is an absolute path. Skill text names `crew.mjs` and its JSON answers only; crew.sh's flags live in the script alone.

**Build skill.** Precondition gains two lines: `docs/agents/forge.md` is committed on `feat/<slug>`, and forge-sdlc is enabled at user or project scope (a member loads the plugin from its own checkout). Step 4 follows the dispatch: for a member, one background `crew.mjs await` per member, so its exit (and cmux's wake-up message) brings the lead back. A settled `green`, `red` or `ended` member takes the existing verifier and merger steps unchanged. After a merger reports `merged`, the lead runs `crew.mjs close` for that slice; a red slice keeps its member. A resumed build (`stage: build`) awaits every `building` slice that has a `member` instead of spawning it again. The Gate 4 report adds one line per slice: `<slug>-<nn>: member <id>` or `<slug>-<nn>: subagent (<reason>)`, with `mode: crew` fallbacks as a warning line first.

**Slice-review skill.** The fix step dispatches the fix implementer through the same procedure. Before it spawns, it runs `crew.mjs close` for the slice, so the slice has one live member and the new one can take the name `<slug>-<nn>`. A member fix is awaited in the foreground with `--timeout 540`, rerun on exit 2 until settled, because the merger is a subagent and the Bash tool caps a foreground call at ten minutes. The step's completion criterion becomes: the implementer reported, or `crew.mjs await` settled, and the slice branch has a commit after the reviewed sha. The fix member's wake-up message reaches the lead's surface while the lead waits on the merger; the lead ignores it, because the merger's report decides.

**Implementer agent.** No change to what it does. Step 1 keeps "your first Bash call is `cd <worktree>`"; its reason is reworded to hold in both transports and stated positively: every Bash call runs inside the worktree, because the Stop hook reads the branch of the working directory. The brief never learns its transport.

**Merger agent.** No change: it follows slice-review by file, already resolves the plugin root for the scripts that file names, and has Bash for `crew.mjs`.

**Hooks: state found through git (the one hook change).** In a member, `CLAUDE_PROJECT_DIR` is the worktree, and `.forge/` is not in the worktree, so `test-frozen` and `spec-frozen` read no state and go quiet: fix mode would not freeze a member's tests, and a member could edit a frozen spec. ADR 0007 names the fix for exactly this case: find the main checkout through git, as `verified-before-stop` does. Both hooks read state from the parent of the edited file's checkout's git common dir, falling back to the project dir outside a repo. In a subagent the two dirs are the same, so a host outside cmux sees no change. This lands as its own slice, risk high, with its guardrail eval cases, as the intent's constraint requires. `verified-before-stop` needs no change (both research tickets).

**Design record.** Design section 5's build frame gains the member transport and its Decision line pointing to a new ADR, "Implementers as cmux members" (crew.sh over agent teams, detection, the settle rule, lifecycle, fallback). Section 7 gains a Decision line for the state lookup through git, citing ADR 0007's consequence. The repo's CLAUDE.md Commands list gains one line for `crew.mjs`, as it has for every other `bin/` script. The glossary already defines **lead** and **member**.

**Eval fixture.** The eval scaffold's forge.md gains `## Crew` with `- mode: agent`, so the frame suite exercises the subagent path wherever it runs.

## Testing Decisions

A good test here crosses the module's own seam and checks what a caller sees: the JSON on stdout, the exit code, the state file, the arguments crew.sh received. Nothing asserts on internals such as the poll interval or how the MEMBER line is parsed.

- **`crew.mjs`, at its process boundary** (the one new seam). Fixture hosts from the existing test support helper, with a slice worktree cut the way build cuts it, and a fake crew.sh written into the temp dir and named by `## Crew` `script`. The fake records its argv to a file, prints a `MEMBER=… RECORD=…` line on `spawn`, answers `await` from a status file the test writes, and writes a report file. Cases:
  - spawn passes role `forge-sdlc:implementer`, `--task @<file>`, `--repo <worktree>`, `--permission-mode auto`, `--name <slug>-<nn>`, and no `--worktree`, `--model` or `--effort`; it writes `member: { id, record }` in state.
  - fallback with `CMUX_WORKSPACE_ID` unset, with the script missing, with the script not executable, with `mode: agent`, and with a fake spawn that exits 1: each prints `transport: agent` with a reason naming its condition, writes `member: null`, and records no crew.sh call where none should run.
  - a host with no `## Crew` section reads as `auto` with the default script.
  - await on `done` with no record, a stale record, or a red record with denials present keeps waiting, then settles `green` once the test writes a green record at HEAD. This is the fixture run the intent asks for, standing in for parallel Stop hooks.
  - await settles `red` on a red slice in state with the denials gone, `ended` on an ended member with no green record, and prints `settled: null` with exit 2 on `--timeout`.
  - close calls crew.sh `close <id>` and `forget <id>` by id only, writes `member: null`, and is a no-op with exit 0 on a slice without a member.
  - Prior art: `tests/verify-record.test.mjs` (a `bin/` script on a fixture slice host), `tests/effort-state.test.mjs` (JSON on stdout), `envWith` in `tests/support/upstream.mjs` (an environment per case).
- **`verified-before-stop`**, at its stdin/stdout seam: one more case, a Stop payload whose cwd is a subfolder of the slice worktree, blocks without a record and passes with a green one. Prior art: `tests/verified-before-stop.test.mjs`.
- **`test-frozen` and `spec-frozen`**, at their stdin/stdout seam, with `CLAUDE_PROJECT_DIR` set to the slice worktree as in a member: fix mode still denies a test edit, and a frozen spec edit is still denied. The existing cases with the host as project dir stay green unchanged. Each hook's guardrail eval case gains a `seam.json` for the member shape, run by `tests/evals.test.mjs`. Prior art: `tests/test-frozen.test.mjs`, `tests/spec-frozen.test.mjs`.
- **Host config**: `parseForgeConfig` reads `## Crew` as `crew.mode` and `crew.script`, and the init template carries the section. Prior art: `tests/config.test.mjs`.
- **Skills and agents, structurally**: build names `crew.mjs` spawn, await and close, the background await, the two new precondition lines, the per-slice transport line and the resume rule; slice-review names the close-then-spawn, the foreground await with its timeout, and the shared dispatch file; the dispatch file exists and both skills link it; the implementer still says "first Bash call is `cd <worktree>`" (the existing seam test). Prior art: `tests/build.test.mjs`, `tests/slice-review.test.mjs`.

## Out of Scope

- Any change to cmux-config, including tracking crew.sh there, its hooks and sidebars; crew.sh is called where it lives.
- Members for the merger, verifier, researcher, reviewers or prototyper: they are short-lived and report to the lead directly.
- Any change to what the implementer does once it runs.
- Claude Code agent teams as a member transport.
- How a public host of forge-sdlc obtains crew.sh, and what the README says about it.
- A timeout that kills or closes a member: a member is only ever closed after its slice merges, or before a fix member replaces it.
- Retrying a failed spawn: the slice falls back once and runs as a subagent.

## Further Notes

- Security considerations. Members run with `--permission-mode auto` in their own sessions; today's subagents inherit the lead's mode, so an owner whose lead runs in a stricter mode gets a looser one in members. The implementer keeps its tool scoping (no Agent, no AskUserQuestion) because the member loads the same agent definition. `crew.mjs` runs the script `## Crew` names, with the same trust as the proof commands in the same committed file. The task file holds pointers only, never pasted artifacts or credentials, and `crew.mjs` passes crew.sh no environment of its own. The guardrail hooks hold in a member once the state lookup goes through git; until that slice merges, a member in fix mode is not frozen, so the hook slice is first on the plan.
- The parallel-peers behaviour of Stop hooks is a hypothesis; the settle rule holds whether or not a blocked stop reaches cmux's crew hook, so nothing waits on confirming it.
- The first live build from a cmux lead confirms the two remaining hypotheses: that a member resolves `${CLAUDE_PLUGIN_ROOT}` in the implementer definition as a subagent does, and that a Stop payload's cwd follows a `cd`. The Stop hook's block reason carries the verify-record script's absolute path either way.
- The map's Not yet specified items are settled here: per-slice `member` in state (from the intent), and init writing `auto` unchanged whether or not the lead runs in cmux.

## Affected users and systems

- Owner running `/forge-sdlc:build` from a cmux lead: sees one tab per building slice, a Crew panel row each, tabs closing on merge, red tabs kept, a transport line per slice in the Gate 4 report.
- Owner of a host outside cmux: no change; every slice runs as a subagent and the report says so.
- Owner running `/forge-sdlc:init`: one more section written into `docs/agents/forge.md`, no new question.
- The merger: calls `crew.mjs` through slice-review's fix step and awaits a fix member in the foreground.
- `crew.mjs` (new): reads the host config and `.forge/state.json`, `.forge/verify/<slug>-<nn>.json` and its denials file; writes the slice's `member` in state; calls crew.sh.
- crew.sh (cmux-config, external, unchanged): is called by `crew.mjs` for spawn, await, close and forget; opens and closes cmux tabs; writes its member records and reports under the user's cache.
- cmux's crew Stop hook (cmux-config, external, unchanged): marks a member done and messages the lead on every stop, blocked or not.
- Build skill: calls `crew.mjs`; writes task files under `.forge/notes/<slug>/members/`; gains two preconditions, a resume rule and a report line.
- Slice-review skill: calls `crew.mjs` in its fix step; links the shared dispatch file.
- Implementer agent: reworded step 1 reason only; is called by the build, the merger, or crew.sh as `claude --agent`.
- `test-frozen` and `spec-frozen` hooks: read `.forge/state.json` from the git common dir's parent instead of `CLAUDE_PROJECT_DIR` (risk high slice, guardrail eval cases).
- `verified-before-stop` hook: unchanged; gains one test.
- `.forge/state.json`: migrates additively; slices gain `member`, absent read as `null`.
- `docs/agents/forge.md` and the init template: gain `## Crew`.
- `docs/contracts.md`, `docs/design.md` sections 5, 7, 8 and 9, a new ADR, CLAUDE.md Commands: updated.
- Eval scaffold: its forge.md gains `## Crew` `mode: agent`; the `test-frozen` and `spec-frozen` guardrail cases gain member-shape seams.

## Flagged concerns

- writing-for-agents: the cmux-crew skill's description, always loaded on a cmux lead, says slice-review and its implementer and merger subagents keep their Agent-tool subagents; that pointer was written for prior-sdlc but collides with forge-sdlc's own names, and cmux-config is out of scope, so the spec cannot sharpen it and the lead may weigh it against the build skill's member dispatch (section: Out of Scope).

## Assumptions to confirm

- recommended: `state.json` slices gain a `member` field (`{ id, record }`, or null for a subagent) so a resumed build awaits and closes the right members and the report names each slice's transport (source: none)
- recommended: `await` treats a `done` status without a green verify record at the worktree HEAD, and without `red` in state, as still running and awaits again, because parallel Stop hooks make `done` fire on every blocked stop (source: Crew Stop hook under a blocked stop)
- recommended: the parallel-peers behaviour of Stop hooks stays a hypothesis the docs do not state outright; the await rule above holds under either reading, so the build slice's proof includes one fixture run and no ticket is opened (source: Crew Stop hook under a blocked stop)
- recommended: init derives `## Crew` as `mode: auto` and `script: ~/.config/cmux/scripts/crew.sh` without asking, since auto is the only value most hosts ever need (source: none)
- recommended: a member reads the host config from its own checkout, so `docs/agents/forge.md` must be committed on the effort branch the slice is cut from; it is in this repo, and the build skill states it as a precondition (source: Stop payload cwd in a member)
- recommended: the implementer's step 1 keeps "your first Bash call is `cd <worktree>`" with the reason reworded to cover both transports (source: Stop payload cwd in a member)
- recommended: the one new seam is `crew.mjs`'s process boundary, tested with a fake crew.sh named by `## Crew` `script`; the hooks keep their stdin/stdout seam and the skills their structural tests (source: intent Constraints, proof by node tests)
- recommended: `crew.mjs` owns the slice's `member` field, and `close` on a slice without a member is a no-op, so build and slice-review never branch on the transport outside the dispatch (source: intent Decisions so far, one script with spawn, await, close)
- recommended: `crew.mjs` decides settled from the verify record, its denials file and the slice status, and settles `ended` on an ended, closed or unknown member, which then takes build's existing verifier-then-merger path (source: Crew Stop hook under a blocked stop; build skill, Verifier step)
- recommended: `close` both closes the tab and forgets that member's record, by id only, which is how every record of the build is forgotten by its end while red members keep their tab and record (source: intent Decisions so far, close on merge, keep red tabs, forget at build end)
- recommended: `mode: crew` behaves as `auto` but reports a fallback as a warning line, since the member path is a convenience over the subagent path, never a requirement; a missing `## Crew` section reads as `auto` with the default script (source: map Notes, standing preference)
- recommended: the dispatch is written once in a reference file beside the build skill, linked from build step 4 and slice-review's fix step, so the two transports have one source of truth (source: writing-for-agents, single source of truth)
- recommended: the task file lives at `.forge/notes/<slug>/members/<slug>-<nn>.md`, a subfolder, so the exploration notes every implementer reads stay as the researcher wrote them (source: intent Decisions so far, task file under `.forge/notes/<slug>/`)
- recommended: every pointer in the implementer's prompt is an absolute path in both transports, because a member's working directory is the worktree, where `.forge/` does not exist (source: Stop payload cwd in a member)
- recommended: the lead awaits each member in a background `crew.mjs await` with no timeout; slice-review awaits a fix member in the foreground with `--timeout 540`, rerun until settled, because the merger is a subagent bound by the Bash tool's ten-minute cap (source: intent Decisions so far, background await plus cmux's wake-up)
- recommended: slice-review closes the slice's previous member before spawning a fix member, so the slice has one live member and the fix member takes the name `<slug>-<nn>` (source: none)
- recommended: `test-frozen` and `spec-frozen` read state from the git common dir's parent of the edited file's checkout, the fix ADR 0007 names for a session whose project dir is a worktree; that slice adds its guardrail eval cases, and because `plugins/forge-sdlc/hooks/**` is a `risk.high` glob of this host the effort is `risk: high` while this line stands; overturn it and the effort returns to normal at plan (source: ADR 0007; intent Constraints; forge.md Risk)
- recommended: forge-sdlc enabled at user or project scope is a build precondition of the member path, since a member's session loads plugins from its own checkout and a local-scope install does not reach it (source: Crew Stop hook under a blocked stop, its question's project-scope premise)
- recommended: a member resolves `${CLAUDE_PLUGIN_ROOT}` in the implementer definition as a subagent does, so the task file adds no plugin-root pointer; the first live build confirms it (source: none)
- recommended: the eval scaffold's forge.md sets `## Crew` `mode: agent`, so a frame eval run from a cmux terminal never opens tabs (source: none)
- recommended: the member transport gets a Decision line in design section 5 and a new ADR, the state lookup a Decision line in section 7, and CLAUDE.md's Commands list a line for `crew.mjs` (source: CLAUDE.md Conventions)
