# The workflow schema

Type: grilling
Status: resolved
Labels: wayfinder:grilling
Blocked by: none
Map: ../map.md

## Question

The shape of `forge.yaml`'s `workflow:` section on top of the roster schema (`docs/efforts/roster-as-code/intent.md`): how stages and gates are listed when they are descriptive (fixed names the plugin validates, not free definitions), which knobs move from forge.md `## Gates` (`policy`, `spec`, `max_parallel_slices`), where the roster's roles and slots attach to stages for the diagram, how the file stays valid when a host writes only the knobs, and the deprecation of `## Gates`.

## Answer

Resolved 2026-11-22 by grilling the owner, four questions, every recommendation accepted.

1. **The loop's description** ships in the plugin as `plugins/forge-sdlc/workflow.yaml`: stages in order, the gates between them, the stop rules, the roles and slots per stage. It is the single source the diagram, the `/forge` panel and tests read. A host's `forge.yaml` `workflow:` holds only knobs and never restates stages.
2. **Knobs**:
   ```yaml
   workflow:
     policy: autonomous
     max_parallel_slices: 3
     gates:
       intent: policy     # Gate 1
       spec: policy       # Gate 2
       plan: attended     # Gate 3
   ```
   Gates keyed by the stage they close; `gates.pr` is a reported error (Gate 4 is the owner's); every key optional. A gate's allowed values are Per-gate autonomy's.
3. **`## Gates` moves**: all three keys; `forge.yaml` wins; forge.md `## Gates` read with a deprecation toast for one minor version. Init writes `forge.yaml` (`version: 1`, `workflow:`) instead of `## Gates`; the roster spec already has init write `forge.yaml` for `slots.policy` (owner at its Gate 2).
4. **Roster on the diagram**: each stage's roles and slots from the plugin's `workflow.yaml`, resolved through the host's roster, so nodes show the agent and model that will run.
