<!-- Source: docs/wiki/Test-Cases-Pages.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# Test Cases Pages

The **Test Cases pages** are a browsable catalog of every test scenario in `test-scenarios/`, one page per layer:

- **[UI Test Cases](https://zaytsman.github.io/SimpRight/test-cases/ui/)**
- **[API Test Cases](https://zaytsman.github.io/SimpRight/test-cases/api/)**

They answer "what do we test, and is it automated?" without opening YAML files: anyone can browse the scenarios, search them, see their steps, and jump to the spec that implements them or the user story they come from. The portal opens them with its **UI Test Cases** and **API Test Cases** buttons.

## The page

### Header

- The layer's title, a **UI | API** switch to the other page, and **Run on GitHub ↗**, which opens the layer's custom test workflow on the Actions tab.
- Four counters: **Total**, **Automated** (with its percentage), **Manual** and **Known issues**. Clicking one filters the list.
- When the catalog was built, and from which commit.

### The tree (side panel)

```
UI TEST CASES                     [Expand all] [Collapse all]
▸ Cart                                                    1
▾ Products                                               29
   ▾ Product detail                                       5
      ● UI-013  The product page shows the product's information...
      ● UI-014  A discounted product shows the original price...
   ▸ Product quantity                                     9
```

- **Area → file → scenario**, following `test-scenarios/<layer>/<area>/<file>.yml`. API files are labelled with their endpoint (`GET /products/{productId}`), UI files with their name (`Product detail`). Each group shows how many scenarios it holds.
- A dot shows the status: **green** automated, **red** manual; ⚠ marks a known issue.
- The tree **starts collapsed**. **Expand all** and **Collapse all** open or close every group; selecting a scenario opens its branch.
- **Search** looks through IDs, names, steps, suites, areas, file names, roles, tags, references, spec paths and known-issue texts.
- **Filters:** All, Automated, Manual, Known issue. A search or filter expands the matching groups.
- **Arrow keys** ↑ ↓ move through the scenarios in tree order.

### The scenario (main panel)

- **Breadcrumbs** (layer › area › file), the ID and name, and chips: status, known issue, role (`default`, `admin`, `guest`) and tags.
- **Banners:**
  - **Automated:** a link to the spec on GitHub, at the test's line; the command to run it locally (`npx playwright test -g "UI-013:"`, with a **Copy command** button); and **Run on GitHub ↗**, which copies `UI-013:` and opens the custom workflow. GitHub can't pre-fill a manual run's inputs from a link, so you choose the area and paste the copied text as the title filter (`grep`).
  - **Manual:** how to run it by hand (**Execute**) or automate it (`/implement-ui-scenarios UI-020`).
  - **Known issue:** the issue text, and that the test is expected to fail until the app is fixed.
  - **Source:** links to the scenario file and, for `ref`s in `docs/`, the user story or document it comes from.
- **Steps** tab: the numbered steps; `Verify` steps are highlighted as checks.
- **Execute** mode: tick off the steps while you run the scenario by hand. The ticks live only in that browser tab (nothing is saved or sent).
- **YAML** tab: the scenario exactly as it is in its file.
- **Copy link** copies a deep link to the scenario; **Copy YAML** copies the YAML.

Links to files point to GitHub's `main` branch, which is what the published pages were built from.

### Deep links

`#scenario=<ID>` opens a scenario directly, with its branch of the tree open: [test-cases/ui/#scenario=UI-013](https://zaytsman.github.io/SimpRight/test-cases/ui/#scenario=UI-013). Use them in bug reports, reviews and chats.

## How the pages are built

`scripts/build-test-cases.mts` reads `qa-agents-profile.yml` and every scenario file, and writes for each layer:

| File | Content |
|---|---|
| `<dir>/<layer>/index.html` | A copy of the page source, `site/test-cases/index.html` (one page for both layers) |
| `<dir>/<layer>/scenarios-data.js` | `window.SCENARIO_CATALOG = {...}`: the tree, every scenario with its steps and raw YAML, the counters, the spec line of each automated test, the commit, and the links to the repository and the custom workflow |

The data is a script rather than JSON so the page also opens straight from disk.

```bash
npm run test-cases:build                       # into test-results/test-cases/
npm run test-cases:build -- some/other/folder  # into a folder of your choice
```

Then open `test-results/test-cases/ui/index.html` in a browser.

## How they're published

- **On every push to `main`** that changes the scenarios, the page, its build or publish scripts, the profile or `index.html`, **Publish Test Cases** validates the scenarios, builds the pages and publishes `test-cases/` and the portal to `gh-pages` ([GitHub Pages Publishing](GitHub-Pages-Publishing#publishing-the-test-cases-pages-publish-test-casessh)). It can also be run by hand.
- **On every pull request,** `verify` builds the pages too, so a scenario change that breaks the build fails the check before it reaches `main`.

So the pages always show the scenarios of the merged code: a scenario written on `develop` appears after the next merge to `main`.

## Changing the pages

| Change | Where |
|---|---|
| Layout, filters, behaviour | `site/test-cases/index.html` (HTML, CSS and JavaScript in one file, no build step) |
| The data: labels, sorting, counters, links | `scripts/build-test-cases.mts` |
| Which workflow **Run on GitHub** opens | `WORKFLOWS` in `scripts/build-test-cases.mts` |

Preview a change with `npm run test-cases:build` and the files in `test-results/test-cases/`, or served over HTTP as in [GitHub Pages Publishing](GitHub-Pages-Publishing#previewing-locally).

See also: [Generate Scenarios](Generate-Scenarios), [Automation Portal](Automation-Portal).
