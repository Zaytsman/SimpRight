<!-- Source: docs/wiki/Automation-Portal.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# Automation Portal

The **Automation Portal** is SimpRight's dashboard on GitHub Pages: [zaytsman.github.io/SimpRight](https://zaytsman.github.io/SimpRight/). It shows the state of the test suite at a glance (is it green, how big is it, how much of the API it covers, what's known to be broken) and links to every published report.

It's a single static page, `index.html` in the repository root. It has no backend: it reads the JSON files the CI publishes next to it on `gh-pages` (see [GitHub Pages Publishing](GitHub-Pages-Publishing)).

## What's on it

### Side panel

| Part | Shows |
|---|---|
| **Latest Reports** | Links to the newest report of each family: UI Regression, API Regression, Custom UI, Custom API |
| **System Status** | **Healthy** or **Unhealthy** for the latest UI and API regression runs |

A run is **healthy** when its failure rate is below the threshold: **2 % for UI, 1 % for API** (`HEALTHY_FAILURE_RATE` in `index.html`).

### Header buttons

| Button | Opens | Shown when |
|---|---|---|
| **API Coverage** | The coverage report of the latest full API regression (new tab) | `latest/api-coverage/summary.json` exists |
| **UI Test Cases**, **API Test Cases** | The [Test Cases Pages](Test-Cases-Pages) (new tab) | `test-cases/<layer>/scenarios-data.js` exists |
| **Schedule Test Run** | The repository's Actions tab, to start or schedule a run (new tab; see [CI Runs](CI-Runs)) | always |
| **Test Runs History** | The history section below | always |
| **Known Issues** | The known issues section below | always |
| **Wiki** | This wiki (new tab) | always |

The **Schedule Test Run** and **Wiki** links point to the repository the site is served for: on `<owner>.github.io/<repo>/` they become `github.com/<owner>/<repo>/actions` and `.../wiki`, so a fork's portal links to the fork. Elsewhere (a local preview) they keep their default, SimpRight's own repository.

### Total Tests & Coverage

The number of UI and API tests in the latest regression runs and, with coverage published, the API endpoints covered (`covered/total`) and the overall API contract coverage in percent.

### Charts and Duration Trends

For the **last 10 runs** of the UI and the API regression, side by side:

| Chart | Plus the cards |
|---|---|
| **Passed / failed** per run | Latest run: passed, failed (links to the report filtered to failures), total, duration |
| **Duration** per run | Latest and average duration |
| **Failure rate** per run, each point green below the health threshold and red above it | Latest and average failure rate |

How the numbers are counted, from Playwright's JSON report (`results.json`):

- **passed** = expected results + flaky tests. A known-issue test that fails *as expected* counts as passed;
- **failed** = unexpected results;
- **total** = passed + failed + skipped + flaky;
- **failure rate** = failed / total.

Only the scheduled regressions (`daily-*` families) feed the charts and the status; custom runs appear in the history only.

### Known Issues

A table of every test that carries a **known issue**, with its area (the spec's suite), the test name and the issue text. It's built from the annotations in the latest UI and API regression results: any annotation whose description contains `Known issue`, which is what `test.fail(true, 'Known issue BUG-001: ...')` adds. When the bug is fixed and the `knownIssue` is removed from the scenario and the test, the row disappears after the next regression run.

### Test Runs History

The latest 10 runs of each family (UI Regression, API Regression, Custom UI, Custom API), each linking to its full Playwright report. The site keeps 30 runs per family; older ones are pruned.

## Where the data comes from

| Section | Files read |
|---|---|
| Status, totals, charts | `daily-ui-regression-manifest.json`, `daily-api-regression-manifest.json`, then `<family>/run-<N>/results.json` for the last 10 runs |
| Known Issues | `latest/daily-ui-regression/results.json`, `latest/daily-api-regression/results.json` |
| History | `<family>-manifest.json` of the four families |
| Coverage cards and button | `latest/api-coverage/summary.json` (`overallCoveragePct`, `coveredEndpoints`, `totalEndpoints`) |
| Test Cases buttons | a `HEAD` request for `test-cases/<layer>/scenarios-data.js` |

Everything optional is hidden until its file exists, so the portal works in a fork without the coverage package, and before the first run of any family ("No runs published yet").

## Changing the portal

1. Edit `index.html` in the repository root. It uses Bootstrap's CSS and Chart.js from the jsDelivr CDN, and plain JavaScript; no build step.
2. Preview it over HTTP (see [GitHub Pages Publishing](GitHub-Pages-Publishing#previewing-locally)): the charts stay empty locally unless you serve a checkout of `gh-pages`.
3. Merge to `main`. **Publish Test Cases** runs on changes to `index.html` and publishes it at once; every test run also copies it.

Common changes:

| Change | Where in `index.html` |
|---|---|
| The health thresholds | `HEALTHY_FAILURE_RATE = { ui: 2, api: 1 }` |
| How many runs the charts and the history show | The `limit` arguments of `loadSeries` and `loadHistorySection` (default 10) |
| A new report family in the history or Latest Reports | A new `<details>` block and `loadHistorySection(...)` call; a link in the side panel |

The number of runs kept on the site is set separately, by `KEEP_RUNS` in `scripts/publish-report.sh`.

See also: [Test Cases Pages](Test-Cases-Pages), [CI Runs](CI-Runs#where-the-results-are).
