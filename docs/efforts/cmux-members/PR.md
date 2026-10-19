# Visible implementers as cmux members

Second intent (2026-10-18, live check 2026-10-19): the transport moved from crew.sh to named agent teams. Slice 02 of the first plan is merged on this branch.

## Intent

### Problem

The build stage dispatches every implementer as a background Agent subagent, and the other stages dispatch the researcher, spec-writer, verifier, reviewers and merger the same way. When the lead runs in cmux with agent teams enabled, which the Claude button now does, those sessions could each be a visible pane with a name, but the loop names none of them, so the owner sees nothing: no tab, no status, no way to click into a slice that is slow or stuck. The live check also showed that `verified-before-stop` has never gated a subagent implementer: a subagent's Stop payload carries the lead's directory, not the slice worktree.

### Outcome

Every agent the loop starts is a **member**: an Agent call carrying a `name` drawn from the host's **crew theme**, one pool per role. Under a lead launched with agent teams enabled, each member runs as a teammate in its own visible pane under that name, listed in cmux's Crew panel, and the lead learns of its finish from the teammate's mailbox messages. Under a plain lead the same call runs as the subagent it always was, and nothing else changes. The build report names, per slice, the member that built it. Init asks the theme once, with the five presets carried over from prior-sdlc or a free-text theme, and `forge.md` holds it. The Stop gate holds for every implementer: in a pane through the worktree cwd, as a subagent through the agent id the lead records on the slice.

Observable: from a teams lead, `/forge-sdlc:build` opens one pane per frontier slice titled with the slice's member name, and the Crew panel lists them; from a plain terminal the same command runs as before, and the Gate 4 report still reads `<slug>-<nn>: <name>`. In both, an implementer that stops without a fresh green verify record is blocked with the verify-record command.

### Users

The owner of a host repo who runs the loop from a teams lead and wants to watch the agents work. Every forge-sdlc stage that dispatches an agent. Hosts that run a plain lead, who must notice nothing beyond a name in the report and a Stop gate that now holds.

### Constraints

- No crew.sh, no cmux-config change: the only runtime dependency is a lead launched with agent teams enabled, which the README states as what makes the names visible.
- Display only: the name is the Agent call's `name` and the state record; the brief never tells the agent its name; branches, commits, worktrees and records keep `<slug>-<nn>`. A name is letters, digits, `_` and `-` only, so a theme's "Seven of Nine" is emitted as `Seven-of-Nine`.
- One script, `bin/crew-name.mjs <role> --project <host> --effort <slug>`, picks and records the next name; the skills call it before each Agent call; no pane mod.
- `## Crew` in `forge.md` holds `theme` (a preset id, `none`, or free text) and optional per-role `names:` overrides, nothing else; init asks the theme and derives nothing.
- One hook change, in `verified-before-stop`: on `SubagentStop`, when the cwd names no slice, find the slice by the payload's `agent_id` from state and gate on its verify record. Risk high; the hook's guardrail eval case gains the agent-id seam.
- A teammate stays idle after its turn; the lead's wait and the end of a teammate are designed on the agent-teams protocol, never on a task notification.
- Proof by node tests: the name script at its process boundary over fixture hosts and a crew presets file; the hook at its stdin/stdout seam with the agent-id shape; the init template; the skills structurally.

### Open questions

none

## Spec

[spec.md](spec.md) on `feat/cmux-members`: 46 user stories. Risk high: one hook change (the Stop gate by agent id). Replaces the crew.sh spec of 2026-10-18.

## Flagged concerns

- writing-for-agents: the user-level `cmux-crew` skill's always-loaded description triggers on a "cmux team or crew" and "visible" sessions, and names "slice-review", "implementer/merger" and "crew theme" as prior-sdlc's own. forge-sdlc now uses the same leading words (member, crew theme) for its named Agent calls. On a teams lead, that pointer can pull the lead toward crew.sh, or toward keeping plain subagents, when the owner asks to watch a build. It lives in cmux-config, which is out of scope, so the spec cannot sharpen its wording (section: Out of Scope).

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
