#!/usr/bin/env bash
# Builds the Test Cases pages from test-scenarios/ and publishes them to the gh-pages branch
# (served by GitHub Pages), together with the dashboard.
#
# Usage: scripts/publish-test-cases.sh
#
# Site layout on gh-pages (the rest is publish-report.sh's):
#   index.html               dashboard (copied from the repo root)
#   test-cases/<layer>/      index.html + scenarios-data.js of each scenario layer (ui, api)
#
# Runs in GitHub Actions (publish-test-cases.yml) after actions/checkout and npm ci.
set -euo pipefail
source "$(dirname "$0")/gh-pages-lib.sh"

SITE=".gh-pages"
BUILD="test-results/test-cases"

rm -rf "$BUILD"
node scripts/build-test-cases.mts "$BUILD"

ghp_checkout "$SITE"
# Replace the whole folder, so a layer that no longer exists disappears too.
rm -rf "$SITE/test-cases"
cp -r "$BUILD" "$SITE/test-cases"
cp index.html "$SITE/index.html"
touch "$SITE/.nojekyll"

ghp_publish "$SITE" "Publish test cases (${GITHUB_SHA:0:7})"
