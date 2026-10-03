#!/usr/bin/env bash
# Decides how much of the test suite a pull request runs in the `verify` job (pr-checks.yml).
#
#   all      a file that no spec imports but that affects every run changed (config, globalSetup,
#            env JSON, dependencies, this check itself): run the whole suite.
#   changed  only code that specs import changed (src/, tests/): run `playwright test --only-changed`,
#            which follows the import graph from the changed files to the specs.
#   none     nothing that a test run depends on changed (docs, contracts, scenarios, the dashboard,
#            agents and skills, other workflows): skip the tests. Typecheck and scenario validation
#            still run.
#
# Usage: scripts/pr-test-scope.sh <base ref>   (e.g. origin/develop). Prints the scope and, on
# GitHub Actions, writes `scope=<value>` to $GITHUB_OUTPUT.
set -euo pipefail

base="${1:?usage: pr-test-scope.sh <base ref>}"
changed_files="$(git diff --name-only "$base"...HEAD)"

scope=none
while IFS= read -r file; do
  [ -z "$file" ] && continue
  case "$file" in
    playwright.config.ts | src/globalSetup.ts | src/envs/* | package.json | package-lock.json | \
    tsconfig.json | .npmrc | .github/workflows/pr-checks.yml | scripts/pr-test-scope.sh)
      scope=all
      break
      ;;
    src/* | tests/*)
      scope=changed
      ;;
  esac
done <<< "$changed_files"

echo "Changed files:"
echo "${changed_files:-  (none)}" | sed 's/^/  /'
echo "Test scope: $scope"
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "scope=$scope" >> "$GITHUB_OUTPUT"
fi
