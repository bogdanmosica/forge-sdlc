# 05: workflow-as-code-01: workflow: knobs in the shared reader

Type: slice
Status: resolved
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

## Assumptions

- recommended: `roster.workflow.gates` holds every gate's resolved mode (`attended` | `policy`), and `sources` is flat, `{ policy, maxParallelSlices, intent, spec, plan }`, each a source string or `default` (source: spec "roster.workflow holds the knobs already merged with ## Gates and their sources")
- recommended: `## Gates` `max_parallel_slices` still applies when forge.yaml sets none (source `max_parallel_slices in forge.md ## Gates`) and gets its own deprecation line to `workflow.max_parallel_slices` (source: spec "A host with no workflow: section reads and runs exactly as today"; "one deprecation line per bullet")
- recommended: a bad `workflow.max_parallel_slices` gives 3 with source `default`, even over a `## Gates` value; a bad `workflow.policy` or gate value is ignored and falls through the precedence (source: spec user story 13 "replaced by the default 3"; Implementation Decisions "a bad value is a reported problem and is ignored")
- recommended: an unknown `## Gates` bullet reads "has no docs/agents/forge.yaml equivalent; it stops working when ## Gates is removed", as `## Routing` does; a `spec` value other than `only-on-open` gets the `spec always` line, the value quoted (source: roster reader's `## Routing` lines)


## Comments

merged: review record .forge/review/workflow-as-code-01.md (clean), merge c49d143.
