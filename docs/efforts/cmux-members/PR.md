# Visible implementers as cmux members

## Intent

### Problem

The build stage dispatches every implementer as a background Agent subagent. When the lead runs inside cmux, the owner cannot see those sessions: no tab, no status, no way to click into a slice that is taking long or has stopped.

### Outcome

When the lead runs inside cmux, each implementer is a member: a visible cmux session hosting `forge-sdlc:implementer` in the slice's worktree, spawned through crew.sh, awaited through its report and the verify record, closed when its slice merges. Anywhere else, or when crew.sh is missing or fails to spawn, the implementer is the Agent subagent it is today, and the build report names each slice's transport. A host outside cmux sees no change.

### Users

The owner running `/forge-sdlc:build` from a cmux lead; the merger, for fix-mode implementers; hosts outside cmux, who must notice nothing.

### Constraints

cmux-config is a dependency, not a deliverable. forge-sdlc keeps its own worktrees and passes `--repo`. One brief, two transports. No hook changes, risk normal. Proof by node tests against a fake crew.sh and with the cmux variables unset.

### Open questions

none

## Spec

[spec.md](spec.md) on `feat/cmux-members`: 43 user stories. Risk high: one slice changes two hooks.

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
