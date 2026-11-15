# Pipeline DAG & Critical Path Optimization

ActionLens analyzes job `needs:` dependencies to calculate:
- Critical execution path (slowest sequential chain).
- Maximum job concurrency bottlenecks.
- Parallelization opportunities to reduce billable runner minutes.
