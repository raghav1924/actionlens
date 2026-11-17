# Frequently Asked Questions (actionlens)

### 1. Does actionlens require external npm dependencies?
No. actionlens is engineered to run with zero external runtime npm dependencies, relying exclusively on Node.js standard libraries and strict TypeScript.

### 2. Can actionlens run inside automated CI/CD pipelines?
Yes. actionlens includes dedicated CLI flags and exit codes designed specifically for GitHub Actions, GitLab CI, and Docker build steps.

### 3. How do I start the local Web Studio?
Run the `studio` subcommand from your terminal:
```bash
npx actionlens studio
```
Then visit the designated local port in your browser.

### 4. What Node.js versions are supported?
Node.js v18.0.0 and above (LTS 18, 20, and 22).

---
*Need more help? Contact [Jatin Sharma](https://jatinsh.netlify.app/)*
