# Contributing to ActionLens

Thank you for your interest in improving **ActionLens**!

Author: [Jatin Sharma](https://jatinsh.netlify.app/) (`@raghav1924`)

## Development Setup

ActionLens has **zero external dependencies**. All you need is Node.js (v18+) and TypeScript.

```bash
# Clone the repository
git clone https://github.com/raghav1924/actionlens.git
cd actionlens

# Compile TypeScript
npm run build

# Run unit tests
npm test

# Run local web studio
npm start
```

## Pull Request Guidelines

1. Ensure all tests pass (`npm test`).
2. Add comprehensive unit tests in `src/tests/` for any new audit heuristics or parser enhancements.
3. Keep the codebase strictly zero-dependency (rely solely on Node.js built-ins).
4. Adhere to conventional commit messages (`feat:`, `fix:`, `docs:`, `test:`, `ci:`).

