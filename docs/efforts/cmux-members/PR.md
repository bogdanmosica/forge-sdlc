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

## Assumptions to confirm

- recommended: the crew presets live in the plugin as `crew.json`, the five prior-sdlc themes with pools rebuilt for the eight forge roles, each pool at least three names and the implementer pool at least five, every name stored in display form and emitted by the script in handle form (letters, digits, `_`, `-`; a pool run out appends `-2`) (source: ticket 07; live check run 2, name charset)
- recommended: used names are recorded per effort in `state.json` under `crew: { "<role>": ["<name>", …] }` next to the slices, a slice's name under its `member` field and its implementer's id under `agent`, so a resumed build and a fix round reuse the name and the hook finds the slice (source: ticket 07, question 4; ticket 10)
- recommended: a host whose `forge.md` has no `## Crew` section, or `theme: none`, gets `<slug>-<nn>` as the implementer's name and `<role>` for the others, so panes are still told apart (source: none)
- recommended: the build's wait for a member is the teammate's `idle_notification` mailbox message under a teams lead and the task notification under a plain lead; the skills describe the wait as "the member's report arrives", and the verify record stays the evidence under both (source: live check run 2, (a))
- recommended: after a slice merges or goes red, the lead ends its teammate through the agent-teams shutdown request, so panes do not pile up across a build; under a plain lead there is nothing to end (source: live check run 2, "idle, not shut down"; agent-teams docs)
- recommended: the first intent's accepted lines on `cd <worktree>` in the implementer's step 1 and on `forge.md` committed on the effort branch stand unchanged; the live check showed the teammate's `CLAUDE_PROJECT_DIR` is the lead's root, so the host config is read from the host in both transports (source: live check run 2, (b))
- recommended: `risk: high` stands for the one hook change of ticket 10, the only path under `hooks/**` this effort touches (source: ticket 10; forge.md Risk)
