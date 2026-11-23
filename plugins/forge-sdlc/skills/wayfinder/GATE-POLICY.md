# Gate policy

Who passes Gates 1 to 3. Wayfinder, spec and plan apply this file at their gate; it is the one place the rule is stated.

## Reading a gate

Each gate is read once per run, never from state: `node "${CLAUDE_PLUGIN_ROOT}/bin/workflow.mjs" --gate <key> --project .` prints `{ key, n, mode, source, stops }`, the key being `intent` at Gate 1, `spec` at Gate 2 and `plan` at Gate 3.

- `mode` is who passes the gate: `policy` or `attended` (Gate 4, `pr`, is always `owner`). A global policy of `autonomous` gives a gate with no setting of its own the mode `policy`; `attended`, or no policy, gives `attended`.
- `source` is the setting the mode came from: `gates.<key> in forge.yaml`, `workflow.policy in forge.yaml`, `spec in forge.md ## Gates` (the deprecated `spec: only-on-open`), `policy in forge.md ## Gates`, or `default`.
- `stops` is the gate's share of the stop reasons below, in their order; `flagged` is Gate 2's alone.

## The stop rule

A gate in mode `policy` passes when all three hold:

- its artifact (`intent.md` at Gate 1, `spec.md` at Gate 2, `plan.md` at Gate 3) has no `open:` line;
- at Gate 2, `spec.md`'s `## Flagged concerns` has no bullet other than `- none`;
- the effort is `risk: normal`.

Otherwise the run stops at that gate. A passed gate continues the run into the next stage. Gate 4 always stops: it is the code owner's whatever the settings.

A gate in mode `attended` stops for the owner, who passes it by typing the next command.

A `risk: high` effort runs attended from Gate 1 on whatever the settings: every gate stops, and Gate 2 labels the PR `needs-tech-lead`.

## Stop reasons

A closed set, in this order:

| Reason | Holds when |
| --- | --- |
| `open` | an `open:` line in `intent.md`, `spec.md` or `plan.md` |
| `flagged` | a flagged concern in `spec.md` |
| `risk-high` | the effort is `risk: high`, so it runs attended |
| `attended` | the gate's mode is `attended` and its `source` is forge.yaml (`gates.<key> in forge.yaml` or `workflow.policy in forge.yaml`) |

A gate checks only the reasons in its `stops`. When several hold, the first in that order is the one written to state, and the report names all of them.

## Report line

A gate passed in mode `policy` ends its stage's report with this line, `<n>` being 1, 2 or 3 and `<tail>` the one its `source` gives:

`Gate <n> passed: <tail>, nothing open`

| `source` | `<tail>` |
| --- | --- |
| `workflow.policy in forge.yaml` or `policy in forge.md ## Gates` | `policy autonomous` |
| `gates.<key> in forge.yaml` | `gates.<key> policy` |
| `spec in forge.md ## Gates` | `only-on-open` |

`<key>` is the gate's own key, so a Gate 2 overridden in forge.yaml reads `Gate 2 passed: gates.spec policy, nothing open`.

Wayfinder's Resume continues on any `Gate <n> passed` line into the next stage; changing its prefix means changing wayfinder's Resume and its test with it.

A gate stopped by `open`, `flagged` or `risk-high` reports its reasons and `/forge-sdlc:wayfinder <slug>` to resume; for `risk-high` the report says the effort runs attended from here. The first reason that holds picks the line, so a gate in mode `attended` where `open`, `flagged` or `risk-high` also holds reports as stopped by that reason. A gate stopped by mode `attended` alone reports its artifact for the owner to read, the stage's next command and the gate's `source`.

## State write

A stage that stops at its gate writes `stop: <reason>` beside `gate` in the effort's record of `.forge/state.json`: the first reason that holds, `attended` included when the mode is `attended` from forge.yaml. A gate in mode `attended` whose source is `## Gates` or `default` writes no `stop`. Every other stage state write drops `stop`. Gate 4 writes none: `gate: pr` already names it.
