# Product Brief: ActionLens

**Product Name:** ActionLens  
**Tagline:** Developer-First GitHub Actions Workflow Linter, Security Auditor, CI/CD Optimizer & Visual Pipeline Studio.  
**Author:** [Jatin Sharma](https://jatinsh.netlify.app/) (`@raghav1924`)  
**Target Repository:** `https://github.com/raghav1924/actionlens`  
**Date:** 2026-11-14 (Build #9)  

---

## 1. Problem Statement

GitHub Actions is the default CI/CD standard for millions of engineering teams. However, workflow configurations (`.github/workflows/*.yml`) are written in unstructured YAML with minimal compile-time safety or local validation:

1. **Catastrophic Security Vulnerabilities:**
   - **Script Injection in `run:` steps:** Using untrusted context variables (`${{ github.event.issue.title }}`, `${{ github.event.pull_request.head.ref }}`) allows attackers to execute arbitrary bash commands and steal repository secrets.
   - **Toxic `pull_request_target` Triad:** Combining `pull_request_target` with checkouts of untrusted pull request code leads to immediate repository compromise.
   - **Unpinned Third-Party Actions:** Referencing mutable action tags (`@v1`, `@main`) leaves builds vulnerable to supply-chain tampering and upstream compromises.
   - **Permissive Default GITHUB_TOKEN:** Lacking explicit `permissions:` defaults grants broad write privileges to all jobs.
2. **Costly Performance Traps & Bloat:**
   - **Missing Timeout Ceilings:** Without `timeout-minutes`, a hung test or deadlocked runner burns the maximum 6-hour runner allowance.
   - **Missing Concurrency Cancellation:** Developers pushing commits in rapid succession trigger duplicate, wasteful parallel CI runs that clog queues and inflate cloud bills.
   - **Uncached Package Managers:** Redownloading node_modules on every commit wastes 2-5 minutes per run.
3. **Lack of Local Visualization & Developer Experience:**
   - Developers commit broken YAML to GitHub just to see if it parses or fails.
   - Job dependency graphs (`needs:`) are difficult to reason about in complex monorepo matrices.

---

## 2. Solution: ActionLens

**ActionLens** is an open-source, zero-dependency static analysis and pipeline optimization studio built in TypeScript for Node.js standard runtime.

### Key Capabilities:
- **Zero-Dependency YAML AST Parser:** Parses GitHub Actions workflows without external YAML dependencies, preserving line numbers, comments, and expressions.
- **12+ Production Security & Performance Heuristics:**
  - `SEC-001`: Script injection detection in `run:` commands.
  - `SEC-002`: Dangerous `pull_request_target` untrusted checkout auditor.
  - `SEC-003`: Mutable action version tag scanner (advises commit SHA pinning).
  - `SEC-004`: Overly permissive GITHUB_TOKEN permissions auditor.
  - `SEC-005`: Unmasked raw secret reflection check.
  - `OPT-001`: Missing job timeout ceiling linter.
  - `OPT-002`: Missing concurrency cancellation gatekeeper.
  - `OPT-003`: Missing package manager cache configuration auditor.
  - `OPT-004`: Deprecated Node runtime action linter.
- **DAG Job Topology & Critical Path Calculator:** Computes critical path, dependency bottlenecks, and parallelization efficiency.
- **Interactive Dark-Mode Web Studio (:5252):** Embedded dashboard with live DAG visualization, security health score (0-100%), and interactive one-click YAML remediation.
- **Auto-Hardener (`actionlens fix`):** Automatically injects safe permissions, concurrency rules, and timeouts into existing YAML workflows.

---

## 3. Zero External Dependencies Architecture

ActionLens strictly uses Node.js standard modules:
- `node:fs` & `node:path`: Filesystem traversal of `.github/workflows/`.
- `node:http`: Embedded HTTP web studio server.
- `node:crypto`: Hash calculation and workflow fingerprinting.
- Pure TypeScript implementation for AST tokenization and graph DAG traversal.

