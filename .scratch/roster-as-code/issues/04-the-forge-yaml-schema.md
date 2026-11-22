# The forge.yaml schema

Type: grilling
Status: open
Labels: wayfinder:grilling
Blocked by: 01, 02, 03
Map: ../map.md

## Question

The exact shape of `docs/agents/forge.yaml`: top-level keys (a `version`, `roles`, `slots`, `enforce`), how a role entry names its agent, model and effort, how a slot entry names its skill or `disabled`, how a host-local agent is referenced, what the resolver prints, and how the shape stays open to later workflow and measurement layers. Bounded by the YAML subset (YAML without a dependency), the swap mechanism (Rewriting a call's target) and the slot table (Inventory of roles and skill slots).
