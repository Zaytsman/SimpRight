#!/usr/bin/env bash
# Publishes this run's Playwright report to the gh-pages branch (served by GitHub Pages).
#
# Usage: scripts/publish-report.sh <family> [--latest-coverage]
#   <family>           report family folder, e.g. daily-ui-regression, custom-api
#   --latest-coverage  also publish test-results/api-coverage as latest/api-coverage
#
# Site layout on gh-pages:
#   index.html                     dashboard (copied from the repo root on every publish)
#   <family>-manifest.json         run folders of the family, newest first
#   <family>-history.json          every kept run's stats + the newest run's known issues (read by the dashboard)
#   <family>/run-<N>/              HTML report + run-summary.json (+ api-coverage/) of run N
#   latest/<family>/               copy of the newest run
#   latest/api-coverage/           latest full API regression coverage report (+ totals.json for the dashboard)
#
# The small JSON files the portal reads (history, run summaries, coverage totals) come from
# scripts/build-run-summaries.mts. The run's full results.json is only their source: an API regression's is
# about 8 MB, so it isn't published (it stays in the run's artifact).
#
# Runs in GitHub Actions at the repository root, with GH_TOKEN set. The gh-pages checkout, the dashboard
# copy and the push are in gh-pages-lib.sh, shared with publish-test-cases.sh.
set -euo pipefail
source "$(dirname "$0")/gh-pages-lib.sh"

USAGE="usage: publish-report.sh <family> [--latest-coverage]"
FAMILY="${1:?$USAGE}"
case "${2:-}" in
  '') LATEST_COVERAGE=false ;;
  --latest-coverage) LATEST_COVERAGE=true ;;
  *) echo "$USAGE" >&2; exit 2 ;;
esac
RUN="run-${GITHUB_RUN_NUMBER:?GITHUB_RUN_NUMBER is not set}"
# How many runs of the family stay on the site (playwright-run.yml's keep-runs input).
KEEP_RUNS="${KEEP_RUNS:-10}"
if ! [[ "$KEEP_RUNS" =~ ^[1-9][0-9]*$ ]]; then
  echo "KEEP_RUNS must be a positive whole number, got '$KEEP_RUNS'." >&2
  exit 2
fi
SITE=".gh-pages"

if [ ! -d playwright-report ]; then
  echo "No playwright-report/ found; nothing to publish."
  exit 0
fi

ghp_checkout "$SITE"

# This run, plus the "latest" copy.
mkdir -p "$SITE/$FAMILY/$RUN" "$SITE/latest"
cp -r playwright-report/. "$SITE/$FAMILY/$RUN/"
cp test-results/results.json "$SITE/$FAMILY/$RUN/" 2>/dev/null || true # source of run-summary.json, removed below
if [ -d test-results/api-coverage ]; then
  cp -r test-results/api-coverage "$SITE/$FAMILY/$RUN/api-coverage"
fi
rm -rf "$SITE/latest/$FAMILY"
cp -r "$SITE/$FAMILY/$RUN" "$SITE/latest/$FAMILY"
if [ "$LATEST_COVERAGE" = true ] && [ -d test-results/api-coverage ]; then
  rm -rf "$SITE/latest/api-coverage"
  cp -r test-results/api-coverage "$SITE/latest/api-coverage"
fi

# Keep only the newest KEEP_RUNS runs, then rebuild the manifest from what is left.
cd "$SITE"
(cd "$FAMILY" && ls -1d run-* | sort -rV | tail -n +"$((KEEP_RUNS + 1))" | xargs -r rm -rf)
(cd "$FAMILY" && ls -1d run-* | sort -rV) | jq -R . | jq -s . > "$FAMILY-manifest.json"
echo "Runs kept for $FAMILY: $(jq length "$FAMILY-manifest.json")"

cd ..
node scripts/build-run-summaries.mts "$SITE" "$FAMILY"
# Every run with results now has its run-summary.json, so drop the full results.json (also the ones runs
# published before the summaries existed still have).
find "$SITE/$FAMILY" -mindepth 2 -maxdepth 2 -name results.json -delete
rm -f "$SITE/latest/$FAMILY/results.json"
ghp_publish "$SITE" "Publish $FAMILY $RUN"
