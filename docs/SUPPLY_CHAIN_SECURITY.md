# GitHub Actions Supply Chain Attack Vectors

Mitigating supply-chain vulnerabilities in CI/CD pipelines:
- **Mutable Action Tags**: Third-party actions pinned to `@v1` or `@main` can be hijacked if the maintainer's account is breached. Pin to full immutable commit SHAs.
- **Untrusted PR Triggers**: Never combine `pull_request_target` with explicit checkouts of the untrusted fork branch.
