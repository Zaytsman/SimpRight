<!-- Source: docs/wiki/CI-Runs.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# CI Runs

Besides the nightly regressions, the tests can be run on **GitHub Actions** by hand, on any branch. This page covers the three workflows for that and where to find the results. For the nightly regressions and their schedules, see [Scheduled Runs](Scheduled-Runs).

| Workflow | File | What it runs | Report family |
|---|---|---|---|
| **Custom API Test Run** | `custom-api-tests.yml` | one API area or all of them, optionally filtered by title | `custom-api` |
| **Custom UI Test Run** | `custom-ui-tests.yml` | one UI area or all of them, optionally filtered by title | `custom-ui` |
| **Smoke Test Run** | `smoke-tests.yml` | the smoke set: the critical happy paths of both layers (tests tagged `@smoke`), in 2-3 minutes | `smoke` |

## Start a run by hand

### From the GitHub web UI

1. Open the repository's **Actions** tab (or click **Schedule a test run** in the side panel of the [Automation Portal](Automation-Portal)).
2. Pick **Custom API Test Run**, **Custom UI Test Run** or **Smoke Test Run** in the list on the left.
3. Click **Run workflow** (top right of the run list).
4. Choose the **branch** to test: `main`, `develop` or a feature branch.
5. For the custom runs, fill in the inputs:
   - **area**: a folder of `tests/api` (`products`, `users`, `carts`, `invoices`, ...) or `tests/ui` (`cart`, `products`), or `all`;
   - **grep** (optional): only tests whose title matches, for example `UI-013` or `UI-01[3-7]` (a regular expression), or a tag such as `@cart`;
   - **keep-runs** (default 10): how many runs of that custom family stay on GitHub Pages; older ones are removed when this run is published.

   The smoke run has no inputs.
6. Click **Run workflow**. The run appears in the list after a few seconds.

### From the command line

With the [GitHub CLI](https://cli.github.com) (`gh auth login` once):

```bash
# The invoices API area on develop
gh workflow run custom-api-tests.yml --ref develop -f area=invoices

# The products UI area on develop, only UI-013 to UI-017
gh workflow run custom-ui-tests.yml --ref develop -f area=products -f grep="UI-01[3-7]"

# The smoke set on main
gh workflow run smoke-tests.yml --ref main

# Follow the run you just started, then list the latest runs
gh run watch
gh run list --workflow custom-ui-tests.yml --limit 5
```

### Good to know

- **Avoid :45-:02 UTC.** The demo site re-seeds its data every hour at :00. A run that starts in that window waits until :03 before the tests begin, and the re-seed deletes the data a running test relies on.
- **Retries:** on CI a failing test is retried once. A test that passes on its retry is marked **flaky** in the report.
- A failed test fails the run, but only after its report has been published.

## Review test run results

### When the results are published

Every run publishes its Playwright report to GitHub Pages as its last step, after the tests, whether they passed or failed (a cancelled run publishes nothing). GitHub Pages then deploys the site, which usually takes about a minute: the report is on the portal about a minute after the run finishes. If the portal still shows the previous run, reload the page.

### Where to find them on the Automation Portal

Open the [Automation Portal](https://zaytsman.github.io/SimpRight/):

| Where | What |
|---|---|
| **Latest reports** (side panel) → **Custom UI**, **Custom API** or **Smoke** | The full Playwright report of the newest run of that family; the dot is red when that run had failures |
| **Run history** → the family's row → **Show runs** | The latest 10 runs of the family, newest first, each with its result and a link to its report; the row's squares show which runs had failures |

Custom and smoke runs appear only in these two places: the status, the trends and **Known issues** show the nightly regressions only.

The report of run number N is also at `https://zaytsman.github.io/SimpRight/<family>/run-<N>/` (for example `smoke/run-12/`), and the newest one at `https://zaytsman.github.io/SimpRight/latest/<family>/`. N is the run number in the run's title on the Actions tab (`#12`). Each family keeps its latest **10 runs** (a custom run's **keep-runs** input changes it for its family); older ones are removed when a new run is published.

### What a report shows

Every test with its steps, named like the scenario's steps, the attached requests and responses (secrets masked) and, for UI failures, a screenshot and a video. Known-issue tests that fail as expected count as passed.

### On the Actions tab

The run's page has the log and, when tests failed, an error annotation with the link to the report. Its artifact (`<family>-run-<N>`: the HTML report and the raw test results) can be downloaded for 14 days.

To find out why a run failed, use [/heal-tests](Heal-Tests) `<run id>` in Claude Code.

See also: [Automation Portal](Automation-Portal), [Local Runs](Local-Runs).
