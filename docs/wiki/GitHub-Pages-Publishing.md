<!-- Source: docs/wiki/GitHub-Pages-Publishing.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# GitHub Pages Publishing

Everything the CI produces for people to look at lives on **GitHub Pages**, served from the `gh-pages` branch: [zaytsman.github.io/SimpRight](https://zaytsman.github.io/SimpRight/). This page explains what is published, by which script, and how the branch is kept small and consistent.

## What's on the site

```
gh-pages/
├── index.html                       the Automation Portal (copied from the repo root on every publish)
├── .nojekyll                        serve files as they are (no Jekyll processing)
├── daily-api-regression/
│   ├── run-57/                      one test run: Playwright HTML report + results.json (+ api-coverage/)
│   └── run-56/ ...                  the latest 30 runs of the family
├── daily-api-regression-manifest.json   ["run-57", "run-56", ...], newest first
├── daily-ui-regression/ ...         the same for the other families
├── custom-api/ ...
├── custom-ui/ ...
├── latest/
│   ├── daily-api-regression/        a copy of the family's newest run (stable URL)
│   ├── daily-ui-regression/
│   ├── custom-api/, custom-ui/
│   └── api-coverage/                API coverage of the latest full API regression
└── test-cases/
    ├── ui/                          index.html + scenarios-data.js
    └── api/
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

| Script | Called by | Publishes |
|---|---|---|
| `scripts/publish-report.sh <family> [--latest-coverage]` | `playwright-run.yml`, after every test run | The run's report, `latest/<family>/`, the manifest, the coverage (with the flag), the portal |
| `scripts/publish-test-cases.sh` | `publish-test-cases.yml`, on pushes to `main` | `test-cases/`, `bugs/` and the portal |
| `scripts/gh-pages-lib.sh` | both scripts above | The shared checkout and push |

Each script replaces only its own files and leaves the rest of the branch alone, so test runs and Test Cases publishing never overwrite each other.

## Publishing a test run: `publish-report.sh`

1. If there's no `playwright-report/`, stop: nothing to publish.
2. Check out `gh-pages` (see below).
3. Copy the HTML report into `<family>/run-<N>/`, plus `test-results/results.json` (the JSON reporter's output on CI, which the portal reads) and `test-results/api-coverage/` when there is one.
4. Replace `latest/<family>/` with a copy of this run; with `--latest-coverage`, also replace `latest/api-coverage/` (only the full API regression passes it, because only its coverage represents the whole suite).
5. Copy `index.html` from the repository, so a portal change goes live with the next run.
6. **Prune:** keep the newest `KEEP_RUNS` runs of the family (30 by default), delete older ones, and rebuild `<family>-manifest.json` from what's left.
7. Commit and push.

Runs are sorted by number (`sort -V`), so `run-100` comes after `run-99`.

## Publishing the Test Cases and Bugs pages: `publish-test-cases.sh`

1. Build the pages with `scripts/build-test-cases.mts` into `test-results/test-cases/`, and the Bugs page with `scripts/build-bugs.mts` into `test-results/bugs/`.
2. Check out `gh-pages`, replace the whole `test-cases/` and `bugs/` folders (so a removed layer disappears too), copy `index.html`.
3. Commit and push.

The workflow validates the scenarios first, so a broken scenario file never reaches the site.

## Checkout and push: `gh-pages-lib.sh`

- **`ghp_checkout <dir>`** checks out `gh-pages` as a **git worktree** in `.gh-pages/` (git-ignored), fetching only its latest commit. On the very first publish, when the branch doesn't exist, it creates it as an empty orphan branch.
- **`ghp_publish <dir> <message>`** commits everything as `github-actions[bot]`, and does nothing when nothing changed. Several workflows can publish at the same time (a UI and an API run, plus Test Cases), so a rejected push is **rebased onto the remote branch and retried**, up to 3 times. Because each script touches only its own folders, the rebase doesn't conflict.

Pruning on the branch itself keeps `gh-pages` from growing forever: at most 30 runs per family are kept.

## The wiki

The wiki isn't on GitHub Pages: it's the repository's GitHub wiki, published from `docs/wiki/` by `publish-wiki.yml` on pushes to `main`. The workflow clones `<repo>.wiki.git`, mirrors the folder into it (`rsync --delete`, so a page removed here is removed there) and pushes when something changed. Edit pages in `docs/wiki/`, not in the wiki's web editor.

## Setting it up in a fork

1. Add the `ADMIN_USER` and `ADMIN_PASSWORD` repository secrets.
2. Run any test workflow once (Actions tab → Run workflow). Its publish step creates the `gh-pages` branch.
3. Settings → Pages → Source: *Deploy from a branch*, branch `gh-pages`, folder `/ (root)`.
4. Optional: run **Publish Test Cases** by hand to add the Test Cases pages.

Forks have no access to the private coverage package, so their portal shows no coverage. Everything else works.

## Previewing locally

The portal and the Test Cases pages load their data with `fetch`, which browsers block for `file://` pages, so serve the folder over HTTP:

```bash
npm run test-cases:build -- test-results/site-preview/test-cases
npm run bugs:build -- test-results/site-preview/bugs
cp index.html test-results/site-preview/
npx http-server test-results/site-preview -p 4173
```

The portal then shows the Test Cases buttons, but no runs (those exist only on `gh-pages`). To preview with real runs, check out `gh-pages` into a folder and serve that instead.

See also: [Automation Portal](Automation-Portal), [CI Pipeline](CI-Pipeline).
