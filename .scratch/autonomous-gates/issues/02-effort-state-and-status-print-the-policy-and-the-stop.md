# 02: autonomous-gates-02: effort-state and status print the policy and the stop

Type: slice
Status: resolved
Labels: ready-for-agent
Spec: `docs/efforts/autonomous-gates/spec.md` on `feat/autonomous-gates`

**What to build:** `bin/effort-state.mjs` prints `{ slug, stage, gate, next, why, source, policy, stop }`: `policy` is the host's gate policy read from the config on each call, `attended` unless the key reads exactly `autonomous`; `stop` is the state's `stop` or `none`, always `none` when `source` is `artifacts`; when `stop` is set, `why` names it (an open line waits for the owner; a flagged concern waits for the owner; risk high, the effort runs attended); `next`, the NEXT table and `--list` are unchanged except that list entries carry both fields. The default `attended` is applied inside this script, never in `hooks/scripts/lib.mjs`. The status skill prints `policy <policy>` on each effort's first line and `stopped: <stop>` when set; it stays read-only.

**Blocked by:** 01 (Policy in the config, init and contracts)

- [ ] No `policy` key prints `attended`; `autonomous` prints `autonomous`; an unknown value prints `attended`
- [ ] Each stop reason prints `stop` and a `why` naming it with `next` unchanged; no `stop` prints `none` and today's `why`; `source: artifacts` prints `none`
- [ ] `--list` entries carry `policy` and `stop`
- [ ] Status's block prints the policy and, when set, the stop; no file under the risk-high globs changes

## Proof

`node --test tests/effort-state.test.mjs tests/status.test.mjs` → passes with the seven policy and stop cases

## Assumptions

- recommended: a state `stop` outside the closed set (`open`, `flagged`, `risk-high`) prints `stop: none` and the stage's `why` (source: spec.md, effort-state "stop is the state's stop, or none when absent"; State schema "stop: open | flagged | risk-high")
- recommended: status puts `, stopped: <stop>` on the first line after `policy <policy>`, left out when `stop` is `none` (source: spec.md, status "Each effort's first line gains `policy <policy>` and, when set, `stopped: <stop>`")

## Comments

clean: review record .forge/review/autonomous-gates-02.md, merged 7d14ecd into feat/autonomous-gates.
