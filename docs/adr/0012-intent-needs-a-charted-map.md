# 12. intent reshapes a charted map

Status: accepted, 2026-10-17

## Context

Design section 5 has `/forge-sdlc:intent` reshape a Destination, "or pin one before charting". Before charting there is no `feat/<slug>` and no `map.md` to hold the Destination. `wayfinder` already names the Destination as its first act, before it charts any ticket.

## Decision

`intent <slug>` requires `docs/efforts/<slug>/map.md` committed on `feat/<slug>`; without it, it points to `/forge-sdlc:wayfinder <idea>`. It rewrites the map's Destination, and while `intent.md` is a draft, the same five headings there and in the PR's `## Intent`. An accepted `intent.md` is left as committed.

## Consequences

Pinning a Destination before charting is done by `wayfinder` step 2. `intent` changes no tracker ticket and no state.
