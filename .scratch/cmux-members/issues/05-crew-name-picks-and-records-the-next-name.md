# 05: cmux-members-05: crew-name.mjs picks and records the next name

Type: slice
Status: ready-for-agent
Labels: ready-for-agent
Spec: `docs/efforts/cmux-members/spec.md` on `feat/cmux-members`

**What to build:** A skill runs `bin/crew-name.mjs <role> --project <host> --effort <slug> [--slice <slug>-<nn>]` and gets one line, the member's name in handle form, exit 0; exit 2 on an unknown role or a missing flag. It resolves the role's pool (a `names.<role>` override first, else the preset the theme names, else the fallback `<slug>-<nn>` for an implementer with `--slice` and `<role>` otherwise), picks the first name not in the effort's `crew.<role>`, restarts with `-2` then `-3` when the pool runs out, numbers the fallback the same way, reuses a slice's `member` when it already has one, and writes `crew.<role>` and the slice's `member` through the hooks' lib. Handle form: diacritics folded, spaces to `-`, everything but letters, digits, `_` and `-` dropped, runs of `-` collapsed. An effort absent from state prints a name and records nothing. CLAUDE.md's Commands list gains the script's line.

**Blocked by:** 03 (Crew theme in the contracts, config and init), 04 (Crew presets file)

- [ ] A preset theme prints the role's first name in handle form and records it; a second call prints the next; a pool run out restarts with `-2`, then `-3`
- [ ] `--slice` picks and writes `member`; a second call with the same slice prints the same name and records nothing new
- [ ] A `names.<role>` override and a free-text theme with `names` bullets are honoured; roles without names fall back; `theme: none` and no `## Crew` print `<slug>-<nn>` or `<role>`, `verifier` then `verifier-2`
- [ ] "Seven of Nine" is `Seven-of-Nine`, "Miles O'Brien" is `Miles-OBrien`; every printed name matches `^[A-Za-z0-9_-]+$`
- [ ] An effort absent from state leaves the state file unchanged; an unknown role and a missing flag exit 2

## Proof

`node --test tests/crew-name.test.mjs` → passes against the shipped presets over fixture hosts

## Assumptions

- recommended: the handle form also drops a `-` at either end and skips a name with nothing left (`- Kes -` is `Kes`, `!!!` is skipped); prior-sdlc's 64-character cap is not kept, as no shipped name nears it (source: spec, Implementation Decisions, "The name script", handle form; notes 1.4)
- recommended: a `names.<role>` override with no name left in handle form counts as no override, so the preset applies, else the fallback (source: spec, "A `names.<role>` override comes first. Otherwise it takes the preset the `theme` names")
- recommended: `--slice` with a role other than `implementer` exits 2, since a slice's `member` is its implementer's name (source: spec, "Each slice gains `member` (its implementer's name, or absent)"; "with `--slice` for an implementer")
- recommended: `--slice` on a slice absent from the effort's `slices` writes `{ member }` there; the build publishes slices before it names implementers (source: spec, "it picks as above and writes the name to both `crew.<role>` and the slice's `member`")
- recommended: the presets test imports `handleOf` from `crew-name.mjs` (the script runs only as a script, not on import) and drops its own copy and examples test, whose cases moved to `tests/crew-name.test.mjs` (source: .forge/review/cmux-members-04.md, Standards and Spec nits)
- recommended: `--effort` must be a slug, `^[a-z0-9]+(-[a-z0-9]+)*$`, else exit 2, so the `<slug>-<nn>` fallback is always in handle form; a stored `member` is printed in handle form, one with nothing left is picked again, and a `crew.<role>` that is not a list counts as none used (source: spec, "The name script", handle form; .forge/review/cmux-members-05.md Round 1)

## Comments
- red (merger): Bugs and security has one Important finding left after two fix rounds: the `record.updatedAt` refresh in crew-name.mjs has no test that fails when it is removed. Findings: /Users/mosica.bogdan/Desktop/personal/forge-sdlc/.forge/review/cmux-members-05.md. Slice branch and worktree stay for the implementer.
