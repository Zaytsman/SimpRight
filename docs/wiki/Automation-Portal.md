<!-- Source: docs/wiki/Automation-Portal.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# Automation Portal

The **Automation Portal** is SimpRight's dashboard on GitHub Pages: [zaytsman.github.io/SimpRight](https://zaytsman.github.io/SimpRight/). It shows the state of the test suite at a glance (is it green, how big is it, how much of the API it covers, what's known to be broken) and links to every published report.

It's a single static page, `index.html` in the repository root. It has no backend: it reads the JSON files the CI publishes next to it on `gh-pages` (see [GitHub Pages Publishing](GitHub-Pages-Publishing)).

Its look follows the README banner's logo: GitHub's dark greys with the logo's green. Green means passing or healthy, red failing, amber a known issue. The [Test Cases Pages](Test-Cases-Pages) and the [Bugs Page](Bugs-Page) use the same colors and the same logo, which leads back to the portal.

## What's on it

### Side panel

| Part | Shows |
|---|---|
| Logo | **SimpRight**, Automation Framework |
| **Navigate** | **Known issues** and **Run history** (jump to those sections), **Schedule a test run** (the repository's Actions tab, to start a run by hand; see [CI Runs](CI-Runs)) and **Wiki** (this wiki); the last two open in a new tab |
| **Latest reports** | Links to the newest report of each family: UI regression, API regression, Smoke, Custom UI, Custom API. A dot shows how the newest run went: for the two regressions green **healthy**, red **unhealthy**; for the others green without failures, red with failures; grey before the first run |

The **Schedule a test run** and **Wiki** links point to the repository the site is served for: on `<owner>.github.io/<repo>/` they become `github.com/<owner>/<repo>/actions` and `.../wiki`, so a fork's portal links to the fork. Elsewhere (a local preview) they keep their default, SimpRight's own repository.

On a narrow screen the side panel moves above the content.

### Buttons

| Button | Opens | Shown when |
|---|---|---|
| **API coverage** | The coverage report of the latest full API regression (new tab) | `latest/api-coverage/totals.json` exists |
| **UI test cases**, **API test cases** | The [Test Cases Pages](Test-Cases-Pages) (new tab) | `test-cases/<layer>/scenarios-data.js` exists |
| **Bugs** | The [Bugs Page](Bugs-Page) (new tab) | `bugs/bugs-data.js` exists |

### Status

| Card | Shows |
|---|---|
| **UI regression**, **API regression** | **Healthy** or **Unhealthy** for the latest regression run, and its total number of tests |
| **API contract coverage** | The overall API contract coverage in percent, with a bar (only with coverage published) |
| **Endpoints covered** | The API endpoints covered (`covered / total`) and a link to the coverage report (only with coverage published) |

A run is **healthy** when its failure rate is below the threshold: **2 % for UI, 1 % for API** (`HEALTHY_FAILURE_RATE` in `index.html`).

### UI trends and API trends

One section per regression, for its **last 10 runs**. Each starts with the cards of the latest run:

| Card | Shows |
|---|---|
| **Total** | Tests in the latest run |
| **Passed** | Passed tests, flaky ones included |
| **Failed** | Failed tests; links to the report filtered to failures |
| **Run duration** | The latest run's duration |
| **Average duration** | The average over the runs shown |
| **Failure rate (avg)** | The latest run's failure rate, and the average in brackets |

The charts are **collapsed**: **Show trends** opens two of them (and becomes **Hide trends**):

| Chart | Shows |
|---|---|
| **Failure rate per run** | A line of the failure rate, each point green below the health threshold and red above it, and the threshold as a dashed line. The line is green when the latest run is healthy, red when it isn't |
| **Duration per run** | A line of the run duration in seconds |

How the numbers are counted, from the stats of Playwright's JSON report (`results.json`), which the publish copies into the family's history file:

- **passed** = expected results + flaky tests. A known-issue test that fails *as expected* counts as passed;
- **failed** = unexpected results;
- **total** = passed + failed + skipped + flaky;
- **failure rate** = failed / total.

Only the scheduled regressions (`daily-*` families) feed the status cards and the trends; custom runs appear in the history and Latest reports only.

### Known issues

A table of every test that carries a **known issue**, with its area (the spec's suite), the test name, its **bug** and the issue text; the badge next to the title counts them. It's built from the annotations in the latest UI and API regression results: any annotation whose description contains `Known issue`, which is what `test.fail(true, 'Known issue BUG-001: ...')` adds. The bug ID links to the bug on the [Bugs Page](Bugs-Page) (results from before bug IDs show `-`). When the bug is fixed and the `knownIssue` is removed from the scenario and the test, the row disappears after the next regression run.

The table is **collapsed** to its first 3 rows; **Show all N known issues** below it expands the whole list, and **Show only the first 3** collapses it again.

### Run history

One row per family (UI regression, API regression, Smoke, Custom UI, Custom API). Each row shows the latest 10 runs as squares, oldest to newest: green without failures, red with failures, grey without results. **Show runs** lists them, newest first, each with its result (`3 of 98 failed`, `98 passed`) and a link to its full Playwright report. The site keeps the latest 10 runs per family by default (the workflows' `keep-runs` setting); older ones are pruned.

## Where the data comes from

| Section | Files read |
|---|---|
| Status, trends | `daily-ui-regression-history.json`, `daily-api-regression-history.json` (the stats of the last 10 runs with results) |
| Known issues | the same two files (the newest run's known issues) |
| Run history, the dots in Latest reports | `<family>-history.json` of the five families |
| Coverage cards and button | `latest/api-coverage/totals.json` (`overallCoveragePct`, `coveredEndpoints`, `totalEndpoints`) |
| Test case buttons | a `HEAD` request for `test-cases/<layer>/scenarios-data.js` |
| Bugs button | a `HEAD` request for `bugs/bugs-data.js` |

Everything optional is hidden until its file exists, so the portal works in a fork without the coverage package, and before the first run of any family ("No runs published yet").

## Changing the portal

1. Edit `index.html` in the repository root. It has its own CSS (the colors are the variables at the top of its `<style>`), Chart.js from the jsDelivr CDN, and plain JavaScript; no build step.
2. Preview it over HTTP (see [GitHub Pages Publishing](GitHub-Pages-Publishing#previewing-locally)): the trends stay empty locally unless you serve a checkout of `gh-pages`.
3. Merge to `main`. **Publish Test Cases** runs on changes to `index.html` and publishes it at once; every test run also copies it.

Common changes:

| Change | Where in `index.html` |
|---|---|
| The health thresholds | `HEALTHY_FAILURE_RATE = { ui: 2, api: 1 }` |
| How many runs the trends and the history show | The `limit` arguments of `toSeries` and `renderHistoryList` (default 10) |
| How many known issues the collapsed table shows | `KNOWN_ISSUES_PREVIEW` (3) |
| A new report family in the history or Latest reports | A new `<details>` row (with its `-strip` and `-list` ids) and an entry in `HISTORY_LISTS`; a link with a `data-family-dot` in the side panel |
| The colors | The CSS variables in `:root`, and `COLORS` in the script for the charts |

The number of runs kept on the site is set separately, by the `keep-runs` input of `playwright-run.yml` (10 by default; the custom workflows ask for it).

See also: [Test Cases Pages](Test-Cases-Pages), [CI Runs](CI-Runs#review-test-run-results).
