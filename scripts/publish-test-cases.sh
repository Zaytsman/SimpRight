#!/usr/bin/env bash
# Publishes the Test Cases pages (from test-scenarios/), the Bugs page (from bugs/) and the dashboard to the
# gh-pages branch (served by GitHub Pages).
#
# Usage: scripts/publish-test-cases.sh
#
# scripts/build-pages.mts writes the files (test-cases/<layer>/, bugs/, index.html and portal.json; the rest of the
# site is publish-run.mts's); this script checks out gh-pages, runs it and pushes the result (gh-pages-lib.sh).
# Runs in GitHub Actions (publish-test-cases.yml) after npm ci, with GH_TOKEN set.
set -euo pipefail
source "$(dirname "$0")/gh-pages-lib.sh"

SITE=".gh-pages"
ghp_checkout "$SITE"
node scripts/build-pages.mts --site "$SITE"
ghp_publish "$SITE" "Publish test cases and bugs (${GITHUB_SHA:0:7})"
