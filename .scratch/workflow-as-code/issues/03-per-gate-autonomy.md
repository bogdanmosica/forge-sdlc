# Per-gate autonomy

Type: grilling
Status: resolved
Labels: wayfinder:grilling
Blocked by: 02
Map: ../map.md

## Question

What a per-gate override may say and what stays fixed: may each of Gates 1 to 3 be `attended` or `policy` independently of the global policy; may a stop rule (`open`, `flagged`, `risk-high`) be turned off or added to; can `risk: high` still force attended; how does the existing `spec: always | only-on-open` map onto it; and how do `effort-state.mjs`, GATE-POLICY.md and the stage reports name a stop caused by a per-gate setting.

## Answer

Resolved 2026-11-22 by grilling the owner, four questions, every recommendation accepted.

1. **Values**: a gate is `attended` (always stops for the owner) or `policy` (passes when the stop rules are clear). `gates.<gate>` overrides the global `policy` for that gate alone. `spec: only-on-open` is `gates.spec: policy` under a global `attended`; the `spec` knob is deprecated with `## Gates`. `gates.intent: policy` and `gates.plan: policy` work under a global `attended` too.
2. **Stop rules fixed**: `open`, `flagged`, `risk-high` cannot be turned off or added to; `risk: high` forces every gate `attended` whatever the settings.
3. **New stop reason `attended`**, last in the closed set (`open`, `flagged`, `risk-high`, `attended`): holds when the gate is set attended, globally or per gate. `effort-state` says `why: gate <stage> is attended in forge.yaml`. GATE-POLICY.md and its test change with it.
4. **One run**: any gate passed by policy continues in the same run, whatever the global policy.
