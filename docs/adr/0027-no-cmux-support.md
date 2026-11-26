# 27. No cmux support in this repository

Status: accepted, 2026-11-26; supersedes ADR 0017 in part (its cmux framing only)

## Context

The marketplace shipped a second plugin, `workbench`, installed at user scope: command hooks that fed the cmux sidebars (needs-you marker, lanes, task mirror, Vault checkpoints, activity log, FILES line, team and crew sync) and the `cmux-crew` skill, which ran a visible team as one cmux pane per session through cmux-config's `crew.sh`. The forge-sdlc plugin itself never called cmux, but its help panel, the band's tips, `/boards`' empty Crew tab, `skills/build/MEMBERS.md` and the docs named `cmux claude-teams` as the way to watch the loop's members, and the workbench mod's comments described its views as counterparts of cmux-config's boards. ADR 0017 was written for a cmux lead.

## Decision

- The marketplace no longer ships the `workbench` plugin; `plugins/workbench/` is deleted with its tests, its `package.json` test glob and its `validate` step.
- Nothing in this repository targets cmux. The loop's members stay as ADR 0017 decided: an Agent call with a `name` from the crew theme, a named teammate under a lead with agent teams enabled, a subagent under a plain lead. Agent teams is the transport, from any lead that enables it.
- The `/forge` loop tab, the band's tip, `/boards`' Crew tab and `MEMBERS.md` say "agent teams enabled" where they said `cmux claude-teams`. The crew theme, `bin/crew-name.mjs`, `/crew` and `/boards`' Crew tab (Claude Code's own team config) are unchanged.
- Records of past work keep their cmux wording: `docs/efforts/cmux-members/`, `docs/research/cmux-members/`, `.scratch/cmux-members/` and the accepted ADRs.

## Consequences

- A machine that installed `workbench@forge-personal` at user scope keeps running the old hooks until it is uninstalled (`claude plugin uninstall workbench@forge-personal --scope user`). The cmux sidebars are no longer fed from this repository, and per-session `~/.cache/claude-ctx` files are no longer cleared at session end by `claude-statusline-clear.sh`.
- The `cmux-config` repository is no longer documented here.
- The workbench mod's comment edits make forge-sdlc's copies differ from emag-sdlc's in more than the plugin literal until the same edits are ported there.
