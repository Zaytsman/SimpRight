#!/usr/bin/env bash
# Shared git steps for the scripts that publish to the gh-pages branch (served by GitHub Pages):
# publish-report.sh (test reports) and publish-test-cases.sh (the portal's pages). The files themselves are
# written by Node scripts (publish-run.mts, build-pages.mts), which run on any OS; these steps need CI's token.
#
# Source it from a script that runs at the repository root in GitHub Actions, with GH_TOKEN set to a token
# that can push (the workflows check out with persist-credentials: false and give github.token to the
# publish step only, so nothing that runs before it, such as the install or the tests, can read one):
#   source "$(dirname "$0")/gh-pages-lib.sh"
#   ghp_checkout .gh-pages                         # gh-pages checked out as a worktree in .gh-pages
#   node scripts/build-pages.mts --site .gh-pages  # write the files
#   ghp_publish .gh-pages "Publish something"

# Checks out gh-pages as a worktree in <dir>, or starts it as an empty orphan branch on the first publish.
ghp_checkout() {
  local site="$1" status=0
  git remote set-url origin "https://x-access-token:${GH_TOKEN:?GH_TOKEN is not set}@github.com/${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is not set}.git"
  rm -rf "$site"
  git worktree prune
  git ls-remote --exit-code --heads origin gh-pages >/dev/null || status=$?
  case "$status" in
    0)
      git fetch --depth=1 origin gh-pages:gh-pages
      git worktree add "$site" gh-pages
      ;;
    2) git worktree add --orphan -b gh-pages "$site" ;; # the first publish: origin has no gh-pages yet
    *)
      echo "Can't read gh-pages from origin (git ls-remote exited with $status)." >&2
      return 1
      ;;
  esac
}

# Commits everything in the <dir> worktree and pushes it. Another workflow may have published in the meantime, so a
# rejected push is rebased onto the remote gh-pages and retried. Returns 0 when there was nothing to commit.
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
