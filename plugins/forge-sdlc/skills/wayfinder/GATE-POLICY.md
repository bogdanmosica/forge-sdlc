# Gate policy

Who passes Gates 1 to 3. Wayfinder, spec and plan apply this file at their gate; it is the one place the rule is stated.

The policy is `gates.policy` in the host config `forge-config.mjs` prints, read once per run, never from state: `autonomous` when it reads exactly that, else `attended`.

## The stop rule

Under `autonomous`, a gate passes by policy when all three hold:

- its artifact (`intent.md` at Gate 1, `spec.md` at Gate 2, `plan.md` at Gate 3) has no `open:` line;
- at Gate 2, `spec.md`'s `## Flagged concerns` has no bullet other than `- none`;
- the effort is `risk: normal`.

Otherwise the run stops at that gate. So the run stops in four places only: an `open:` line, a flagged concern, `risk: high`, and Gate 4, which always stops: it is the code owner's under both policies.

Under `attended`, every gate stops for the owner, who passes it by typing the next command. Gate 2 keeps its `spec:` key: `only-on-open` lets a spec with no `open:` line, no flagged concern and normal risk pass on its own. Under `autonomous` the `spec:` key is not consulted.

A `risk: high` effort runs attended from Gate 1 on under either policy: every gate stops, and Gate 2 labels the PR `needs-tech-lead`.

## Stop reasons

A closed set, in this order:

| Reason | Holds when |
| --- | --- |
| `open` | an `open:` line in `intent.md`, `spec.md` or `plan.md` |
| `flagged` | a flagged concern in `spec.md` |
| `risk-high` | the effort is `risk: high`, so it runs attended |

When several hold, the first in that order is the one written to state, and the report names all of them.

## Report line

A gate the policy passed ends its stage's report with this line, `<n>` being 1, 2 or 3:

`Gate <n> passed: policy autonomous, nothing open`

Wayfinder's Resume continues on that line into the next stage; changing its words means changing wayfinder's Resume and its test with it. A stopped gate reports its reasons and `/forge-sdlc:wayfinder <slug>` to resume; for `risk-high` the report says the effort runs attended from here.

## State write

Under `autonomous`, a stage that stops at its gate writes `stop: <reason>` beside `gate` in the effort's record of `.forge/state.json`. Every other stage state write drops `stop`. Gate 4 writes none: `gate: pr` already names it.
