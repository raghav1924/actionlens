# ActionLens Architecture & Technical Specifications

This document details the internal architecture, lexical YAML parsing engine, security heuristics, DAG topological analyzer, and auto-hardening synthesizer of **ActionLens**.

Author: [Jatin Sharma](https://jatinsh.netlify.app/) (`@raghav1924`)

---

## Architectural Pipeline

```
GitHub Actions Workflow Files (.github/workflows/*.yml)
                          │
                          ▼
             [ YAML Lexer & AST Parser ]
             - Indentation state machine
             - Key-value, list & multi-line scalar parsing
             - Triggers, permissions, concurrency, jobs & steps
                          │
                          ├────────────────────────┬────────────────────────┐
                          ▼                        ▼                        ▼
               [ Security Auditor ]     [ Performance Engine ]   [ DAG Topology Builder ]
               - Script injections      - Timeout ceilings       - Needs dependency graph
               - Toxic PR targets       - Concurrency cancel     - Critical path calculation
               - Unpinned actions       - Cache configurations   - Mermaid LR synthesis
                          │                        │                        │
                          └────────────────────────┴────────────────────────┘
                                                   │
                                                   ▼
                                       [ ActionLens Aggregator ]
                                       - 0-100% Health Score
                                       - Letter Grade (A+ to F)
                                                   │
                                    ┌──────────────┴──────────────┐
                                    ▼                             ▼
                          [ CLI Terminal Gate ]         [ Web Studio (:5252) ]
                          - CI Quality Gates            - Visual DAG inspector
                          - Auto-Hardener ('fix')       - One-click remediations
```

---

## 1. Zero-Dependency YAML Lexer (`src/core/parser.ts`)

ActionLens operates with zero third-party dependencies, implementing an indentation-aware recursive parser tailored for GitHub Actions specifications:
- Preserves precise line numbers for every job and step for pinpoint CLI and visual error reporting.
- Transparently normalizes multi-line run scripts (`|` and `>`), flow mappings (`{...}`), and flow sequences (`[...]`).
- Strips variable padding and handles Windows CRLF line terminations.

---

## 2. Security Heuristics Engine (`src/core/auditor.ts`)

- **SEC-001 (Script Injection):** Detects expressions inside inline bash `run:` scripts that attackers can manipulate via issues, PR titles, or git branch names (`github.event.issue.title`, `github.head_ref`). Advises passing untrusted contexts via environment variables (`env:`).
- **SEC-002 (Toxic `pull_request_target`):** Flags workflows triggered on `pull_request_target` that check out untrusted pull request code via `ref: ${{ github.event.pull_request.head.sha }}`.
- **SEC-003 (Unpinned Actions):** Identifies external actions relying on mutable git tags (`@v1`, `@main`), exposing the pipeline to supply-chain tampering.
- **SEC-004 (Permissive GITHUB_TOKEN):** Flags workflows without explicit `permissions:` declarations, enforcing least-privilege scoping (`contents: read`).
- **SEC-005 (Secret Reflection):** Detects steps echoing secret contexts directly to runner stdout.

---

## 3. DAG Topology & Critical Path Engine (`src/core/graph.ts`)

- Constructs a directed acyclic graph $G = (V, E)$ based on `needs:` attributes.
- Computes the topological depth of each job and pinpoints the critical execution path (the longest path dictating minimum workflow runtime).
- Calculates `maxParallelJobs` to help teams size self-hosted runner fleets or avoid runner queue contention.
- Synthesizes Mermaid flowchart syntax dynamically.

---

## 4. Automated Workflow Hardener (`src/core/hardener.ts`)

- Non-destructively injects least-privilege `permissions:` and `concurrency:` groups.
- Adds `timeout-minutes: 15` to jobs lacking ceilings.
- Automatically upgrades legacy Node 12/16/18 actions (`actions/checkout@v2` -> `@v4`).

