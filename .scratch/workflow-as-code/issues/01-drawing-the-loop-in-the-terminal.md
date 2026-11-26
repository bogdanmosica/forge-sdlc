# Drawing the loop in the terminal

Type: research
Status: resolved
Labels: wayfinder:research
Blocked by: none
Map: ../map.md

## Question

The `/forge` panel (`plugins/forge-sdlc/hooks/forge.tsx`, tables in `hooks/forge/help.ts`) shows the loop as a table today. What can the plugin engine's UI draw in a panel to show the loop as a flow diagram instead: which components and layout primitives the engine declares (`plugins/forge-sdlc/hooks/types/claude-code.d.ts`), box-drawing text, colour and highlight for the current stage and a stopped gate, width limits and narrow-terminal fallback? Is there any Mermaid or graph rendering in the engine, or must the panel lay the boxes out itself? How do other panels in this plugin (`run-pane.tsx`, `boards.tsx`, `focus.tsx`) lay out multi-column content? Also confirm GitHub renders a ```mermaid block in a PR body and in README (and any size or feature limits that matter for a ~12-node flowchart with subgraphs). Note: `docs/research/workflow-as-code/terminal-diagram.md`.

## Answer

Resolved 2026-11-22 by the researcher (Uhura); note `docs/research/workflow-as-code/terminal-diagram.md`. The engine has no diagram or graph renderer: the `/forge` panel lays the loop out itself from `Box` (flex, borders, gap, width), `Text` (colour, bold, inverse, dim) and box-drawing characters, sized to `bodyColumns`. Five stages with gate chips do not fit the 72-column body horizontally, so the panel draws the loop vertically (stage boxes stacked, gate rows between) with a one-line-per-stage fallback on narrow widths (floor 24). GitHub renders a fenced `mermaid` block in PR bodies and Markdown files; Mermaid's default limits are far above a ~12-node chart, so `bin/workflow.mjs --mermaid` feeds both README and PR body. Open hypotheses for the build: `borderStyle` names, GitHub's support for subgraphs and `classDef` styling.
