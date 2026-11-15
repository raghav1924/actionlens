# Automated Workflow Hardener

Apply automated fixes with `actionlens fix`:
- Injects explicit top-level least-privilege `permissions: contents: read`.
- Injects job-level timeout protection (`timeout-minutes: 30`).
- Adds concurrency cancellation to kill redundant in-flight builds.
