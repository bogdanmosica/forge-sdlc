# Enforcement scope

Type: grilling
Status: open
Labels: wayfinder:grilling
Blocked by: 02, 04
Map: ../map.md

## Question

Under `enforce: true`, which calls does the hook deny: only member calls a forge-sdlc stage makes, or every Agent and Skill call in the host (built-ins like `Explore`, `general-purpose`, unrelated skills)? Does it apply outside an effort, to the lead and to members alike, and what does the deny reason say (role, file, what to do instead, never the matched value)? What happens when the roster itself is invalid under enforcement: fail open or closed?
