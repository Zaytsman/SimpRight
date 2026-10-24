<!-- Source: docs/wiki/Study-Case-API-Tests.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# Study Case: API Tests

You add API coverage for one endpoint, starting from the API's source code: **`GET /products/{productId}/related`**, the products shown under "Related products" on a product page. It needs no token and changes no data, and it has two bugs to find.

Set up first: see [Study Case](Study-Case) (the `study-case` branch, the app's source next to the framework).

## What is missing on the branch

| | On the branch |
|---|---|
| Contract | [Products_API.md](https://github.com/Zaytsman/SimpRight/blob/main/docs/api/contracts/Products_API.md) has no section for the endpoint |
| Client | `ProductsClient` has no method for it |
| Scenarios and spec | none for the endpoint |
| Bugs | none for the endpoint |

## 1. Write the contract

```text
/write-api-contracts ../practice-software-testing/sprint5/API products
```

Claude asks whether live checks are allowed: choose **read-only**. The `api-contract-writer` agent reads the routes and the controller, calls the endpoint to confirm what it read, and fills the gap in `Products_API.md` (without `update`, it only adds).

**Check:** a section for the endpoint, with its parameters, the success response and every error status. Facts the agent saw live carry `_(verified)_`, facts read only from the code `_(source)_`. Look at what it reports as **suspected bugs**: you meet them again in step 3. Commit.

See [/write-api-contracts](Write-API-Contracts) for the details.

## 2. Write the scenarios

```text
/write-api-scenarios-from-contract Products_API.md
```

The `api-scenario-writer` agent compares the contract with the existing scenarios and proposes the missing ones, all in one new file, `test-scenarios/api/products/get-products-by-product-id-related.yml`. Nothing is written until you approve.

**Check the proposal:** a happy path (what makes a product "related"), the error cases, and a check on the fields the items should have. Ask yourself what each scenario proves and whether two of them prove the same. Approve, or ask for changes in your answer. Commit.

See [/write-api-scenarios-from-contract](Write-API-Scenarios-From-Contract).

## 3. Automate them

```text
/implement-api-scenarios get-products-by-product-id-related.yml
```

The `api-test-engineer` agent plans first: the spec, the client method it needs, and a table of the scenarios. After your approval it writes the code, runs the spec against the live API and reports.

**Expect failures.** The app has bugs here, so some tests fail even though they are right. For each failure the report shows the request, what was expected and what came back. Leave them failing for now: the next step records them. Commit.

See [/implement-api-scenarios](Implement-API-Scenarios).

## 4. Record the bugs

```text
/report-bug <the failing scenario IDs>
```

The `bug-reporter` agent reproduces each failure, finds its root cause, and drafts one bug per cause. After your approval it writes the bug files in `bugs/`, links the scenarios (`knownIssue` and `bug`) and adds the known-issue line to the tests, which now pass as expected failures.

**Check:** one bug per root cause, steps a person can follow, no secrets. `npm run bugs:build` builds the Bugs page into `test-results/bugs/index.html`. Commit.

See [/report-bug](Report-Bug).

## 5. Review the tests

```text
/review-tests get-products-by-product-id-related.spec.ts
```

The `test-reviewer` agent checks the spec against its scenarios and the project's conventions and ranks its findings. Pick the ones to apply; Claude applies them and runs the spec again. Commit.

See [/review-tests](Review-Tests).

## 6. Finish and compare

```bash
npx playwright test tests/api/products/get-products-by-product-id-related.spec.ts
npm run validate:scenarios
npm run typecheck
```

All pass: the tests that hit a bug count as expected failures. Then compare with the reference on `main`:

```bash
git diff origin/main -- docs/api/contracts/Products_API.md test-scenarios/api/products/get-products-by-product-id-related.yml tests/api/products/get-products-by-product-id-related.spec.ts src/api/clients/ProductsClient.ts
```

The reference has 3 scenarios (API-0023 to API-0025) and two bugs: [BUG-004](https://github.com/Zaytsman/SimpRight/blob/main/bugs/BUG-004.yml) and [BUG-005](https://github.com/Zaytsman/SimpRight/blob/main/bugs/BUG-005.yml). Did you find the same two?

Next: [UI Tests](Study-Case-UI-Tests).
