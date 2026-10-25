#!/usr/bin/env bash
# Publishes this run's Playwright report to the gh-pages branch (served by GitHub Pages).
#
# Usage: scripts/publish-report.sh <family> [--latest-coverage]
#   <family>           the run's id in simpright.yml runs, e.g. daily-ui-regression, custom-api
#   --latest-coverage  also publish test-results/api-coverage as latest/api-coverage
#
# scripts/publish-run.mts writes the files (the site layout is described there); this script checks out gh-pages,
# runs it and pushes the result (gh-pages-lib.sh). Runs in GitHub Actions at the repository root, with GH_TOKEN and
# KEEP_RUNS (how many runs of the family stay on the site: playwright-run.yml's keep-runs input) set.
set -euo pipefail
source "$(dirname "$0")/gh-pages-lib.sh"

USAGE="usage: publish-report.sh <family> [--latest-coverage]"
FAMILY="${1:?$USAGE}"
SITE=".gh-pages"
args=(--site "$SITE" --run "$FAMILY" --number "${GITHUB_RUN_NUMBER:?GITHUB_RUN_NUMBER is not set}")
case "${2:-}" in
  '') ;;
  --latest-coverage) args+=(--latest-coverage) ;;
  *) echo "$USAGE" >&2; exit 2 ;;
esac
if [ -n "${KEEP_RUNS:-}" ]; then
  args+=(--keep "$KEEP_RUNS")
fi

ghp_checkout "$SITE"
node scripts/publish-run.mts "${args[@]}"
ghp_publish "$SITE" "Publish $FAMILY run-$GITHUB_RUN_NUMBER"
