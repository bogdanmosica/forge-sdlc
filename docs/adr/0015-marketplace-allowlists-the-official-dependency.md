# 15. The marketplace allowlists claude-plugins-official for the dependency install

Status: accepted, 2026-10-18

## Context

`plugin.json` declares `mattpocock-skills@claude-plugins-official` under `dependencies`, and the README and section 10 of the design said the dependency installs with forge-sdlc. The first real install, into this repository at project scope with Claude Code 2.1.302, did not do that: forge-sdlc installed alone, showed "failed to load" until the dependency was added by hand twenty seconds later, and the registry records the two as separate installs.

The engine's rule is that a declared dependency is installed with the plugin at the same scope, but not when it lives in a different marketplace than the declaring plugin, unless the root `marketplace.json` names that marketplace under `allowCrossMarketplaceDependenciesOn` or the user already has the dependency installed and enabled at that scope. When the dependency is skipped the install still reports success, and the plugin then fails to load.

## Decision

`.claude-plugin/marketplace.json` sets `allowCrossMarketplaceDependenciesOn: ["claude-plugins-official"]`. The manifest test asserts the field. The README states the condition and gives the manual install line for the case where the success message does not list the dependency.

Verified on 2026-10-18 with a clean project-scope install into a scratch repository: the success line read `(+ 1 dependency: mattpocock-skills)` and the scratch host's settings enabled both plugins.

## Consequences

- A host that adds this marketplace and installs forge-sdlc gets mattpocock-skills in the same command, at the same scope. Uninstalling forge-sdlc leaves the dependency until `claude plugin prune`.
- A copy of this marketplace, or an older engine, may still skip the dependency. `bin/skill-path.mjs` exits 1 with the install line, and the README's manual step covers it, so the loop never silently runs without Matt's skills.
- The allowlist is a marketplace-level trust statement: only the official Anthropic marketplace may supply a dependency across the boundary.
