<!-- Source: docs/wiki/CI-and-Publishing.md in the repository, copied from docs/framework/11-ci-and-publishing.md. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# 11. CI and publishing

GitHub Actions runs the tests, checks pull requests and publishes the results to GitHub Pages. One reusable workflow runs every test job; five small callers decide what to run and when. The workflows' steps are local composite actions in `.github/actions/`. The wiki's [CI Pipeline](CI-Pipeline), [CI Runs](CI-Runs), [Scheduled Runs](Scheduled-Runs) and [GitHub Pages Publishing](GitHub-Pages-Publishing) pages have the operating details (how to start runs by hand, review their results, and change or add schedules).

```
run-api-tests.yml      weekdays 02:15 UTC ─┐
run-ui-tests.yml       weekdays 06:15 UTC ─┤
custom-api-tests.yml   by hand (area, grep) ├──► playwright-run.yml (reusable) ──► gh-pages: <family>/run-<N>/
custom-ui-tests.yml    by hand (area, grep) │      install, typecheck, tests,         latest/<family>/, manifests
smoke-tests.yml        by hand (@smoke)    ─┘      step titles, publish, artifact

pull request to main/develop ──► pr-checks.yml (verify): typecheck, validator, doctor, page builds   (required on main)
push to main ──► publish-test-cases.yml ──► gh-pages: test-cases/, bugs/, the portal
             └─► publish-wiki.yml       ──► the repository's wiki
monthly, by hand ──► squash-gh-pages.yml ──► gh-pages: the history replaced by one commit
```

## The reusable test job: `playwright-run.yml`

Inputs: `project` (`ui`, `api`, or `all`), `family` (where the report goes), `paths` (spec folders or files), `grep`, `publish-latest-coverage`, `keep-runs` (how many runs of the family stay on Pages, default 10). Secrets: `ADMIN_USER`, `ADMIN_PASSWORD`, declared under `workflow_call.secrets` and passed by name by each caller.

| Step | What and why |
|---|---|
| Checkout | `persist-credentials: false`: no token in the git config while dependencies install and tests run. The local actions run from this checkout. |
| Set up Node.js and install (`setup`) | Node.js 24 with the npm cache, and the GitHub Packages registry for the `@zaytsman` scope. `npm ci --ignore-scripts` with `NODE_AUTH_TOKEN` = `GITHUB_TOKEN`, so the optional private coverage package installs (or is skipped where there's no access, as in forks); no dependency needs an install script, so none can run. UI runs also get the browsers, cached by the lockfile's hash. |
| Typecheck | Fails fast (under a second with TypeScript 7) |
| Run tests (`run-tests`) | `npx playwright test [--project] [--grep] [paths]`, then `npm run check:step-titles`: a warning annotation per test whose step titles aren't its scenario's steps, which never fails the step. The step has `continue-on-error`, so the report is still published. Mixed and UI runs set `DISABLE_API_COVERAGE=true`. On CI: 1 retry, 2 workers, `forbidOnly`, JUnit and JSON reporters. |
| Publish report (`publish-run`) | `publish-run.sh <family>`, with `github.token` as the action's `token`: **the only step that gets a token that can push** |
| Upload artifact | `playwright-report/` and `test-results/`, kept 14 days |
| Fail the job | If the tests failed, with an error annotation linking to the published report |

Every input reaches a `run:` script through `env:`, in the workflows and in the actions, never as `${{ }}` pasted into the script, so an input can't become shell code. On CI, `globalSetup` also waits when a run would cross the site's hourly re-seed ([2](Configuration)); the 50-minute job timeout allows for it.

## The local actions: `.github/actions/`

The workflows' steps are composite actions in this repository, one folder each, so every workflow sets up and publishes the same way. A step uses one with `uses: ./.github/actions/<name>`, which runs from the workflow's checkout, so the checkout stays in the workflow. An action can't read `secrets`, so a token comes in as its `token` input, which has no default: the workflow shows which step gets one.

| Action | Inputs (required first) | Does | Used by |
|---|---|---|---|
| `setup` | `node-version`; `registry-url`, `scope`, `registry-token`, `omit-optional`, `browsers` | setup-node with the npm cache (and a scope's registry), `npm ci --ignore-scripts` (with `--omit=optional` when asked) and, when asked, the Playwright browsers, cached by the lockfile's hash | `playwright-run.yml`, `pr-checks.yml`, `publish-test-cases.yml` |
| `run-tests` | `project`; `paths`, `grep` | The tests, then the step-title check (warnings only); fails when the tests fail | `playwright-run.yml` |
| `publish-run` | `run-id`, `token`; `keep`, `latest-coverage` | `publish-run.sh`: the run's report onto `gh-pages` | `playwright-run.yml` |
| `publish-pages` | `token` | `publish-pages.sh`: the Test Cases and Bugs pages and the dashboard onto `gh-pages` | `publish-test-cases.yml` |
| `squash-pages` | `token` | `squash-pages.sh`: the `gh-pages` history as one commit | `squash-gh-pages.yml` |
| `publish-wiki` | `token`; `source` (default `docs/wiki`) | `publish-wiki.sh`: the folder into the repository's wiki | `publish-wiki.yml` |

Each action's shell script lives next to its `action.yml`; `lib/gh-pages-lib.sh` holds the git steps both `gh-pages` publishes share. `npm run doctor` checks every step that uses a local action: the action exists, gets its required inputs and no others, and the `node-version` each workflow passes to `setup` is `ci.node`.

## The callers

| Workflow | Trigger | Runs | Family |
|---|---|---|---|
| `run-api-tests.yml` | weekdays 02:15 UTC, by hand | the API project; its coverage becomes the portal's API Coverage | `daily-api-regression` |
| `run-ui-tests.yml` | weekdays 06:15 UTC, by hand | the UI project | `daily-ui-regression` |
| `custom-api-tests.yml` / `custom-ui-tests.yml` | by hand: an area (a folder of `tests/<layer>/`), an optional `--grep` and `keep-runs` | one area or all | `custom-api` / `custom-ui` |
| `smoke-tests.yml` | by hand | both projects, `--grep @smoke` | `smoke` |

Each caller declares `contents: write` (push to gh-pages) and `packages: read` (the coverage package), because a called workflow can't have more permissions than its caller. Schedules run at :15, never on the full hour: the site re-seeds at :00, and GitHub's schedule queue is busiest then. A new test folder needs an entry in the matching custom workflow's `area` options (checked, see below).

### The runs in `simpright.yml`

Each caller has an entry in the `runs` list of [`simpright.yml`](https://github.com/Zaytsman/SimpRight/blob/main/simpright.yml), and the entry's `id` is the caller's `family`. `npm run doctor` checks every caller against its entry, so a new or changed run changes both:

| Field | Meaning | Checked against the caller |
|---|---|---|
| `id` | The report family: its folder on GitHub Pages | `family`, one workflow per family |
| `label`, `note` | What the portal's Latest reports and Run history show | Not checked |
| `project` | `ui`, `api` or `all` | `project` |
| `schedule` | A cron in UTC; without one, the run starts by hand only | `on.schedule`; every caller also has `workflow_dispatch` |
| `grep`, `paths` | Narrow the run | `grep`, `paths`; without them in the entry, only an input (`${{ inputs.grep }}`) may set one |
| `areaPicker` | A manual run with an area input | The `area` options: `all`, then the folders of the project's tests |
| `keep` | Runs kept on Pages (default 10) | `keep-runs`, or the default of the input it reads |
| `trend` | The layer whose status, trends, known issues and Bugs page this run feeds | One run per layer, each with a `portal.healthThreshold` |
| `publishCoverage` | Publishes the run's coverage as the portal's API Coverage | `publish-latest-coverage` |

`doctor` also checks that `playwright-run.yml` declares exactly the secrets named in `ci.secrets`, that every caller passes them by name, and that every `actions/setup-node` step, in a workflow or in a local action, uses `ci.node` (the `setup` action's takes it from its `node-version` input, so every workflow that uses the action is checked). A project with `ci.node` and no step that sets up Node fails too, so the check can't pass with nothing to check.

## Pull requests: `pr-checks.yml`

The `verify` job runs on every pull request to `main` or `develop` and is the **required check** on `main`. It's static: `npm run typecheck` (unused locals and parameters fail it), `npm run validate:scenarios`, `npm run doctor` (the project's setup, and the core files against SimpRightTemplate at `template`, read from GitHub), and the build of the portal's pages (`simpright-portal build-pages`, the same build `publish-test-cases.yml` publishes). It runs no tests, needs no secrets and no package token (`npm ci --ignore-scripts` skips the private package after a 401, as in forks), so pull requests from forks and Dependabot get the same check. A new push cancels the PR's running `verify`. Tests run locally before a push and in the nightly regressions on `main`.

## Publishing to GitHub Pages

The `gh-pages` branch is the site:

```
index.html                 the portal (@simpright/portal's dashboard, written on every publish)
portal.json                what the portal shows: the brand, the runs, the thresholds (from simpright.yml, on every publish)
site.json                  the site's layout version (written when it's missing)
<family>/run-<N>/          one run's HTML report + run-summary.json (+ api-coverage/)
<family>-manifest.json     the family's runs, newest first (the latest `keep-runs` are kept, 10 by default)
<family>-history.json      the kept runs' stats + the newest run's known issues (what the portal reads)
latest/<family>/           a copy of the newest run
latest/api-coverage/       the full API regression's coverage (+ totals.json for the portal)
test-cases/<layer>/        the Test Cases pages
bugs/                      the Bugs page
```

| Script or command | Does |
|---|---|
| `.github/actions/publish-run/publish-run.sh <family> [--latest-coverage]` | The run's publish on CI (the `publish-run` action): checks out `gh-pages`, runs `simpright-portal publish-run` with the run number and `KEEP_RUNS` (the action's `keep` input, from `keep-runs`), and pushes. An unknown argument fails with the usage. |
| `simpright-portal publish-run --site <dir> --run <id> --number <N> [--keep <N>] [--latest-coverage]` | Writes a run into the site folder (from `playwright-report/`, `test-results/results.json` and `test-results/api-coverage/`; `--report`, `--results` and `--coverage` pick others): replaces `<id>/run-<N>/` with the report, its coverage and `results.json` (a re-run of a workflow keeps its number, so it replaces the first attempt), prunes the family to `--keep` runs (default: the run's `keep` in `simpright.yml`, else 10), rebuilds the manifest and the run summaries, removes the `results.json` files (the run's artifact keeps it for 14 days), copies the newest kept run to `latest/<id>/` and, with `--latest-coverage` (default: the run's `publishCoverage`), its coverage to `latest/api-coverage/`, and writes the dashboard. An unknown run or option, or a number that isn't a positive whole number, fails with the usage. |
| `.github/actions/publish-pages/publish-pages.sh` | The pages' publish on CI (the `publish-pages` action): checks out `gh-pages`, runs `simpright-portal build-pages` and pushes |
| `simpright-portal build-pages --site <dir>` | Writes the portal's pages into the site folder: replaces `test-cases/` and `bugs/` (the builds `npm run test-cases:build` and `npm run bugs:build` run on their own), builds the run summaries of families that have none yet, so a portal change published before the next run finds its data, and writes the dashboard |
| The run summaries (`@simpright/portal`) | The small files the portal and the Bugs page read instead of the full `results.json` (an API regression's is about 8 MB): a `run-summary.json` per run (stats, known issues, each scenario test's last status; built once from its `results.json`; copied to `latest/<family>/`), `<family>-history.json` and `latest/api-coverage/totals.json` (`summary.json` without the per-endpoint detail) |
| The dashboard (`@simpright/portal`) | What every publish writes: `index.html` (the package's dashboard page), its `portal.json` (from `simpright.yml`), `.nojekyll`, and `site.json` when it's missing |
| `.github/actions/squash-pages/squash-pages.sh` | Replaces the `gh-pages` history with one commit holding the current site (the same files), pushed with `--force-with-lease`, so a publish that lands at the same moment is never overwritten |
| `.github/actions/lib/gh-pages-lib.sh` | The git steps of both publishes. `ghp_checkout`: points `origin` at the repo with `GH_TOKEN`, checks out `gh-pages` as a worktree; `git ls-remote --exit-code` tells "no branch yet" (first publish: an orphan branch) from a real fetch error. `ghp_publish`: commits as `github-actions[bot]`, pushes, and on a rejected push rebases and retries up to 3 times |

Each script touches only its own folders, so parallel publishes (a UI run, an API run, a Test Cases publish) rebase without conflicts. The run summaries depend only on the published files, so two publishes that write the same one write the same bytes. The shell scripts keep LF line endings (`.gitattributes`).

The files are written in Node (`simpright-portal`) and the shell scripts only do git, so a site can also be built on any machine, Windows included: after a local run, `npx simpright-portal publish-run --site .gh-pages --run custom-ui --number 1` publishes it into `.gh-pages/` (git-ignored; empty, or a copy of `gh-pages`), and `npx simpright-portal build-pages --site .gh-pages` adds the Test Cases and Bugs pages. The JSON reporter runs only on CI, so a local run has no `results.json` and shows without stats. The dashboard reads JSON files, so open it through a web server, not from disk: `npx simpright-portal preview --site .gh-pages` serves it on `http://127.0.0.1:4173/`.

`squash-gh-pages.yml` runs on the 1st of each month at 04:45 UTC, between the nightly runs, and by hand: every publish adds a full report to the `gh-pages` history, so without it the branch would keep growing although the site keeps only the latest runs. A publish that read the branch before the squash is rejected once, rebases onto the new commit and retries, like any concurrent publish.

`publish-test-cases.yml` runs on pushes to `main` that change the scenarios, the bugs, `simpright.yml`, `package-lock.json` (a new version of the kit's pages and builds) or the actions that publish them, so a portal change, a new run or a new label goes live on merge. `publish-wiki.yml` mirrors `docs/wiki/` into the repository's wiki on pushes to `main` that change it.

## Security hardening

| Measure | Protects against |
|---|---|
| Every action pinned to a full commit SHA, with the version in a comment (`actions/checkout@<sha> # v7.0.1`), in the workflows and in the local actions | A moved tag running other code (a SHA can't move) |
| `persist-credentials: false` everywhere; a token only in the publish steps, as their action's `token` input (no default) | A dependency or test code reading a token that can push to `develop` or `gh-pages` |
| `npm ci --ignore-scripts` | Install scripts running while `NODE_AUTH_TOKEN` is set |
| Named secrets instead of `secrets: inherit` | A future secret reaching the test job by default |
| Inputs through `env:`, in the workflows and in the actions | An input becoming shell code |
| Minimal permissions per workflow; the repository's default token is read-only | |
| No `pull_request_target` workflow | Pull request code running with access to secrets |
| Dependabot `cooldown: 7 days` | A hijacked release being proposed before it's caught |

## Dependabot

`.github/dependabot.yml` checks weekly (Tuesdays) and targets `develop`: npm (including the private package, through the `github-packages` registry and the Dependabot secret `PACKAGES_READ_TOKEN`) with the kit's three packages in one group of any update type (they share one version, which `doctor` checks) and the other minor and patch updates grouped, and GitHub Actions grouped (it updates the SHA pins with their version comments). Its GitHub Actions entry lists `/`, which covers only `.github/workflows/`, and `/.github/actions/setup`, the one local action that uses other actions; a new local action that does needs its folder there too (a `/.github/actions/*` glob would also match `lib/`, which has no `action.yml`). Both wait 7 days after a release. Security updates aren't delayed and always target `main`; after merging one, `main` is merged back into `develop`.

## Branches

`main` holds stable code: a ruleset allows changes only through a pull request that passes `verify`, merged with a merge commit. `develop` is the working branch. Releases are a pull request from `develop` to `main`. Scheduled runs and publishing work from `main`, so the portal and the wiki reflect merged code.
