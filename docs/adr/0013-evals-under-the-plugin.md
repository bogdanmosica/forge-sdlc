# 13. The eval suites live under the plugin

Status: accepted, 2026-10-17

## Context

Design section 11 placed `evals/` at the repository root. `claude plugin eval` looks for `evals/` under the plugin it evaluates, and resolves a case's `plugins:` paths relative to the case.

## Decision

The suites are `plugins/forge-sdlc/evals/{triggering,guardrails,frame,upstream}/`, one folder per case (`case.yaml`, `fixture.sh`, `graders/`), with the fixture effort under `evals/fixtures/` and the scaffold helpers under `evals/lib/host.sh`. Each guardrails case also carries `seam.json`: the hook payload and its expected decision. `tests/evals.test.mjs` runs it against the case's fixture with no model call.

## Consequences

- The plugin ships its suites. `evals/results/` is gitignored where it is written.
- mattpocock-skills is not under the eval target, so the engine cannot load it as a plugin. Cases that need it copy the installed one into the workspace and register it for `bin/skill-path.mjs`, and Matt's model-invoked skills (`tdd`, `code-review`) are unavailable inside a run.
