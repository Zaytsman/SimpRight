<!-- Source: docs/wiki/Bugs-Page.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# Bugs Page

The **[Bugs page](https://zaytsman.github.io/SimpRight/bugs/)** lists the bugs found in the app under test (the Toolshop), one per root cause, with how to reproduce each one, the tests that hit it and how those tests did in the latest regression. The portal opens it with its **Bugs** button.

## Where the bugs come from

Each bug is a file in `bugs/`, such as `bugs/BUG-003.yml`, in the format of `bugs/bug.schema.json`:

```yaml
# yaml-language-server: $schema=./bug.schema.json
id: BUG-003
title: Product list returns 500 for an unknown sort column instead of a client error
status: open                 # open | fixed | wont-fix
severity: major              # critical | major | minor | trivial
layer: api                   # where the defect is
area: products
affects:
  - GET /products
  - QUERY /products
found: 2026-10-02
ref:
  - docs/api/contracts/Products_API.md#1-list-products
steps:
  - Send GET /products with sort=no_such_column,asc.
expected: 400 or 422 naming the sort column, or 200 with the column ignored.
actual: 500 for both.
```

Optional keys: `resolved` (the date, required once the status isn't `open`), `upstream` (a link to the bug in the app's own tracker), `description` (impact and cause) and `evidence` (a request and response, masked like the reports).

A scenario that hits a bug names it next to its `knownIssue`, and its test starts with the bug ID:

```yaml
  - id: API-0014
    name: Unknown sort column is not a server error
    ...
    knownIssue: Returns 500 instead of a client error (or ignoring the column) for an unknown sort column.
    bug: BUG-003
```

```ts
test.fail(true, 'Known issue BUG-003: Returns 500 instead of a client error (or ignoring the column) for an unknown sort column.');
```

Scenarios with the same cause share one bug: BUG-001 (product writes without a token) covers the `POST`, `PUT` and `PATCH` scenarios. `npm run validate:scenarios` checks that every `bug` names an open bug file, that the test's known-issue line has the same bug ID and text, and prints the next free bug ID.

## The page

### Side panel

- Four counters: **Total**, **Open**, **Re-check** and **Fixed**. Clicking one filters the list.
- **Search** looks through IDs, titles, descriptions, steps, expected and actual results, affected endpoints, references and the linked scenarios.
- **Filters:** status (All, Open, Re-check, Fixed, Won't fix), severity, and layer / area.
- The list is grouped by status: open bugs first, sorted by severity (dot: red critical, amber major, blue minor, grey trivial), then by ID. Each bug shows how many scenarios hit it, and ⟳ when it needs a re-check.
- **Arrow keys** ↑ ↓ move through the bugs.

### The bug (main panel)

- **Breadcrumbs** (layer › area), the title, and chips: ID, status, severity, found and resolved dates.
- **Re-check** banner, when a test that expects the bug **passed** in the latest regression: the bug may be fixed. Re-check it with `/report-bug recheck <ID>` ([Bug Reporter](Bug-Reporter)): if it's fixed, the bug gets `status: fixed` and `resolved`, and `knownIssue`, `bug` and the known-issue line are removed from its scenarios and tests (the [Test Healer](Test-Healer) proposes the same for an "unexpectedly passed" test).
- **Tests** banner: every scenario that names the bug, linked to the [Test Cases Pages](Test-Cases-Pages), with the latest result of its test (**Bug still there**: failed as expected; **Passed: re-check**; **Not in the latest run**; **Manual**) and a link to the spec at the test's line.
- **Source** banner: the affected endpoints or pages, the bug file, where the expected behaviour comes from (contracts, user stories), and the upstream report.
- **Details** tab: description, steps to reproduce, expected and actual result, evidence. **YAML** tab: the bug file.
- **Copy link** copies a deep link; **Copy YAML** copies the file.

### Deep links

`#bug=<ID>` opens a bug directly: [bugs/#bug=BUG-003](https://zaytsman.github.io/SimpRight/bugs/#bug=BUG-003). The portal's Known Issues table and the Test Cases pages' known-issue banners link there.

## How the page is built and published

`scripts/build-bugs.mts` reads the profile, the bug files and the scenarios, and writes:

| File | Content |
|---|---|
| `<dir>/index.html` | A copy of the page source, `site/bugs/index.html` |
| `<dir>/bugs-data.js` | `window.BUG_CATALOG = {...}`: every bug with its raw YAML and the scenarios that name it (with their spec line), the counters, the commit, and where the latest regression results are |

```bash
npm run bugs:build                       # into test-results/bugs/
npm run bugs:build -- some/other/folder  # into a folder of your choice
```

The latest results are read **in the browser** from `latest/daily-ui-regression/results.json` and `latest/daily-api-regression/results.json`, so a new regression run updates the results and the re-check flags without a rebuild. Opened from disk, the page has no results and shows the bugs only.

**Publish Test Cases** builds and publishes the page as `bugs/` together with the Test Cases pages, on every push to `main` that changes `bugs/`, the scenarios, the page or its build ([GitHub Pages Publishing](GitHub-Pages-Publishing)). On pull requests, `verify` builds it too.
