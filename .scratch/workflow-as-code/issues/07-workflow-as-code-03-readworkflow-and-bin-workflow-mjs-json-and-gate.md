# 07: workflow-as-code-03: readWorkflow and bin/workflow.mjs JSON and --gate

Type: slice
Status: open
Labels: ready-for-agent
Spec: `docs/efforts/workflow-as-code/spec.md` on `feat/workflow-as-code`

**What to build:** `lib.mjs` gains `readWorkflow(hostDir, effort?)` (plugin file, host roster, agents' frontmatter models); `bin/workflow.mjs [--project <host>]` prints the resolved workflow as JSON with `problems`, `--gate <intent|spec|plan|pr>` prints `{ key, n, mode, source, stops }`; exit 0, 2 on bad usage; reads only

**Blocked by:** workflow-as-code-02

- [ ] JSON form against fixture hosts with and without forge.yaml
- [ ] `--gate` for each key, a `gates.plan: attended` host naming `gates.plan in forge.yaml`
- [ ] `--project` defaults to the cwd
- [ ] exit 2 on an unknown flag or gate key
- [ ] `readHostConfig` and `forge-config.mjs` unchanged

## Proof

```sh
node --test tests/workflow-bin.test.mjs
```

passes against fixture hosts in a temp dir
