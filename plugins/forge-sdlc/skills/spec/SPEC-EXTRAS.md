# Spec extras

What forge-sdlc adds to Matt's `to-spec` template. The template itself is read from the upstream file (`node "${CLAUDE_PLUGIN_ROOT}/bin/skill-path.mjs" to-spec`) and used unmodified; this file holds only the frame around it.

## Frontmatter

The spec opens with the artifact frontmatter of `docs/contracts.md`, `risk` copied from `intent.md`:

```yaml
---
effort: <slug>
stage: spec
status: draft
risk: normal | high
updated: <YYYY-MM-DD>
---
```

Then the template's sections in its order, then the three sections below, in this order, each present even when its body is `- none`.

## Affected users and systems

One bullet per user group and per system the change touches, with how: reads, writes, calls, is called by, migrates. Users come from the intent's users; systems from the codebase (modules, services, stores, queues, third parties) found while exploring. A system a policy skill names as sensitive carries that word.

```markdown
- <user group>: <what changes for them>
- <system or module>: <reads | writes | calls | is called by | migrates> <what>
```

## Flagged concerns

A concern a policy skill (host config, `## Policy skills`) raised that the spec could not resolve from the intent, the decisions and the codebase. The owner settles each one at Gate 2; a flagged concern is why the spec stops there.

```markdown
- <skill name>: <the concern, one sentence> (section: <the spec section it bears on>)
```

`- none` when every concern a policy skill raised was resolved inside the spec.

## Assumptions to confirm

The assumption lines of `docs/contracts.md`, one per line, `open` first:

```markdown
- recommended: <the reading taken> (source: <ticket name, doc, or "none">)
- open: <the question only the owner can settle>
```

Every `recommended` line of `intent.md` is carried over verbatim. A choice the synthesis had to make (a seam, a module boundary, an interface) adds a `recommended` line with its source. `open` is written only when no reading in the artifacts supports a choice; it stops the front door at Gate 2.
