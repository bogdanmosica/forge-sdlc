# 06: roster-as-code-01: Shared roster reader, loaded by the mod

Type: slice
Status: resolved
Labels: ready-for-agent
Spec: `docs/efforts/roster-as-code/spec.md` on `feat/roster-as-code`

**What to build:** One pure, no-import `.mjs` under the plugin's hooks folder exposing `parseYamlSubset(text) -> { value, errors }` and `resolveRoster(yamlText, forgeConfig) -> Roster`, never throwing: the strict YAML subset with located errors, the schema (version, enforce, roles, slots, policy, allow), defaults, precedence over `## Routing` and `## Policy skills`, and every problem line. The model and effort validators move into it from the run pane's routing module, which imports them back, so the mod loads the shared file.

**Blocked by:** None (can start immediately)

- [ ] `parseYamlSubset` accepts the subset and rejects each unsupported construct with its line
- [ ] `resolveRoster` without a file yields exactly today's defaults
- [ ] each bad entry, unknown key, required-slot disable, bad version and enforce value is skipped and reported
- [ ] the run pane's routing tests still pass with the validators imported from the shared file

## Proof

```sh
node --test tests/roster-reader.test.mjs && claude plugin test plugins/forge-sdlc
```

passes: the reader's cases green and the mod's tests green with the validators imported from the shared `.mjs`

## Comments

## Comments

resolved: clean. Review record .forge/review/roster-as-code-01.md; merged into feat/roster-as-code at 9edae71.
