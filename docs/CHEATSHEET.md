# ActionLens CLI Cheatsheet

```bash
# Audit all workflow files in repository
actionlens audit .github/workflows/*.yml

# Enforce strict CI quality gates
actionlens audit . --min-score=85 --fail-on-sec

# Visualize job DAG and critical path
actionlens dag .github/workflows/ci.yml

# Automatically harden workflows
actionlens fix .github/workflows/ci.yml
```
