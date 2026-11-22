# Hide the upstream commands forge-sdlc wraps

Labels: wayfinder:map
Status: open

Map body: `docs/efforts/hide-wrapped-commands/map.md` on `feat/hide-wrapped-commands`.

Gist: the run pane mod hides the upstream commands the loop wraps (wayfinder, to-spec, to-tickets, implement-spec, setup-matt-pocock-skills, code-review, pr) from the `/` typeahead and `/help` through `command.describe`; they still run typed in full and through the Skill tool. No tickets: the way was clear at charting.
