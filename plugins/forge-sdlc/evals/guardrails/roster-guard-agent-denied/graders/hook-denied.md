---
type: regex
target: trace
pattern: 'Agent call outside the roster \(docs/agents/forge\.yaml, enforce: true\): fill a role with it or list it under allow\.agents'
---

The deny reason of hooks/scripts/roster-guard.mjs for an Agent call the roster does not account for: it names the file and the keys, never the type.
