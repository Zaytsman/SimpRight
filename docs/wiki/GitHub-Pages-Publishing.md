<!-- Source: docs/wiki/GitHub-Pages-Publishing.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# GitHub Pages Publishing

Everything the CI produces for people to look at lives on **GitHub Pages**, served from the `gh-pages` branch: [zaytsman.github.io/SimpRight](https://zaytsman.github.io/SimpRight/). This page explains what is published, by which script or command, and how the branch is kept small and consistent.

## What's on the site

```
gh-pages/
├── index.html                       the Automation Portal (@simpright/portal's dashboard, written on every publish)
├── portal.json                      what the portal shows: the brand, the runs, the thresholds (from simpright.yml, on every publish)
├── .nojekyll                        serve files as they are (no Jekyll processing)
├── site.json                        the site's layout version (written when it's missing)
├── daily-api-regression/
│   ├── run-57/                      one test run: Playwright HTML report + run-summary.json (+ api-coverage/)
│   └── run-56/ ...                  the latest runs of the family (`keep-runs`, 10 by default)
├── daily-api-regression-manifest.json   ["run-57", "run-56", ...], newest first
├── daily-api-regression-history.json    the kept runs' stats + the newest run's known issues (what the portal reads)
├── daily-ui-regression/ ...         the same for the other families
├── smoke/ ...
├── custom-api/ ...
├── custom-ui/ ...
├── latest/
│   ├── daily-api-regression/        a copy of the family's newest run (stable URL)
│   ├── daily-ui-regression/
│   ├── smoke/, custom-api/, custom-ui/
│   └── api-coverage/                API coverage of the latest full API regression (+ totals.json for the portal)
├── test-cases/
│   ├── ui/                          index.html + scenarios-data.js
│   └── api/
└── bugs/                            index.html + bugs-data.js
```

| URL | Content |
|---|---|
| `/` | [Automation Portal](Automation-Portal) |
| `/<family>/run-<N>/` | The Playwright report of run number N (the workflow's run number) |
| `/latest/<family>/` | The newest run of a family |
| `/latest/api-coverage/` | The API coverage report |
| `/test-cases/ui/`, `/test-cases/api/` | [Test Cases Pages](Test-Cases-Pages) |
| `/bugs/` | [Bugs Page](Bugs-Page) |

## Who publishes what

| Script or command | Called by | Does |
|---|---|---|
| `.github/actions/publish-run/publish-run.sh <family> [--latest-coverage]` | the `publish-run` action, in `playwright-run.yml` after every test run | Checks out `gh-pages`, runs `simpright-portal publish-run`, commits and pushes |
| `.github/actions/publish-pages/publish-pages.sh` | the `publish-pages` action, in `publish-test-cases.yml` on pushes to `main` | Checks out `gh-pages`, runs `simpright-portal build-pages`, commits and pushes |
| `simpright-portal publish-run` | `publish-run.sh` | Writes the run's report, `latest/<family>/`, the manifest and history, the coverage (with the flag) and the portal |
| `simpright-portal build-pages` | `publish-pages.sh`, and `verify` on every pull request | Writes `test-cases/`, `bugs/` and the portal |
| `.github/actions/lib/gh-pages-lib.sh` | both shell scripts | The shared checkout and push |

Each script replaces only its own files and leaves the rest of the branch alone, so test runs and Test Cases publishing never overwrite each other. The files are written by `simpright-portal` (from [`@simpright/portal`](https://github.com/Zaytsman/SimpRightKit/tree/main/packages/portal), a devDependency) and the shell scripts only do git, so the file part runs on any machine ([Previewing locally](#previewing-locally)). The shell scripts sit next to the composite actions that run them ([CI Pipeline](CI-Pipeline#the-local-actions)), and each action gets the push token as its `token` input.

## Publishing a test run: `publish-run`

`publish-run.sh` checks out `gh-pages` (see below), runs `npx --no-install simpright-portal publish-run --site .gh-pages --run <family> --number <run number> --keep <keep-runs> [--latest-coverage]`, then commits and pushes. The command:

1. If there's no `playwright-report/`, stops: nothing to publish.
2. Replaces `<family>/run-<N>/` with the HTML report, plus `test-results/results.json` (the JSON reporter's output on CI; only for step 4) and `test-results/api-coverage/` when there is one. A re-run of a workflow keeps its run number, so it replaces the first attempt.
3. **Prune:** keeps the newest `--keep` runs of the family (the workflow's `keep-runs` input; without it, the run's `keep` in `simpright.yml`, else 10), deletes older ones, and rebuilds `<family>-manifest.json` from what's left.
4. **Summarize**: writes the run's `run-summary.json` (stats, known issues, each scenario test's last status) and rebuilds `<family>-history.json`. The portal and the Bugs page read only these small files: an API regression's `results.json` is about 8 MB, and the portal used to download ten of them. Then it removes the family's `results.json` files: the HTML report doesn't need them, and the run's artifact keeps the full file for 14 days.
5. Replaces `latest/<family>/` with a copy of the newest kept run. With `--latest-coverage` (without the flag, the run's `publishCoverage`), it also replaces `latest/api-coverage/` with that run's coverage and refreshes its `totals.json`; only the full API regression passes it, because only its coverage represents the whole suite.
6. Writes the portal: `index.html` (the package's dashboard page), its `portal.json` from `simpright.yml`, `.nojekyll` and, when it's missing, `site.json`, so a portal change (in `simpright.yml`, or a new kit version) goes live with the next publish of either kind.

Runs are sorted by number, so `run-100` comes after `run-99`.

## Publishing the Test Cases and Bugs pages: `build-pages`

`publish-pages.sh` checks out `gh-pages`, runs `npx --no-install simpright-portal build-pages --site .gh-pages`, then commits and pushes. The command:

1. Replaces the whole `test-cases/` and `bugs/` folders (so a removed layer disappears too) with new builds, the ones `npm run test-cases:build` and `npm run bugs:build` make.
2. Builds the run summaries of the families that have none yet, so a portal change published before their next run finds its data.
3. Writes the portal, as above.

The workflow validates the scenarios first, so a broken scenario file never reaches the site. `verify` runs the same build on every pull request.

## Checkout and push: `gh-pages-lib.sh`

- **`ghp_checkout <dir>`** points `origin` at the repository with `GH_TOKEN` as the credential (the workflows check out without one, so only the publish step has a token that can push), then checks out `gh-pages` as a **git worktree** in `.gh-pages/` (git-ignored), fetching only its latest commit. On the very first publish, when `git ls-remote` finds no such branch, it creates it as an empty orphan branch; any other error (network, access) stops the publish with its message.
- **`ghp_publish <dir> <message>`** commits everything as `github-actions[bot]`, and does nothing when nothing changed. Several workflows can publish at the same time (a UI and an API run, plus Test Cases), so a rejected push is **rebased onto the remote branch and retried**, up to 3 times. Because each script touches only its own folders, the rebase doesn't conflict.

Pruning keeps the site small: at most `keep-runs` runs per family (10 by default). The branch's history still holds every report ever published, so it's squashed every month (below).

## Squashing the history: `squash-pages.sh`

`squash-gh-pages.yml` runs on the 1st of each month at 04:45 UTC, between the nightly runs, and by hand (Actions → **Squash GitHub Pages History** → **Run workflow**). Its `squash-pages` action fetches the latest `gh-pages` commit and pushes a new commit with the same files and no parent: the site doesn't change, and the old reports leave the history (GitHub cleans up the unreferenced data later).

- The push uses `--force-with-lease`: it goes through only while `gh-pages` is still the commit it read. A publish that lands in between makes the squash fail; nothing is lost, run it again.
- A publish that read `gh-pages` before the squash and pushes after it is rejected, rebases onto the new commit and retries (`ghp_publish`), as with any other concurrent publish.

## The wiki

The wiki isn't on GitHub Pages: it's the repository's GitHub wiki, published from `docs/wiki/` by `publish-wiki.yml` on pushes to `main`. Its `publish-wiki` action clones `<repo>.wiki.git`, mirrors the folder into it (`rsync --delete`, so a page removed here is removed there) and pushes when something changed. Edit pages in `docs/wiki/`, not in the wiki's web editor.

## Setting it up in a fork

1. Add the `ADMIN_USER` and `ADMIN_PASSWORD` repository secrets.
2. Run any test workflow once (Actions tab → Run workflow). Its publish step creates the `gh-pages` branch.
3. Settings → Pages → Source: *Deploy from a branch*, branch `gh-pages`, folder `/ (root)`.
4. Optional: run **Publish Test Cases** by hand to add the Test Cases pages.

Forks have no access to the private coverage package, so their portal shows no coverage. Everything else works.

## Previewing locally

The commands that write the site run on any OS, Windows included, and write into any folder; `.gh-pages/` is git-ignored, and nothing is pushed (only the CI scripts do git). The portal and the Test Cases pages load their data with `fetch`, which browsers block for `file://` pages, so serve the folder over HTTP (`preview` serves it on `http://127.0.0.1:4173/`):

```bash
npx simpright-portal build-pages --site .gh-pages
npx simpright-portal preview --site .gh-pages
```

The portal then shows the brand, the Test Cases buttons and a row per run, but no results (those exist only on `gh-pages`). To preview with real runs, start from a copy of the branch (`git worktree add --detach .gh-pages origin/gh-pages`, after `git fetch origin gh-pages`) and build into it.

After a local test run, `npx simpright-portal publish-run --site .gh-pages --run custom-ui --number 1` adds it as run 1 of Custom UI, as CI would. Playwright's JSON reporter runs only on CI, so a local run has no `results.json`: its square in the run history stays grey, without stats.

See also: [Automation Portal](Automation-Portal), [CI Pipeline](CI-Pipeline).
