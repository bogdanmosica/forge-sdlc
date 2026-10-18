# 03: cmux-members-03: crew.mjs spawn with detection and fallback

Type: slice
Status: ready-for-agent
Labels: ready-for-agent
Spec: `docs/efforts/cmux-members/spec.md` on `feat/cmux-members`

**What to build:** A lead inside cmux runs `crew.mjs spawn --slice <slug>-<nn> --project <host> --task <file>` and gets a member: the script applies the detection (`## Crew` mode auto or crew, the workspace id variable set, the script path existing and executable), calls crew.sh with the fixed flags (role `forge-sdlc:implementer`, `--task @<file>`, `--repo <worktree>`, `--permission-mode auto`, `--name <slug>-<nn>`, no `--worktree`, `--model` or `--effort`), parses the MEMBER and RECORD line, writes `member: { id, record }` on the slice and prints `transport: member`. Any failed condition, `mode: agent` or a non-zero crew.sh exit prints `transport: agent` with a one-line reason naming the condition and writes `member: null`. Exit 0 for an answer, 2 for bad usage. CLAUDE.md's Commands list gains the script's line.

**Blocked by:** 01 (Crew section and member field in the contracts)

- [ ] A fake crew.sh named by `## Crew` `script` receives exactly the fixed flags and the member lands in state
- [ ] Workspace variable unset, script missing, script not executable, `mode: agent`, and a spawn that exits 1 each answer `transport: agent` with a reason naming the condition, and crew.sh is not called where it must not be
- [ ] No `## Crew` section reads as `auto` with the default script
- [ ] The reason never includes crew.sh's full output

## Proof

`node --test tests/crew.test.mjs` → passes its spawn and fallback cases against a fake crew.sh
