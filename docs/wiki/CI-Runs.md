<!-- Source: docs/wiki/CI-Runs.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# CI Runs

The tests run on **GitHub Actions**. Every run publishes its Playwright report to GitHub Pages, and the [Automation Portal](https://zaytsman.github.io/SimpRight/) shows the latest results, trends and run history.

This page covers the workflows, how to start a run by hand, how to change or add a schedule, and where to find the results.

## The workflows

| Workflow | File | When it runs | What it runs | Report family |
|---|---|---|---|---|
| **API Regression Test Run** | `run-api-tests.yml` | weekdays at 02:00 UTC, or by hand | all API tests, with the coverage report | `daily-api-regression` |
| **UI Regression Test Run** | `run-ui-tests.yml` | weekdays at 06:00 UTC, or by hand | all UI tests | `daily-ui-regression` |
| **Custom API Test Run** | `custom-api-tests.yml` | by hand | one API area, optionally filtered by title | `custom-api` |
| **Custom UI Test Run** | `custom-ui-tests.yml` | by hand | one UI area, optionally filtered by title | `custom-ui` |
| **PR Checks** (`verify`) | `pr-checks.yml` | every pull request to `main` or `develop` | typecheck, scenario validation and the tests the change can affect | none (results stay in the PR) |

The four test workflows are thin callers of one reusable workflow, `playwright-run.yml`. It checks out the code, installs Node.js 24, the dependencies and (for UI runs) Chromium, runs the typecheck and the tests, then publishes the report. A failed test fails the job, but only after the report has been published.

The test runs need two repository secrets: `ADMIN_USER` and `ADMIN_PASSWORD` (Settings → Secrets and variables → Actions). CI writes no `.env` file: the secrets reach the tests as environment variables.

## Start a run by hand

### From the GitHub web UI

1. Open the repository's **Actions** tab.
2. Pick a workflow in the list on the left, for example **Custom UI Test Run**.
3. Click **Run workflow** (top right of the run list).
4. Choose the **branch** to test. Scheduled runs always test `main`; a manual run can test `develop` or a feature branch.
5. For the custom runs, fill in the inputs:
   - **area**: a folder of `tests/ui` or `tests/api`, or `all`;
   - **grep** (optional): only tests whose title matches, for example `UI-013` or `UI-01[3-7]` (a regular expression), or a suite tag such as `@cart`.
6. Click **Run workflow**. The run appears in the list after a few seconds.

### From the command line

With the [GitHub CLI](https://cli.github.com) (`gh auth login` once):

```bash
# The full API regression on main
gh workflow run run-api-tests.yml --ref main

# The products UI area on develop, only UI-013 to UI-017
gh workflow run custom-ui-tests.yml --ref develop -f area=products -f grep="UI-01[3-7]"

# Follow the run you just started, then list the latest runs
gh run watch
gh run list --workflow custom-ui-tests.yml --limit 5
```

## Change a schedule

Schedules are `cron` lines in the workflow files:

```yaml
on:
  workflow_dispatch:
  schedule:
    # GitHub schedules run in UTC: 02:00 UTC on weekdays
    - cron: '0 2 * * 1-5'
```

To change the time or the days, edit the line in `run-api-tests.yml` or `run-ui-tests.yml` and merge the change into `main`.

### Cron syntax

Five fields, separated by spaces, always in **UTC**:

```
┌───────────── minute (0-59)
│ ┌─────────── hour (0-23, UTC)
│ │ ┌───────── day of the month (1-31)
│ │ │ ┌─────── month (1-12)
│ │ │ │ ┌───── day of the week (0-6, Sunday = 0)
│ │ │ │ │
0 2 * * 1-5
```

| Schedule | Cron |
|---|---|
| Weekdays at 02:00 UTC | `0 2 * * 1-5` |
| Every day at 03:30 UTC | `30 3 * * *` |
| Weekdays at 06:15 and 14:15 UTC | `15 6,14 * * 1-5` |
| Every 6 hours | `0 */6 * * *` |
| Mondays at 05:00 UTC | `0 5 * * 1` |

A workflow can have several `- cron:` lines; it runs at each of them. [crontab.guru](https://crontab.guru) explains any expression in plain words.

### Things to know about GitHub schedules

- **They run on the default branch only** (`main`). A schedule changed on `develop` takes effect after the merge, and it always tests `main`'s code.
- **UTC only.** Convert from your time zone, and remember that daylight saving time moves the local time by an hour twice a year.
- **They can start late**, often by 5-15 minutes and sometimes more when GitHub is busy, at the top of the hour most of all. They can even be skipped under heavy load.
- **Avoid the full hour for this app.** The demo site re-seeds its data every hour at :00, and logins and registrations can fail for a minute or two. A few minutes past the hour (`15 2 * * 1-5`) is safer.
- **Inactive public repositories:** GitHub turns schedules off after 60 days without activity in the repository. Re-enable the workflow on the Actions tab.
- **Forks:** schedules don't run in a fork until Actions is enabled there.

## Add a new scheduled run

Add a workflow file that calls `playwright-run.yml`. For example, the products UI area every weekday at 12:15 UTC, `.github/workflows/products-ui-midday.yml`:

```yaml
name: Products UI Midday Run

on:
  workflow_dispatch:
  schedule:
    - cron: '15 12 * * 1-5'

permissions:
  contents: write # push the report to gh-pages
  packages: read  # install the optional coverage package

jobs:
  ui-tests:
    uses: ./.github/workflows/playwright-run.yml
    secrets: inherit
    with:
      project: ui               # ui or api
      family: custom-ui         # where the report is published
      paths: tests/ui/products/ # spec folders or files; empty = the whole project
      grep: ''                  # optional title filter
```

| Input | Required | Meaning |
|---|---|---|
| `project` | yes | The Playwright project: `ui` or `api` |
| `family` | yes | The report family, the folder on GitHub Pages. The dashboard shows `daily-ui-regression`, `daily-api-regression`, `custom-ui` and `custom-api`; a new name is published too, but the dashboard doesn't list it |
| `paths` | no | Space-separated spec folders or files |
| `grep` | no | Only tests whose title matches |
| `publish-latest-coverage` | no | `true` only for the full API regression: its coverage becomes the dashboard's API Coverage |

Both permissions are needed in the calling file: a called workflow can't have more permissions than its caller.

## Pause or stop a schedule

- **For a while:** Actions tab → the workflow → **⋯** → **Disable workflow**, or `gh workflow disable run-ui-tests.yml`. Enable it again the same way (`gh workflow enable ...`).
- **For good:** remove the `schedule:` block from the file (keep `workflow_dispatch:` to still run it by hand).

## Where the results are

| Where | What |
|---|---|
| [Automation Portal](https://zaytsman.github.io/SimpRight/) | Latest status, counts, pass/fail and duration trends, known issues, run history |
| `https://zaytsman.github.io/SimpRight/<family>/run-<N>/` | The full Playwright report of run number N: steps, attachments, traces of failures |
| `https://zaytsman.github.io/SimpRight/latest/<family>/` | The newest run of a family |
| `https://zaytsman.github.io/SimpRight/latest/api-coverage/` | API coverage of the latest full API regression |
| The run's page on the Actions tab | The log, the error annotation with the report link, and the `playwright-report` and `test-results` artifact (kept 14 days) |

Each family keeps its latest **30 runs** on GitHub Pages; older ones are removed when a new run is published.

**Retries:** on CI a failing test is retried twice. A test that passes on a retry is marked **flaky** in the report. Look into those too: they tell you something.

To find out why a run failed, open its report, or use `/heal-tests <run id>` in Claude Code (see [docs/AI_WORKFLOW.md](https://github.com/Zaytsman/SimpRight/blob/main/docs/AI_WORKFLOW.md)).

## Pull request checks

`verify` runs on every pull request to `main` or `develop`. It's the required check on `main`. It always runs the typecheck and the scenario validation, then picks the tests from the changed files:

| Changed | Tests run |
|---|---|
| Config that every run depends on (`playwright.config.ts`, `src/globalSetup.ts`, `src/envs/`, `package*.json`, `tsconfig.json`, `.npmrc`, the check itself) | all |
| Only `src/` or `tests/` | the specs whose imports reach the changed files |
| Anything else (docs, wiki, scenarios, the dashboard, agents, other workflows) | none |

Pull requests from forks and from Dependabot get no secrets, so they run the typecheck and the scenario validation only.

See also: [Local Runs](Local-Runs).
