#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Reconcile the main app after merged dependency changes.
pnpm install --no-frozen-lockfile
pnpm run typecheck
pnpm run test

# The mockup sandbox is a separate npm project with its own lockfile.
if [[ -f artifacts/mockup-sandbox/package.json ]]; then
  npm install --prefix artifacts/mockup-sandbox --no-audit --no-fund
  npm run typecheck --prefix artifacts/mockup-sandbox
fi
