# Script Injection in GitHub Actions

Untrusted context variables interpolated directly into inline `run:` scripts allow arbitrary command execution:
```yaml
# VULNERABLE: Direct expression expansion
run: echo "Processing PR: ${{ github.event.pull_request.title }}"

# HARDENED: Intermediate environment variable mapping
env:
  PR_TITLE: ${{ github.event.pull_request.title }}
run: echo "Processing PR: $PR_TITLE"
```
