# 08: roster-as-code-03: The mod swaps roles at spawn

Type: slice
Status: open
Labels: ready-for-agent
Spec: `docs/efforts/roster-as-code/spec.md` on `feat/roster-as-code`

**What to build:** At `agent.spawn`, a plain spawn of `forge-sdlc:<role>` whose roster names another offered agent is rewritten to it, with one appended `role contract: <plugin root>/skills/build/ROLES.md#<role>` line; the roster's model and effort apply and win over `## Routing` key by key; forks, resumes and workflow agents keep their type; a pass-through `agent.offer` hook collects offered types and an unoffered target is reported and not swapped; the routing record gains `agent` and the `⇄ routed` mark shows; the state contract gains `AgentRouting.agent`.

**Blocked by:** roster-as-code-01

- [ ] a swapped role spawns the roster's agent with the role-contract line
- [ ] model and effort from the roster beat `## Routing`
- [ ] an unswapped role, a fork and a resume are untouched
- [ ] an unoffered target is not swapped and is reported
- [ ] no forge.yaml means no change

## Proof

```sh
test -f plugins/forge-sdlc/hooks/run-pane.roster.test.tsx && claude plugin test plugins/forge-sdlc && npm run typecheck
```

passes: the new roster spawn tests and every existing mod test green, the mod typechecks

## Comments
