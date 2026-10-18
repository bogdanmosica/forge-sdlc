# Transport: agent teams instead of crew.sh, and a crew theme for the names

Type: grilling
Status: open
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
