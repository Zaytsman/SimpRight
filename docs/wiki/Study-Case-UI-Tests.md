<!-- Source: docs/wiki/Study-Case-UI-Tests.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# Study Case: UI Tests

You add coverage for a user story, starting from its text: **[Rental_Products.md](https://github.com/Zaytsman/SimpRight/blob/main/docs/ui/user-stories/Rental_Products.md)**, the tools a visitor can rent by the hour. The analysis decides which checks go to the API and which to the UI, so this part produces tests on both layers, and the page objects the UI tests need.

Set up first: see [Study Case](Study-Case). The [API part](Study-Case-API-Tests) is a good warm-up: it introduces most of the skills used here.

## What is missing on the branch

| | On the branch |
|---|---|
| Analysis | none for the story (`docs/analysis/` has the other stories' analyses, as examples) |
| Scenarios and specs | none for the rentals page, the rental label in the checkout, the location discount on a rental, or the rental filter on the API |
| Page objects and fixtures | no rentals page object, no rental card grid, no way to open the rentals page from the menu, no rental note on a checkout line |
| Bugs | none for the story |

Some of the story is already covered: the duration slider and the total on a rental's product page are part of the [Product Detail](https://github.com/Zaytsman/SimpRight/blob/main/docs/ui/user-stories/Product_Detail.md) story. Watch whether the analysis notices.

## 1. Analyse the story

```text
/analyze-requirements Rental_Products.md
```

The `requirements-analyst` agent reads the story, the API contracts, the existing scenarios and the app's source (`../practice-software-testing/sprint5/UI`), and looks at the live pages with the read-only page inspector.

**Checkpoint 1, the test plan:** each acceptance criterion broken into checks, and each check placed on the API or the UI, **API first** (an API test is cheaper and faster, so a check goes to the UI only when the API can't prove it). Existing scenarios that already cover a check are reused. Answer the "Decisions needed": they decide the layers, the test data and possible known issues.

**Checkpoint 2, the scenarios:** the API and UI scenario writers turn the approved plan into scenarios for both layers, and you approve them together. The analysis lands in `docs/analysis/rental-products.md`, the scenarios in `test-scenarios/` with `status: manual`. Commit.

See [/analyze-requirements](Analyze-Requirements).

## 2. Automate the API scenarios

```text
/implement-api-scenarios <the new API scenario IDs>
```

Some of these tests create data (a rental product, a cart): the plan lists them for your approval, and the tests remove what they create. Commit.

See [/implement-api-scenarios](Implement-API-Scenarios).

## 3. Automate the UI scenarios

```text
/implement-ui-scenarios <the new UI scenario IDs>
```

The `ui-test-engineer` agent inspects the pages, then plans: the specs, and the page objects, components and fixtures to add (a rentals page, its card grid, the menu link, a precondition fixture that opens the page). After your approval it writes them, runs the tests in a browser and reports.

**Expect a failure:** the story and the app don't agree on one text in the checkout. Leave it failing for now. Commit.

See [/implement-ui-scenarios](Implement-UI-Scenarios) and [UI Layer](UI-Layer) for how pages and components are built.

## 4. Record the bug

```text
/report-bug <the failing scenario ID>
```

The `bug-reporter` agent reproduces the failure and drafts the bug; after your approval it writes the bug file and marks the test as a known issue. Commit.

See [/report-bug](Report-Bug).

## 5. Review the tests

```text
/review-tests
```

Without arguments it reviews what your branch added since `origin/study-case`. If that is more than about 15 files, review one spec at a time (`/review-tests rentals.spec.ts`). Pick the findings to apply. Commit.

See [/review-tests](Review-Tests).

## 6. Finish and compare

Run the new specs (the UI ones open a browser), then the static checks:

```bash
npx playwright test tests/ui/products/rentals.spec.ts
npm run validate:scenarios
npm run typecheck
```

Compare with the reference on `main`:

```bash
git diff origin/study-case origin/main --stat
git diff origin/main -- docs/analysis/rental-products.md
```

The reference analysis has 12 checks (5 API, 7 UI, 3 of them already covered), 9 new scenarios (API-0324 to API-0327, UI-081 to UI-085), the rentals page object with its grid and fixtures, and one bug: [BUG-051](https://github.com/Zaytsman/SimpRight/blob/main/bugs/BUG-051.yml), the rental line's label. Did your analysis put the same checks on the same layers? Where it didn't, which reason convinces you more?
