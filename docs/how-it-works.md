# How forge-sdlc works

Diagrams of the plugin as it stands after `feat/autonomous-gates` (ADR 0018). The rules behind them live in [design.md](design.md), the names and schemas in [contracts.md](contracts.md), the gate rule in [GATE-POLICY.md](../plugins/forge-sdlc/skills/wayfinder/GATE-POLICY.md). Where a diagram and those files disagree, the files win.

## 1. The loop, end to end

One effort is one folder `docs/efforts/<slug>/`, one pushed branch `feat/<slug>`, one PR. `/forge-sdlc:wayfinder` is the front door: it starts an effort from an idea or issue, and resumes one from its slug. Yellow hexagons are gates.

```mermaid
flowchart TD
    idea(["idea · #issue · slug"]) --> wf

    subgraph Plan["Plan · /forge-sdlc:wayfinder"]
        wf["chart map.md<br/>Destination + tickets"] --> work["work the tickets<br/>grilling: HITL in session<br/>research: researcher<br/>prototype: prototyper"]
        work -->|ticket graduates fog| work
        work -->|no ticket open| intent["write intent.md<br/>assumption lines, risk from globs<br/>open draft PR or PR.md"]
    end

    intent --> g1{{"Gate 1 · intent"}}
    g1 --> spec

    subgraph Design["Design · /forge-sdlc:spec"]
        spec["spec-writer synthesises spec.md<br/>to-spec + policy skills<br/>Flagged concerns, Assumptions"]
    end

    spec --> g2{{"Gate 2 · spec"}}
    g2 --> plan

    subgraph Build1["Build 1 · /forge-sdlc:plan"]
        plan["to-tickets: tracer-bullet slices<br/>blockers, proof per slice<br/>quiz = the gate"]
    end

    plan --> g3{{"Gate 3 · plan"}}
    g3 --> build

    subgraph Build2["Build 2 + Test · /forge-sdlc:build (unattended)"]
        build["implementers · verifier · merger · reviewers ×3<br/>frontier up to max_parallel_slices"]
    end

    build --> g4{{"Gate 4 · PR ready<br/>always the code owner"}}
    g4 --> merged(["merged to main by a human"])

    classDef gate fill:#fde68a,stroke:#b45309,color:#000
    class g1,g2,g3,g4 gate
```

## 2. Who passes a gate

`## Gates` → `policy` in the host's `docs/agents/forge.md`. This repo runs `autonomous`, so a single `wayfinder` run goes from idea to the first stop or Gate 4.

```mermaid
flowchart TD
    at["stage done, artifact committed"] --> pol{"gates.policy"}
    pol -->|attended| stopA["stop: owner passes it<br/>by typing the next command"]
    pol -->|autonomous| risk{"risk: high?"}
    risk -->|yes| stopR["stop: risk-high<br/>effort runs attended from here<br/>Gate 2 labels needs-tech-lead"]
    risk -->|no| open{"open: line in<br/>the gate's artifact?"}
    open -->|yes| stopO["stop: open"]
    open -->|no| flag{"Gate 2 only:<br/>Flagged concerns<br/>other than '- none'?"}
    flag -->|yes| stopF["stop: flagged"]
    flag -->|no| pass["report 'Gate n passed:<br/>policy autonomous, nothing open'<br/>wayfinder reads the next stage's SKILL.md"]

    stopA --> resume(["/forge-sdlc:wayfinder slug<br/>resumes from .forge/state.json"])
    stopR --> resume
    stopO --> resume
    stopF --> resume

    classDef stop fill:#fecaca,stroke:#b91c1c,color:#000
    classDef ok fill:#bbf7d0,stroke:#15803d,color:#000
    class stopA,stopR,stopO,stopF stop
    class pass ok
```

A stop writes `stop: open | flagged | risk-high` beside `gate` in `.forge/state.json`; every other stage write drops it. Under `attended`, Gate 2 still honours `spec: only-on-open`. At Gate 3 under `autonomous` the quiz answers itself: four `recommended:` lines in `plan.md`'s `## Quiz`, copied under the PR's slice table for review at Gate 4.

## 3. Inside a build

Every agent is a **member call** ([MEMBERS.md](../plugins/forge-sdlc/skills/build/MEMBERS.md)): named by `bin/crew-name.mjs` from the host's crew theme, a visible pane under a `cmux claude-teams` lead, a subagent under a plain one.

```mermaid
sequenceDiagram
    autonumber
    participant B as build (lead session)
    participant X as researcher
    participant I as implementer (slice worktree)
    participant S as Stop hook
    participant V as verifier
    participant M as merger
    participant R as reviewer ×3

    B->>X: exploration brief
    X-->>B: notes in .forge/notes/slug/
    loop each ticket on the frontier (≤ max_parallel_slices)
        B->>I: background call: ticket, spec, plan, worktree, proof
        B->>B: record slice.agent = Agent id
        I->>I: tdd, small commits on slice/slug-nn
        I->>I: bin/verify-record.mjs
        I->>S: tries to stop
        alt record green at current HEAD
            S-->>I: allow
        else missing, red or stale
            S-->>I: block: run verify-record (3 blocks → slice red)
        end
        I-->>B: report (a claim)
        opt record not fresh and green
            B->>V: run proof + host proof commands
            V-->>B: .forge/verify/slug-nn.json
        end
        B->>M: merge slug-nn
        M->>R: Standards · Spec · Bugs and security (parallel)
        R-->>M: Important / Nit
        alt Important findings, round ≤ 2
            M->>I: foreground fix implementer (same name, mode: fix)
            M->>V: re-verify
            M->>R: re-review
        end
        alt clean
            M->>M: merge --no-ff into feat/slug, push, drop worktree, resolve ticket
            M-->>B: merged
        else still Important after 2 rounds
            M-->>B: red (branch + worktree kept, never pushed)
        end
        B->>B: end implementer + merger, start newly unblocked tickets
    end
    B->>B: PR body: Summary, Evidence, Merge Danger, Red slices
    Note over B: mark PR ready → Gate 4
```

### A slice's life

```mermaid
stateDiagram-v2
    [*] --> open: plan publishes the ticket
    open --> building: on the frontier, implementer started
    building --> verified: verify record green at HEAD
    building --> red: Stop hook refused 3 times
    verified --> merged: slice-review clean
    verified --> building: Important finding, fix round (≤ 2)
    verified --> red: still Important after 2 rounds
    open --> red: blocked by a red slice
    merged --> [*]
    red --> [*]: listed under Red slices in the PR
```

## 4. Branches and where things live

```mermaid
flowchart LR
    main[("main<br/>protected")] -->|effort starts| feat["feat/slug<br/>map, intent, spec, plan,<br/>research notes, merges"]
    feat -->|cut from tip| s1["slice/slug-01<br/>.forge/worktrees/slug-01"]
    feat -->|cut from tip| s2["slice/slug-02<br/>.forge/worktrees/slug-02"]
    s1 -->|merger merges, no-ff| feat
    s2 -->|merger merges, no-ff| feat
    feat -->|the only pushed ref| origin(("origin / PR"))
    origin -->|human merges at Gate 4| main

    subgraph local[".forge/ (gitignored)"]
        state["state.json<br/>stage, gate, stop, slices, crew"]
        verify["verify/slug-nn.json<br/>+ .denials"]
        review["review/slug-nn.md"]
        notes["notes/slug/"]
    end
```

## 5. What the hooks enforce

Skills advise, hooks enforce. Each hook reads `.forge/state.json`, `docs/agents/forge.md` and git, never the conversation.

```mermaid
flowchart LR
    subgraph Pre["PreToolUse"]
        pb["protected-branch<br/>no edit/commit on main"]
        sf["spec-frozen<br/>intent/spec/plan read-only<br/>once stage is build"]
        tf["test-frozen<br/>test globs read-only<br/>in a checkout in fix mode"]
        sp["slice-push<br/>push only feat/slug"]
        sd["secrets-in-diff<br/>no credential shapes<br/>or .env in a commit"]
    end
    subgraph Post["PostToolUse"]
        fmt["format-after-edit<br/>run the host formatter"]
    end
    subgraph StopEv["Stop / SubagentStop"]
        vbs["verified-before-stop<br/>green record at HEAD or blocked"]
    end
    subgraph Start["SessionStart"]
        sv["skills-version<br/>mattpocock-skills vs UPSTREAM.lock"]
    end

    ew(["Edit · Write"]) --> pb & sf & tf
    ew --> fmt
    bash(["Bash"]) --> pb & sp & sd
    stopev(["agent stops"]) --> vbs
    sess(["startup · resume · clear"]) --> sv
```

## 6. Commands at a glance

| Command | Does |
| --- | --- |
| `/forge-sdlc:init` | once per host: writes `docs/agents/forge.md`, the CLAUDE.md delivery-loop block, gitignores `.forge/` |
| `/forge-sdlc:wayfinder <idea \| #issue \| slug>` | the front door: starts or resumes an effort and runs to the next stop |
| `/forge-sdlc:intent <slug>` | reshape a charted map's Destination by hand |
| `/forge-sdlc:spec <slug>` · `plan <slug>` · `build <slug>` | rerun one stage by hand |
| `/forge-sdlc:slice-review <slice-branch>` | the merger's three-axis review, by hand |
| `/forge-sdlc:status [slug]` | read-only: stage, gate, stop, next command, frontier, red slices |
