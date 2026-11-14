# CI/CD Performance & Cost Optimization Recipes

Actionable recipes to reduce runner minutes, eliminate queue clogs, and cut GitHub Actions billing with **ActionLens**.

Author: [Jatin Sharma](https://jatinsh.netlify.app/) (`@raghav1924`)

---

## 1. Concurrency Cancellation Group

When developers push 4 commits in 5 minutes, default GitHub Actions triggers 4 parallel builds. Cancel outdated runs automatically:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

---

## 2. Hard Execution Timeout Ceilings

Avoid burning 360 minutes when a headless browser test deadlocks or a network request hangs:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10 # Enforces 10 minute ceiling
```

---

## 3. Native Package Manager Caching

Leverage native caching in official setup actions rather than configuring manual `actions/cache`:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: 'npm' # or 'pnpm', 'yarn'
```
