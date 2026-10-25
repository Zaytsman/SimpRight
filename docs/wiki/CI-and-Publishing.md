<!-- Source: docs/wiki/CI-and-Publishing.md in the repository, copied from docs/framework/11-ci-and-publishing.md. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# 11. CI and publishing

GitHub Actions runs the tests, checks pull requests and publishes the results to GitHub Pages. One reusable workflow runs every test job; five small callers decide what to run and when. The wiki's [CI Pipeline](CI-Pipeline), [CI Runs](CI-Runs), [Scheduled Runs](Scheduled-Runs) and [GitHub Pages Publishing](GitHub-Pages-Publishing) pages have the operating details (how to start runs by hand, review their results, and change or add schedules).

```
run-api-tests.yml      weekdays 02:15 UTC ─┐
run-ui-tests.yml       weekdays 06:15 UTC ─┤
custom-api-tests.yml   by hand (area, grep) ├──► playwright-run.yml (reusable) ──► gh-pages: <family>/run-<N>/
custom-ui-tests.yml    by hand (area, grep) │      install, typecheck, tests,         latest/<family>/, manifests
smoke-tests.yml        by hand (@smoke)    ─┘      step titles, publish, artifact

pull request to main/develop ──► pr-checks.yml (verify): typecheck, validator, page builds   (required on main)
push to main ──► publish-test-cases.yml ──► gh-pages: test-cases/, bugs/, the portal
             └─► publish-wiki.yml       ──► the repository's wiki
monthly, by hand ──► squash-gh-pages.yml ──► gh-pages: the history replaced by one commit
```

## The reusable test job: `playwright-run.yml`

Inputs: `project` (`ui`, `api`, or `all`), `family` (where the report goes), `paths` (spec folders or files), `grep`, `publish-latest-coverage`, `keep-runs` (how many runs of the family stay on Pages, default 10). Secrets: `ADMIN_USER`, `ADMIN_PASSWORD`, declared under `workflow_call.secrets` and passed by name by each caller.

| Step | What and why |
|---|---|
| Checkout | `persist-credentials: false`: no token in the git config while dependencies install and tests run |
| Setup Node.js 24 | npm cache, and the GitHub Packages registry for the `@zaytsman` scope |
| `npm ci --ignore-scripts` | With `NODE_AUTH_TOKEN` = `GITHUB_TOKEN`, so the optional private coverage package installs (or is skipped where there's no access, as in forks). No dependency needs an install script, so none can run. |
| Browsers (UI runs) | Cached by the lockfile's hash; `npm run install:browsers` |
| Typecheck | Fails fast (under a second with TypeScript 7) |
| Run tests | `npx playwright test [--project] [--grep] [paths]`, with `continue-on-error`, so the report is still published. Mixed and UI runs set `DISABLE_API_COVERAGE=true`. On CI: 1 retry, 2 workers, `forbidOnly`, JUnit and JSON reporters. |
| Check step titles | `npm run check:step-titles`: a warning annotation per test whose step titles aren't its scenario's steps; doesn't fail the job |
| Publish report | `scripts/publish-report.sh <family>`, with `GH_TOKEN`: **the only step that gets a token that can push** |
| Upload artifact | `playwright-report/` and `test-results/`, kept 14 days |
| Fail the job | If the tests failed, with an error annotation linking to the published report |

Every input reaches a `run:` script through `env:`, never as `${{ }}` pasted into the script, so an input can't become shell code. On CI, `globalSetup` also waits when a run would cross the site's hourly re-seed ([2](Configuration)); the 50-minute job timeout allows for it.

## The callers

| Workflow | Trigger | Runs | Family |
|---|---|---|---|
| `run-api-tests.yml` | weekdays 02:15 UTC, by hand | the API project; its coverage becomes the portal's API Coverage | `daily-api-regression` |
| `run-ui-tests.yml` | weekdays 06:15 UTC, by hand | the UI project | `daily-ui-regression` |
| `custom-api-tests.yml` / `custom-ui-tests.yml` | by hand: an area (a folder of `tests/<layer>/`), an optional `--grep` and `keep-runs` | one area or all | `custom-api` / `custom-ui` |
| `smoke-tests.yml` | by hand | both projects, `--grep @smoke` | `smoke` |

Each caller declares `contents: write` (push to gh-pages) and `packages: read` (the coverage package), because a called workflow can't have more permissions than its caller. Schedules run at :15, never on the full hour: the site re-seeds at :00, and GitHub's schedule queue is busiest then. A new test folder needs an entry in the matching custom workflow's `area` options.

## Pull requests: `pr-checks.yml`

The `verify` job runs on every pull request to `main` or `develop` and is the **required check** on `main`. It's static: `npm run typecheck` (unused locals and parameters fail it), `npm run validate:scenarios`, and the Test Cases and Bugs page builds. It runs no tests, needs no secrets and no package token (`npm ci --ignore-scripts` skips the private package after a 401, as in forks), so pull requests from forks and Dependabot get the same check. A new push cancels the PR's running `verify`. Tests run locally before a push and in the nightly regressions on `main`.

## Publishing to GitHub Pages

The `gh-pages` branch is the site:

```
index.html                 the portal (copied from the repo root on every publish)
<family>/run-<N>/          one run's HTML report + run-summary.json (+ api-coverage/)
<family>-manifest.json     the family's runs, newest first (the latest `keep-runs` are kept, 10 by default)
<family>-history.json      the kept runs' stats + the newest run's known issues (what the portal reads)
latest/<family>/           a copy of the newest run
latest/api-coverage/       the full API regression's coverage (+ totals.json for the portal)
test-cases/<layer>/        the Test Cases pages
bugs/                      the Bugs page
```

| Script | Does |
|---|---|
| `scripts/publish-report.sh <family> [--latest-coverage]` | Copies the run's report and coverage into `<family>/run-<N>/`, refreshes `latest/<family>/`, prunes to `KEEP_RUNS` (the `keep-runs` input, 10 by default; anything but a positive whole number fails), rebuilds the manifest, then runs `build-run-summaries.mts` for the family and removes the family's full `results.json` files (the summaries replace them; the run's artifact keeps it for 14 days). An unknown argument fails with the usage. |
| `scripts/build-run-summaries.mts <site> [<family>]` | Writes the small files the portal and the Bugs page read instead of the full `results.json` (an API regression's is about 8 MB): a `run-summary.json` per run (stats, known issues, each scenario test's last status; built once from its `results.json`, which `publish-report.sh` then removes; copied to `latest/<family>/`), `<family>-history.json` and `latest/api-coverage/totals.json` (`summary.json` without the per-endpoint detail). Without a family it builds only the families that have no history yet. |
| `scripts/publish-test-cases.sh` | Builds the Test Cases and Bugs pages, replaces `test-cases/` and `bugs/`, and builds the run summaries of families that have none yet, so a portal change published before the next run finds its data |
| `scripts/squash-gh-pages.sh` | Replaces the `gh-pages` history with one commit holding the current site (the same files), pushed with `--force-with-lease`, so a publish that lands at the same moment is never overwritten |
| `scripts/gh-pages-lib.sh` | `ghp_checkout`: points `origin` at the repo with `GH_TOKEN`, checks out `gh-pages` as a worktree; `git ls-remote --exit-code` tells "no branch yet" (first publish: an orphan branch) from a real fetch error. `ghp_publish`: copies the portal and `.nojekyll`, commits as `github-actions[bot]`, pushes, and on a rejected push rebases and retries up to 3 times |

Each script touches only its own folders, so parallel publishes (a UI run, an API run, a Test Cases publish) rebase without conflicts. The run summaries depend only on the published files, so two publishes that write the same one write the same bytes. `scripts/*.sh` keep LF line endings (`.gitattributes`).

`squash-gh-pages.yml` runs on the 1st of each month at 04:45 UTC, between the nightly runs, and by hand: every publish adds a full report to the `gh-pages` history, so without it the branch would keep growing although the site keeps only the latest runs. A publish that read the branch before the squash is rejected once, rebases onto the new commit and retries, like any concurrent publish.

`publish-test-cases.yml` runs on pushes to `main` that change the scenarios, the bugs, the pages, their builds, the profile or `index.html`, so a portal change goes live on merge. `publish-wiki.yml` mirrors `docs/wiki/` into the repository's wiki on pushes to `main` that change it.

## Security hardening

| Measure | Protects against |
|---|---|
| Every action pinned to a full commit SHA, with the version in a comment (`actions/checkout@<sha> # v7.0.1`) | A moved tag running other code (a SHA can't move) |
| `persist-credentials: false` everywhere; `GH_TOKEN` only in the publish steps | A dependency or test code reading a token that can push to `develop` or `gh-pages` |
| `npm ci --ignore-scripts` | Install scripts running while `NODE_AUTH_TOKEN` is set |
| Named secrets instead of `secrets: inherit` | A future secret reaching the test job by default |
| Inputs through `env:` | An input becoming shell code |
| Minimal permissions per workflow; the repository's default token is read-only | |
| No `pull_request_target` workflow | Pull request code running with access to secrets |
| Dependabot `cooldown: 7 days` | A hijacked release being proposed before it's caught |

## Dependabot

`.github/dependabot.yml` checks weekly (Tuesdays) and targets `develop`: npm (including the private package, through the `github-packages` registry and the Dependabot secret `PACKAGES_READ_TOKEN`) with minor and patch updates grouped, and GitHub Actions grouped (it updates the SHA pins with their version comments). Both wait 7 days after a release. Security updates aren't delayed and always target `main`; after merging one, `main` is merged back into `develop`.

## Branches

`main` holds stable code: a ruleset allows changes only through a pull request that passes `verify`, merged with a merge commit. `develop` is the working branch. Releases are a pull request from `develop` to `main`. Scheduled runs and publishing work from `main`, so the portal and the wiki reflect merged code.
