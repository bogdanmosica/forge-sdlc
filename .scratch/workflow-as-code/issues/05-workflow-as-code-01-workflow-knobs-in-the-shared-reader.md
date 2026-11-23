# 05: workflow-as-code-01: workflow: knobs in the shared reader

Type: slice
Status: open
Labels: ready-for-agent
Spec: `docs/efforts/workflow-as-code/spec.md` on `feat/workflow-as-code`

**What to build:** `resolveRoster` accepts `workflow:` and returns `roster.workflow` (`policy`, `maxParallelSlices`, `gates.{intent,spec,plan}`, `sources`), merged with forge.md `## Gates` in the spec's precedence order; bad keys and values (`stages`, `gates.pr`, unknown keys, values other than `attended`/`policy`, a non-positive `max_parallel_slices` falling back to 3) and one deprecation line per present `## Gates` bullet join `problems`; `workflow` is no longer "not a roster key"

**Blocked by:** None (can start immediately)

- [ ] every `workflow:` knob read, every key optional
- [ ] one case per precedence row, each mode carrying its source
- [ ] `gates.pr` reported as Gate 4 always the code owner's; unknown keys and bad values reported with their key
- [ ] bad `max_parallel_slices` reported and replaced by 3
- [ ] deprecation lines: `policy` → `workflow.policy`, `spec: only-on-open` → `workflow.gates.spec: policy`, `spec: always` has no equivalent; only for bullets present
- [ ] no forge.yaml and no `## Gates` yields today's defaults; the roster reader's existing tests stay green

## Proof

```sh
node --test tests/workflow-reader.test.mjs tests/roster-reader.test.mjs
```

passes: the workflow knob, precedence, problem and deprecation cases green, and the roster reader cases still green
