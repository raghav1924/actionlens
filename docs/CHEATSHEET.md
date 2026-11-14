# ActionLens CLI Cheatsheet & Quick Reference

A fast reference guide for using **ActionLens** in terminal workflows and automation pipelines.

Author: [Jatin Sharma](https://jatinsh.netlify.app/) (`@raghav1924`)

---

## Command Reference

| Command | Arguments | Description | Example |
|---|---|---|---|
| `audit` | `[path]` | Scan workflows for security & performance flaws | `actionlens audit .` |
| `audit` | `--fail-on-sec` | Fail build (exit 1) on any CRITICAL vulnerability | `actionlens audit . --fail-on-sec` |
| `audit` | `--min-score=<n>` | Enforce minimum threshold score (default: 75) | `actionlens audit . --min-score=90` |
| `audit` | `--json` | Output machine-readable JSON for CI integration | `actionlens audit . --json` |
| `fix` | `<file>` | Auto-harden permissions, concurrency, and timeouts | `actionlens fix .github/workflows/ci.yml` |
| `dag` | `<file>` | Output DAG dependency topology and Mermaid diagram | `actionlens dag .github/workflows/ci.yml` |
| `studio` | `--port=<p>` | Launch dark-mode interactive Web Studio | `actionlens studio --port=5252` |
| `version` | | Print current version string | `actionlens version` |
| `help` | | Display help documentation | `actionlens help` |

---

## Automated Hardening Pattern

Before committing any new workflow, run:

```bash
# 1. Audit workflow
npx actionlens audit .github/workflows/deploy.yml

# 2. Automatically apply fixes
npx actionlens fix .github/workflows/deploy.yml

# 3. Verify DAG critical path
npx actionlens dag .github/workflows/deploy.yml
```

