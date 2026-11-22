# Workflow as code: the forge-sdlc loop declared in forge.yaml and drawn as a diagram

Labels: wayfinder:map
Status: open

Map body: `docs/efforts/workflow-as-code/map.md` on `feat/workflow-as-code`.

Gist: forge.yaml's `workflow:` describes the loop (stages, gates, who passes each, stops) and holds its autonomy knobs per gate; `bin/workflow.mjs --mermaid` and the `/forge` panel draw it from the same file.
