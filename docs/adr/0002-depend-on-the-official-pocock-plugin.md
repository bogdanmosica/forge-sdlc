# 2. Depend on the official mattpocock-skills plugin, read user-invoked skills by file, pin with a tripwire

Status: accepted, 2026-10-17

## Context

The work plugin vendors Matt's skills at a pinned tag and maintains a refresh script. The personal plugin should not carry that maintenance, but the official plugin updates itself, and the Skill tool refuses user-invoked skills (`to-spec`, `to-tickets`, `implement-spec`, `wayfinder`) from inside a skill.

## Decision

`plugin.json` declares `mattpocock-skills@claude-plugins-official` as a dependency. Model-invoked skills are called through the Skill tool as `mattpocock-skills:<name>`; user-invoked ones are read by file through `bin/skill-path.mjs`, which resolves the installed plugin from the engine's registry (`MATTPOCOCK_SKILLS_ROOT` overrides it). `UPSTREAM.lock` records the version tested against and the headings the frame reads; the `skills-version` SessionStart hook warns once per session when the installed version differs or a heading is gone, and the upstream eval suite asserts the same.

## Consequences

- No vendored copy to refresh; drift is a visible warning instead of silent breakage.
- The first install on a machine will likely report drift, since the official marketplace pins a newer upstream commit than the lock; the response is to re-read the delta and bump the lock.
