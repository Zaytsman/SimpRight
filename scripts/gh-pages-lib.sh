#!/usr/bin/env bash
# Shared steps for the scripts that publish to the gh-pages branch (served by GitHub Pages):
# publish-report.sh (test reports) and publish-test-cases.sh (the test case pages).
#
# Source it from a script that runs at the repository root in GitHub Actions, after actions/checkout
# (which leaves push credentials in the git config):
#   source "$(dirname "$0")/gh-pages-lib.sh"
#   ghp_checkout .gh-pages      # gh-pages checked out as a worktree in .gh-pages
#   ...copy files into .gh-pages...
#   ghp_publish .gh-pages "Publish something"

# Checks out gh-pages as a worktree in <dir>, or starts it as an empty orphan branch on the first publish.
ghp_checkout() {
  local site="$1"
  rm -rf "$site"
  git worktree prune
  if git fetch --depth=1 origin gh-pages:gh-pages 2>/dev/null; then
    git worktree add "$site" gh-pages
  else
    git worktree add --orphan -b gh-pages "$site"
  fi
}

# Commits everything in the <dir> worktree and pushes it. Another workflow may have published in the
# meantime, so a rejected push is rebased onto the remote gh-pages and retried. Returns 0 when there
# was nothing to commit.
ghp_publish() {
  local site="$1" message="$2"
  (
    cd "$site"
    git config user.name "github-actions[bot]"
    git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
    git add -A
    if git diff --cached --quiet; then
      echo "Nothing changed on gh-pages."
      exit 0
    fi
    git commit -q -m "$message"

    for attempt in 1 2 3; do
      if git push origin gh-pages; then
        echo "Published: $message"
        exit 0
      fi
      echo "Push rejected (attempt $attempt); rebasing onto the remote gh-pages."
      git pull --rebase origin gh-pages
    done
    echo "Could not publish after 3 attempts." >&2
    exit 1
  )
}
