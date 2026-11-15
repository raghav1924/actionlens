# Pull Request Linter in GitHub Actions

Audit workflows before merging:
```yaml
- name: Lint Workflow Definitions
  run: node dist/bin.js audit .github/workflows/*.yml --fail-on-sec --min-score=85
```
