#!/usr/bin/env bash
# Builds the Test Cases pages from test-scenarios/ and the Bugs page from bugs/, and publishes them
# to the gh-pages branch (served by GitHub Pages), together with the dashboard.
#
# Usage: scripts/publish-test-cases.sh
#
# Site layout on gh-pages (the rest is publish-report.sh's):
#   index.html               dashboard (copied from the repo root)
#   test-cases/<layer>/      index.html + scenarios-data.js of each scenario layer (ui, api)
#   bugs/                    index.html + bugs-data.js (only when the profile has paths.bugs)
#
# Runs in GitHub Actions (publish-test-cases.yml) after actions/checkout and npm ci.
set -euo pipefail
source "$(dirname "$0")/gh-pages-lib.sh"

SITE=".gh-pages"
BUILD="test-results/test-cases"
BUGS_BUILD="test-results/bugs"

rm -rf "$BUILD" "$BUGS_BUILD"
node scripts/build-test-cases.mts "$BUILD"
node scripts/build-bugs.mts "$BUGS_BUILD"

ghp_checkout "$SITE"
# Replace the whole folders, so a layer that no longer exists disappears too.
rm -rf "$SITE/test-cases" "$SITE/bugs"
cp -r "$BUILD" "$SITE/test-cases"
if [ -d "$BUGS_BUILD" ]; then
  cp -r "$BUGS_BUILD" "$SITE/bugs"
fi
cp index.html "$SITE/index.html"
touch "$SITE/.nojekyll"

ghp_publish "$SITE" "Publish test cases and bugs (${GITHUB_SHA:0:7})"
