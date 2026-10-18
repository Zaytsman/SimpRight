<!-- Source: docs/wiki/CI-Pipeline.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# CI Pipeline

How SimpRight's GitHub Actions are put together: the workflows, the reusable test job, the pull request check, secrets and permissions, and Dependabot. To start or schedule runs, see [CI Runs](CI-Runs).

```
                ┌──────── run-api-tests.yml  (weekdays 02:15 UTC)
                ├──────── run-ui-tests.yml   (weekdays 06:15 UTC)
 test runs  ────┤                                              ──► playwright-run.yml ──► gh-pages
                ├──────── custom-api-tests.yml (by hand)            (reusable)            (reports)
                ├──────── custom-ui-tests.yml  (by hand)
                └──────── smoke-tests.yml      (by hand)

 pull requests ────────── pr-checks.yml (verify) ──► typecheck, scenarios, Test Cases and Bugs build

 push to main ──┬──────── publish-test-cases.yml ──► gh-pages (Test Cases + Bugs pages + portal)
                └──────── publish-wiki.yml       ──► the wiki
```

## The workflows

| File | Name in Actions | Trigger | Job |
|---|---|---|---|
| `playwright-run.yml` | Playwright Run (reusable) | called by the five below | Runs one Playwright project (or both), publishes the report |
| `run-api-tests.yml` | API Regression Test Run | weekdays 02:15 UTC, by hand | All API tests; also publishes the coverage as the latest |
| `run-ui-tests.yml` | UI Regression Test Run | weekdays 06:15 UTC, by hand | All UI tests |
| `custom-api-tests.yml` | Custom API Test Run | by hand (area, grep) | One API area or all, optionally filtered |
| `custom-ui-tests.yml` | Custom UI Test Run | by hand (area, grep) | One UI area or all, optionally filtered |
| `smoke-tests.yml` | Smoke Test Run | by hand | The smoke set: tests tagged `@smoke` of both projects in one run (2-3 minutes) |
| `pr-checks.yml` | PR Checks | pull requests to `main` or `develop` | The `verify` job |
| `publish-test-cases.yml` | Publish Test Cases | push to `main` changing scenarios, bugs, the pages, their scripts, the profile or `index.html`; by hand | Validates the scenarios, builds and publishes the Test Cases pages, the Bugs page and the portal |
| `publish-wiki.yml` | Publish Wiki | push to `main` changing `docs/wiki/`; by hand | Mirrors `docs/wiki/` into the wiki |

## The reusable test job: `playwright-run.yml`

Every test run goes through one job, so the five callers stay a dozen lines each.

| Input | Meaning |
|---|---|
| `project` | `ui`, `api`, or `all` (both projects in one run, with browsers and without API coverage; the smoke run) |
| `family` | The report family on GitHub Pages (`daily-ui-regression`, `daily-api-regression`, `smoke`, `custom-ui`, `custom-api`) |
| `paths` | Spec folders or files, space-separated; empty = the whole project |
| `grep` | Only tests whose title matches |
| `publish-latest-coverage` | Publish this run's API coverage as the portal's API Coverage (the full API regression only) |

Its steps:

1. Check out without keeping the token in the git config (`persist-credentials: false`), set up Node.js 24 with the npm cache and the GitHub Packages registry for the `@zaytsman` scope.
2. `npm ci --ignore-scripts` (no dependency needs an install script), with `NODE_AUTH_TOKEN` = `GITHUB_TOKEN`, so the optional private coverage package installs (or is skipped where there's no access, as in forks).
3. UI runs only: restore the browser cache, `npm run install:browsers`.
4. `npm run typecheck`.
5. Run the tests: `npx playwright test --project=<project> [--grep <grep>] [paths]`. The step **continues on error**, so the report is still published. UI runs set `DISABLE_API_COVERAGE=true`: their only API calls are logins, which would make a misleading coverage report.
6. Check the step titles (`npm run check:step-titles`, on `test-results/results.json`): a warning annotation for each test whose step titles aren't its scenario's steps verbatim. It doesn't fail the job.
7. Publish the report to `gh-pages` (`scripts/publish-report.sh <family>`, with `GH_TOKEN` = `github.token`, the only step that gets a token that can push; see [GitHub Pages Publishing](GitHub-Pages-Publishing)).
8. Upload `playwright-report/` and `test-results/` as an artifact (kept 14 days).
9. Fail the job if tests failed, with an error annotation that links to the published report.

On CI, Playwright adds 1 retry, 2 workers, `forbidOnly`, and two more reporters: JUnit (`test-results/junit.xml`) and JSON (`test-results/results.json`, which the portal reads).

## Secrets and permissions

| Secret | Where | Used for |
|---|---|---|
| `ADMIN_USER`, `ADMIN_PASSWORD` | Actions secrets | The admin account; passed to the tests as environment variables (CI writes no `.env`). Callers pass them by name to `playwright-run.yml`, which declares them (no `secrets: inherit`). The customer account is registered per run |
| `GITHUB_TOKEN` | built in | Pushing to `gh-pages` and the wiki (given to the publish steps only); installing the coverage package in test runs |
| `PACKAGES_READ_TOKEN` | Dependabot secret | Dependabot's access to the private package (a classic token with `read:packages` only) |

Permissions are declared per workflow and kept minimal:

- test runs: `contents: write` (push to `gh-pages`) and `packages: read` (the coverage package). A called workflow can't have more permissions than its caller, so **every caller declares both**;
- `pr-checks.yml`: `contents: read` (it installs without the coverage package, as forks do);
- publish workflows: `contents: write`.

No workflow uses `pull_request_target`, so pull request code never runs with access to secrets.

### Supply-chain hardening

- **Actions pinned to commit SHAs**, with the version in a comment (`actions/checkout@<sha> # v7.0.1`): a tag can be moved to other code, a SHA can't. Dependabot updates the SHA and the comment together.
- **No token while code from dependencies runs:** every checkout sets `persist-credentials: false`, so the token isn't in the git config during the install and the tests. Only the publish steps get `GH_TOKEN`, and `gh-pages-lib.sh` (or the wiki job) pushes with it.
- **No install scripts:** `npm ci --ignore-scripts`. No dependency needs one, so a future version that adds one can't run while `NODE_AUTH_TOKEN` is set.
- **Inputs through `env:`:** `run:` scripts read inputs as environment variables, never as `${{ }}` pasted into the script, so an input can't become shell code.
- **A 7-day Dependabot cooldown** (see [Dependabot](#dependabot)).

## The pull request check: `verify`

`verify` runs on every pull request to `main` or `develop`, and it's the **required check** on `main`. It runs static checks only: `npm run typecheck`, `npm run validate:scenarios`, and `npm run test-cases:build` and `npm run bugs:build` (the Test Cases and Bugs pages must still build).

It runs no tests. They run locally before a push (each changed spec three times) and in the nightly regressions on `main`. So `verify` needs no secrets, no package token and no browser, and pull requests from forks and from Dependabot get the same check.

### Concurrency

A new push to a pull request cancels its running `verify`. Publishing is never cancelled: Publish Test Cases and Publish Wiki queue their own runs, test runs can publish in parallel, and the publish scripts retry a rejected push.

## Branches and rules

- `main` is protected by a ruleset: changes only through a pull request that passes `verify`, merged with a **merge commit** (squash and rebase are off); no force pushes, no deletion.
- `develop` is the working branch: no force pushes, no deletion.
- Scheduled runs, Test Cases and wiki publishing all work from `main`, so the portal and the wiki reflect merged code.

## Dependabot

`.github/dependabot.yml` checks weekly, on Tuesdays, and targets `develop`:

| Ecosystem | Grouping | Commit prefix |
|---|---|---|
| npm (including the private package, through the `github-packages` registry) | minor and patch updates in one pull request; majors on their own | `deps` |
| GitHub Actions | all updates in one pull request | `ci` |

Both ecosystems wait 7 days after a release before proposing it (`cooldown`), so a hijacked version has time to be caught and pulled; security updates aren't delayed. The GitHub Actions updates move the SHA pins together with their version comments.

Security updates ignore `target-branch` and always open against `main`; after merging one, merge `main` back into `develop`.

## Changing the pipeline

| Change | Where |
|---|---|
| A new test area folder | Add it to the `area` options of `custom-ui-tests.yml` or `custom-api-tests.yml` |
| A new scheduled run | A new caller of `playwright-run.yml` (example in [CI Runs](CI-Runs#add-a-new-scheduled-run)) |
| A new secret | Actions secrets, `workflow_call.secrets` and the `env:` of `playwright-run.yml`, the `secrets:` of every caller, `.env.example`, and the environment JSON placeholders |
| A new action | Pin it to its release's full commit SHA, with the version in a comment (`gh api repos/<owner>/<action>/commits/<tag> --jq .sha`) |
| Shell scripts | Keep LF line endings (`.gitattributes` enforces it for every `*.sh`) |

See also: [CI Runs](CI-Runs), [GitHub Pages Publishing](GitHub-Pages-Publishing).
