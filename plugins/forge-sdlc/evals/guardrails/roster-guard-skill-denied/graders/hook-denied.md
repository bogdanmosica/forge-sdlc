---
type: regex
target: trace
pattern: 'Skill call outside the roster \(docs/agents/forge\.yaml, enforce: true\): fill a slot with it or list it under allow\.skills'
---

The deny reason of hooks/scripts/roster-guard.mjs for a Skill call the roster does not account for: it names the file and the keys, never the skill.
