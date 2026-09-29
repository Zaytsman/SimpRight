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
#   <family>/run-<N>/              HTML report + results.json (+ api-coverage/) of run N
#   latest/<family>/               copy of the newest run
#   latest/api-coverage/           latest full API regression coverage report
#
# Runs in GitHub Actions after actions/checkout (which leaves push credentials in the git config).
set -euo pipefail

FAMILY="${1:?usage: publish-report.sh <family> [--latest-coverage]}"
LATEST_COVERAGE="${2:-}"
RUN="run-${GITHUB_RUN_NUMBER:?GITHUB_RUN_NUMBER is not set}"
KEEP_RUNS="${KEEP_RUNS:-30}"
SITE=".gh-pages"

if [ ! -d playwright-report ]; then
  echo "No playwright-report/ found; nothing to publish."
  exit 0
fi

# Check out gh-pages as a worktree, or start it as an empty orphan branch on the first publish.
rm -rf "$SITE"
git worktree prune
if git fetch --depth=1 origin gh-pages:gh-pages 2>/dev/null; then
  git worktree add "$SITE" gh-pages
else
  git worktree add --orphan -b gh-pages "$SITE"
fi

# This run, plus the "latest" copy.
mkdir -p "$SITE/$FAMILY/$RUN" "$SITE/latest"
cp -r playwright-report/. "$SITE/$FAMILY/$RUN/"
cp test-results/results.json "$SITE/$FAMILY/$RUN/" 2>/dev/null || true
if [ -d test-results/api-coverage ]; then
  cp -r test-results/api-coverage "$SITE/$FAMILY/$RUN/api-coverage"
fi
rm -rf "$SITE/latest/$FAMILY"
cp -r "$SITE/$FAMILY/$RUN" "$SITE/latest/$FAMILY"
if [ "$LATEST_COVERAGE" = "--latest-coverage" ] && [ -d test-results/api-coverage ]; then
  rm -rf "$SITE/latest/api-coverage"
  cp -r test-results/api-coverage "$SITE/latest/api-coverage"
fi

cp index.html "$SITE/index.html"
touch "$SITE/.nojekyll"

# Keep only the newest KEEP_RUNS runs, then rebuild the manifest from what is left.
cd "$SITE"
(cd "$FAMILY" && ls -1d run-* | sort -rV | tail -n +"$((KEEP_RUNS + 1))" | xargs -r rm -rf)
(cd "$FAMILY" && ls -1d run-* | sort -rV) | jq -R . | jq -s . > "$FAMILY-manifest.json"
echo "Runs kept for $FAMILY: $(jq length "$FAMILY-manifest.json")"

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -A
if git diff --cached --quiet; then
  echo "Nothing changed on gh-pages."
  exit 0
fi
git commit -q -m "Publish $FAMILY $RUN"

# Another workflow may have published in the meantime: rebase onto it and retry.
for attempt in 1 2 3; do
  if git push origin gh-pages; then
    echo "Published $FAMILY/$RUN"
    exit 0
  fi
  echo "Push rejected (attempt $attempt); rebasing onto the remote gh-pages."
  git pull --rebase origin gh-pages
done
echo "Could not publish after 3 attempts." >&2
exit 1
