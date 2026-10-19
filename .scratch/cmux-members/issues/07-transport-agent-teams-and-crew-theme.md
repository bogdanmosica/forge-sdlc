# Transport: agent teams instead of crew.sh, and a crew theme for the names

Type: grilling
Status: resolved
Labels: wayfinder:grilling
Map: ../map.md
Reopens: the Mechanism decision of the grilling (Q2, crew.sh over agent teams) in the map's Decisions so far, the intent, the spec and the plan.

## Question

On 2026-10-18, during the build, the owner changed cmux-config so the Claude tab-bar button and the layouts start `cmux claude-teams`: every lead launched that way has agent teams enabled, and an Agent call with a `name` opens as a visible pane with no crew.sh at all. The owner chose, at the build's first frontier, to replace crew.sh with named agent teams: drop the `crew.mjs` slices (03, 04), shrink the build slice (05) to naming the Agent calls, and keep the hooks slice (02) which is merging.

What the reopened intent must settle, with the owner:

1. The transport: named Agent calls, `name: <display name>`, for implementers only or for every agent the loop starts (researcher, spec-writer, verifier, merger, reviewers)?
2. Detection and fallback: does the plugin detect a teams lead at all, or simply always name its calls (a plain lead ignores the name, nothing else changes)? If it detects, what is the signal (the agent-teams environment variable, `~/.claude/teams/`)?
3. The crew theme, as in prior-sdlc: init asks `Crew theme: which theme names the agents while they run?` with the plugin's presets (Warcraft, Star Trek, Star Wars, Game of Thrones, Super Mario) or a free-text theme; the host config carries `## Crew` with `theme` and per-role name overrides; each agent the loop starts takes the next name of its role's pool, a pool run out restarts with a number. Which roles get pools in forge-sdlc (researcher, prototyper, spec-writer, implementer, verifier, reviewer, merger, general)? Is the display name the teammate `name` only, or also a prefix in the brief so the agent knows its own name?
4. What stays from the current spec: the state's per-slice `member` field (now the teammate name?), the lifecycle rules (a teammate ends with its turn; nothing to close), the per-slice transport line in the Gate 4 report, and the eval scaffold pinning.
5. Whether the two hypotheses on teammates need a research ticket before the spec: that a background Agent call with a `name` under a teams lead still notifies the lead on completion as today, and that its Stop fires with the worktree as cwd so `verified-before-stop` holds, as it does for a member.

Source: `<prior-sdlc>/crew.json` and its init skill, section 2 question 8, for the theme; `../cmux-config/skills/cmux-crew/SKILL.md` section 1 for teams in cmux.

## Answer

Grilling 2026-10-18, eight questions, every recommendation accepted:

1. Every agent the loop starts gets a name from its role's pool, not implementers only; the Out of scope line on the merger, verifier, researcher and reviewers falls. **member** in the glossary becomes an agent the lead starts as a named teammate.
2. Init asks `Crew theme: which theme names the agents while they run?`: None, a preset, or free text; the five presets come from prior-sdlc's crew.json with pools rebuilt per forge-sdlc role; `forge.md` `## Crew` holds `theme` and optional per-role `names:` overrides, nothing else (`mode` and `script` are gone).
3. Eight pools: researcher, prototyper, spec-writer, implementer, verifier, reviewer, merger, general. prior-sdlc's research, prototype, spec, implementer, code-reviewer, merger map one to one; legacy-research names go to verifier, implementer-markup to general.
4. `bin/crew-name.mjs <role> --project <host> --effort <slug>` prints the next free name of the pool (a pool run out restarts with a number), records it in the effort's state, and keeps a slice's name across fix rounds and resumes; the skills call it before each Agent call. No pane mod.
5. Display only: the name is the Agent call's `name` and the state record; the brief never tells the agent its name; branches, commits, worktrees and records keep `<slug>-<nn>`.
6. Each slice's `member` field becomes `name` or null; the Gate 4 report line reads `<slug>-<nn>: <name>` or `subagent`; close, forget and keep-red-tabs rules are dropped.
7. cmux-config stays out of scope, crew.sh is not referenced; the only runtime dependency is a lead launched with agent teams enabled, stated in the README as what makes the names visible.
8. A live check from a teams lead precedes the spec: ticket 09, a `wayfinder:task` the owner runs.

Detection is not needed (ticket 08): `name` exists on the Agent tool in every session.
