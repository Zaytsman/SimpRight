<!-- Source: docs/wiki/Scheduled-Runs.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# Scheduled Runs

The full regressions run on a schedule on **GitHub Actions**, on `main`. This page covers the scheduled workflows, how to change, add, pause or stop a schedule, and what to know about GitHub schedules. To start a run by hand, see [CI Runs](CI-Runs).

## The scheduled workflows

| Workflow | File | When it runs | What it runs | Report family |
|---|---|---|---|---|
| **API Regression Test Run** | `run-api-tests.yml` | weekdays at 02:15 UTC, or by hand | all API tests, with the coverage report | `daily-api-regression` |
| **UI Regression Test Run** | `run-ui-tests.yml` | weekdays at 06:15 UTC, or by hand | all UI tests | `daily-ui-regression` |

Their results feed the [Automation Portal](Automation-Portal)'s status, charts and Known Issues; the API regression's coverage also becomes the portal's API Coverage.

## Change a schedule

Schedules are `cron` lines in the workflow files:

```yaml
on:
  workflow_dispatch:
  schedule:
    # GitHub schedules run in UTC: 02:15 UTC on weekdays
    - cron: '15 2 * * 1-5'
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
15 2 * * 1-5
```

| Schedule | Cron |
|---|---|
| Weekdays at 02:15 UTC | `15 2 * * 1-5` |
| Every day at 03:30 UTC | `30 3 * * *` |
| Weekdays at 06:15 and 14:15 UTC | `15 6,14 * * 1-5` |
| Every 6 hours at :15 | `15 */6 * * *` |
| Mondays at 05:15 UTC | `15 5 * * 1` |

A workflow can have several `- cron:` lines; it runs at each of them. [crontab.guru](https://crontab.guru) explains any expression in plain words.

### Things to know about GitHub schedules

- **They run on the default branch only** (`main`). A schedule changed on `develop` takes effect after the merge, and it always tests `main`'s code.
- **UTC only.** Convert from your time zone, and remember that daylight saving time moves the local time by an hour twice a year.
- **They can start late**, often by 5-15 minutes and sometimes by hours when GitHub is busy, at the top of the hour most of all. They can even be skipped under heavy load.
- **Avoid the full hour for this app.** The demo site re-seeds its data every hour at :00, and logins and registrations can fail for a minute or two. A few minutes past the hour is safer, which is why the nightly runs start at :15. A run that starts between :45 and :02 UTC waits until :03 before the tests begin.
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
    secrets:
      ADMIN_USER: ${{ secrets.ADMIN_USER }}
      ADMIN_PASSWORD: ${{ secrets.ADMIN_PASSWORD }}
    with:
      project: ui               # ui or api
      family: custom-ui         # where the report is published
      paths: tests/ui/products/ # spec folders or files; empty = the whole project
      grep: ''                  # optional title filter
```

| Input | Required | Meaning |
|---|---|---|
| `project` | yes | The Playwright project: `ui`, `api`, or `all` (both in one run) |
| `family` | yes | The report family, the folder on GitHub Pages. The portal shows `daily-ui-regression`, `daily-api-regression`, `smoke`, `custom-ui` and `custom-api`; a new name is published too, but the portal doesn't list it |
| `paths` | no | Space-separated spec folders or files |
| `grep` | no | Only tests whose title matches |
| `publish-latest-coverage` | no | `true` only for the full API regression: its coverage becomes the portal's API Coverage |

Both permissions are needed in the calling file: a called workflow can't have more permissions than its caller. The two secrets are passed by name: `playwright-run.yml` declares them, and no other secret reaches the test job.

## Pause or stop a schedule

- **For a while:** Actions tab → the workflow → **⋯** → **Disable workflow**, or `gh workflow disable run-ui-tests.yml`. Enable it again the same way (`gh workflow enable ...`).
- **For good:** remove the `schedule:` block from the file (keep `workflow_dispatch:` to still run it by hand).

## Results

A scheduled run publishes its report like a run started by hand: see [CI Runs](CI-Runs#review-test-run-results). On the [Automation Portal](Automation-Portal), it's under **Latest Reports** → **UI Regression** or **API Regression** and in **Test Runs History**, and it updates the status, the charts and Known Issues.

See also: [CI Pipeline](CI-Pipeline), [CI Runs](CI-Runs), [Local Runs](Local-Runs).
