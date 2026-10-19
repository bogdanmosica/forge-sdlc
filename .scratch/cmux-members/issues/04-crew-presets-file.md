# 04: cmux-members-04: Crew presets file

Type: slice
Status: resolved
Labels: ready-for-agent
Spec: `docs/efforts/cmux-members/spec.md` on `feat/cmux-members`

**What to build:** The plugin ships its crew presets: `crew.json` in the plugin root with the five prior-sdlc themes under the ids `warcraft`, `star-trek`, `star-wars`, `got`, `mario`, each with a label and the eight forge pools (researcher, prototyper, spec-writer, implementer, verifier, reviewer, merger, general) rebuilt from prior-sdlc's pools as the spec maps them, names in display form. Every pool holds at least three names and every implementer pool at least five; where prior-sdlc's pool is shorter, names from the same world are added. Handle forms are unique within a pool. A structural test proves all of it.

**Blocked by:** None (can start immediately)

- [ ] `crew.json` parses, has exactly the five ids with labels, and every preset has the eight roles
- [ ] Every pool has at least three names, every implementer pool at least five
- [ ] No two names in a pool share a handle form (letters, digits, `_`, `-` after folding)
- [ ] The source presets at `<prior-sdlc>/crew.json` are read for the names, never copied as a file

## Proof

`node --test tests/crew-presets.test.mjs` → passes the structural checks

## Assumptions

- recommended: `crew.json` keeps prior-sdlc's shape, `{ "_comment", "presets": { "<id>": { "label", "names": { "<role>": [...] } } } }`, with the eight forge roles as the `names` keys (source: spec, Implementation Decisions, "The presets file": "each with a label and the eight forge pools")
- recommended: the `general` pool lists prior-sdlc's implementer-markup names first, then its general names (source: spec, "The presets file": "implementer-markup together with prior-sdlc's general to general")
- recommended: the added same-world names are Tirion Fordring, Kira Nerys, Hera Syndulla, Catelyn Stark and Dixie Kong (merger pools) and Toadsworth (Super Mario spec-writer) (source: spec, "The presets file": "names from the same world are added")

## Comments

- merged 072d298; review record: /Users/mosica.bogdan/Desktop/personal/forge-sdlc/.forge/review/cmux-members-04.md
