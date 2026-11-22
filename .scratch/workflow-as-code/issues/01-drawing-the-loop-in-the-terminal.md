# Drawing the loop in the terminal

Type: research
Status: open
Labels: wayfinder:research
Blocked by: none
Map: ../map.md

## Question

The `/forge` panel (`plugins/forge-sdlc/hooks/forge.tsx`, tables in `hooks/forge/help.ts`) shows the loop as a table today. What can the plugin engine's UI draw in a panel to show the loop as a flow diagram instead: which components and layout primitives the engine declares (`plugins/forge-sdlc/hooks/types/claude-code.d.ts`), box-drawing text, colour and highlight for the current stage and a stopped gate, width limits and narrow-terminal fallback? Is there any Mermaid or graph rendering in the engine, or must the panel lay the boxes out itself? How do other panels in this plugin (`run-pane.tsx`, `boards.tsx`, `focus.tsx`) lay out multi-column content? Also confirm GitHub renders a ```mermaid block in a PR body and in README (and any size or feature limits that matter for a ~12-node flowchart with subgraphs). Note: `docs/research/workflow-as-code/terminal-diagram.md`.
