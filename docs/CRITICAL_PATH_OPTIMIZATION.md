# Pipeline Concurrency & Runner Optimization

ActionLens analyzes job `needs:` dependencies to calculate:
- The longest sequential bottleneck (critical path).
- Concurrency bottlenecks where parallelization reduces billable runner minutes.
- Redundant builds that should be killed via `concurrency: group: ${{ github.ref }}, cancel-in-progress: true`.
