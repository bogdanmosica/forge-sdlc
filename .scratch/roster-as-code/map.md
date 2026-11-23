# Roster as code: forge-sdlc agents and skills from a YAML file

Labels: wayfinder:map
Status: open

Map body: `docs/efforts/roster-as-code/map.md` on `feat/roster-as-code`.

Gist: a host's `docs/agents/forge.yaml` names the agent per role, the skill per slot, and their model and effort; leads resolve calls through `bin/roster.mjs`, the mod applies model and effort, and `enforce: true` makes a hook deny calls outside the roster.
