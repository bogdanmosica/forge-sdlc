# 07: workflow-as-code-03: readWorkflow and bin/workflow.mjs JSON and --gate

Type: slice
Status: resolved
Labels: ready-for-agent
Spec: `docs/efforts/workflow-as-code/spec.md` on `feat/workflow-as-code`

**What to build:** `lib.mjs` gains `readWorkflow(hostDir, effort?)` (plugin file, host roster, agents' frontmatter models); `bin/workflow.mjs [--project <host>]` prints the resolved workflow as JSON with `problems`, `--gate <intent|spec|plan|pr>` prints `{ key, n, mode, source, stops }`; exit 0, 2 on bad usage; reads only

**Blocked by:** workflow-as-code-02

- [x] JSON form against fixture hosts with and without forge.yaml
- [x] `--gate` for each key, a `gates.plan: attended` host naming `gates.plan in forge.yaml`
- [x] `--project` defaults to the cwd
- [x] exit 2 on an unknown flag or gate key
- [x] `readHostConfig` and `forge-config.mjs` unchanged

## Proof

```sh
node --test tests/workflow-bin.test.mjs
```

passes against fixture hosts in a temp dir

## Assumptions

- recommended: `readWorkflow(hostDir, effort?)` takes the effort's slug and reads its record from `.forge/state.json` itself, so `--mermaid --effort <slug>` (slice 04) and `effort-state.mjs` (slice 05) pass a slug; a slug with no record reads unpositioned (source: spec, "positioned from the effort's record in `.forge/state.json` ... when `--effort` is given")
- recommended: the agents' frontmatter models are keyed `forge-sdlc:<file name>` from `plugins/forge-sdlc/agents/*.md`, the agent type the roster names (source: spec, `resolveWorkflow` "`agentModels` holds each plugin agent's frontmatter model")
- recommended: `--project` defaults to the cwd as given, not to the host `host-dir.mjs` would resolve from it (source: spec, "All forms take `--project <host>`, defaulting to the cwd")
- recommended: `--mermaid` is bad usage (exit 2) until slice 04 adds it (source: plan row 03 names only the JSON and `--gate` forms)

## Comments

clean. Review record: /Users/mosica.bogdan/Desktop/personal/forge-sdlc/.forge/review/workflow-as-code-03.md. Merged into feat/workflow-as-code at e7339df.
