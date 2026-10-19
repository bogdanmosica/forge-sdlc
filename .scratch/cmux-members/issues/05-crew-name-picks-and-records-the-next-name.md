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
