# 1. Artifacts live in git; the tracker links to them

Status: accepted, 2026-10-17

## Context

Matt Pocock's `to-spec` publishes the spec into the issue tracker. The AI-native SDLC playbook asks that every stage end in a committed artifact so the git history is the audit trail. Tickets need blocking edges, claims and a frontier, which only a tracker renders natively.

## Decision

The map, the intent, the spec and the plan are files under `docs/efforts/<slug>/` on the effort branch. The tracker issue carries a link to the file and the `ready-for-agent` label, never a copy. Tickets stay on the tracker (or under `.scratch/<slug>/issues/` on the local tracker, which is also on the branch).

## Consequences

- One source of truth per artifact, reviewable in the PR; the tracker shows the live state of the tickets.
- A thin frame around `to-spec` and `to-tickets` replaces their publish step; the procedures themselves are read unmodified.
