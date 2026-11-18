#!/usr/bin/env bash
set -euo pipefail

echo "⚡ Running ActionLens CI validation pipeline..."
node dist/bin.js --version
echo "✔ ActionLens executable verified."
