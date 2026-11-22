# 07: roster-as-code-02: bin/roster.mjs and readRoster

Type: slice
Status: open
Labels: ready-for-agent
Spec: `docs/efforts/roster-as-code/spec.md` on `feat/roster-as-code`

**What to build:** `lib.mjs` gains `readRoster(hostDir)`; `bin/roster.mjs <slot> --project <host>` prints the slot's skill or `disabled` (`policy` comma-separated or `none`), and `bin/roster.mjs --project <host>` prints the resolved roster as JSON with `problems`; exit 2 on an unknown slot or a missing `--project`; defaults without `forge.yaml`.

**Blocked by:** roster-as-code-01

- [ ] each slot prints its line, `disabled` and `policy` as specified
- [ ] the JSON form carries problems
- [ ] exit 2 on bad usage
- [ ] defaults without forge.yaml

## Proof

```sh
node --test tests/roster-bin.test.mjs
```

passes against fixture hosts in a temp dir

## Comments
