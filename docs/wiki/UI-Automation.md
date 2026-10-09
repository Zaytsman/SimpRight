<!-- Source: docs/wiki/UI-Automation.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# UI Automation

How to turn UI scenarios into browser tests with the AI agents: one command, a plan you approve (built from what the agent saw on the live pages), then the page objects, the specs, the test runs and a report. After that come the review, the commit and, if CI fails, the healing.

```
manual UI scenarios ──/implement-ui-scenarios──► inspect pages ──► plan ──approve──► page objects, flows, fixtures, specs
                                                                                       │
                      /review-tests ◄──────────────────────────────────────────────────┘ ──► commit, PR, CI ──/heal-tests (if red)
```

## Before you start

- **Scenarios with `status: manual`** in `test-scenarios/ui/<area>/`. See [Generate Scenarios](Generate-Scenarios).
- The framework installed, `.env` set up and a passing run ([Installation & Setup](Installation-&-Setup)): the agent inspects the live pages and runs the new specs in Chromium.
- The project open in **[Claude Code](https://claude.com/claude-code)**.

## 1. Start the run

```text
/implement-ui-scenarios product-quantity.yml
/implement-ui-scenarios UI-018 UI-019
/implement-ui-scenarios UI-018..026
/implement-ui-scenarios products
```

The argument is a scenario file (the name is enough), scenario IDs or a range, or an area folder. Without one, Claude lists the UI files with their count of `manual` scenarios and asks.

Only `manual` scenarios are in scope; `automated` ones are skipped unless you ask to redo them. For more than about 10 scenarios or 2 files, Claude suggests starting with one file: UI plans carry more detail than API plans.

## 2. The agent looks at the pages

The `ui-test-engineer` agent reads the scenarios, the existing page objects, flows and fixtures, and the project's exemplar files (named in `qa-agents-profile.yml`). Then it **inspects every page the steps touch** with the read-only page inspector:

```bash
npm run inspect:ui -- /auth/login --logged-out
npm run inspect:ui -- / --then "select:sort=Price (High - Low)" --then "check:Hammer"
```

The inspector opens the page as the scenario's role, can click tabs and menus, tick filters and pick list options, and prints every `data-test` element (with its role, label, text and visibility) and the accessibility tree. It never types or submits, so it changes no data. You can run it yourself the same way when writing tests by hand.

From that, the agent notes for each element a step needs **how to find it** (a `data-test` id first, then role, label or text; never XPath) and **how the app signals that an action is done**: a marker element, a toast, a URL, a reloaded list. Tests wait for those signals, never for fixed sleeps.

## 3. Review the plan

**Nothing is written yet.** Per scenario file, the plan shows:

| Part | What it tells you |
|---|---|
| **Spec** | `tests/ui/<area>/<same name>.spec.ts`, new or extended |
| **Scenario table** | Each scenario's role, whether it writes data, whether it's a known issue |
| **Needs** | Every page object, component, dialog, flow, method, getter, fixture and constant, marked `exists`, `new` or **`changed (needs approval)`**: a change to the behaviour of something other tests use (a wait added to `waitForLoaded()`), with the reason and the tests affected |
| **Locators** | Each new locator and how it's found (`getByTestId('sort')`, `getByLabel('Hammer')`), from the inspector |
| **Waits** | The app signal each new action waits for |
| **Test data** | Where each piece of data comes from: a step, `TestConstants`, an API fixture |
| **Cleanup** | Records the tests create and how each is removed |

Then, for the whole run: **Writes needing approval** (tests that add to the cart, register, add a favourite, place an order: they change live data, so each needs your yes), **Can't automate as written**, and **Decisions needed**.

Claude asks in one message: approve the plan or say what to change, which writes are allowed (each one, or "all of them"), and the answers to the decisions.

## 4. Implementation

After your approval, the same agent:

1. **Adds the missing UI code**, only what the plan listed, in the style of the exemplars (the `ui-scaffolding` skill):
   - page objects in `src/ui/pages/`, extending `BasePage`: locators in `private readonly` fields, a noun getter only for what a test asserts on (`get searchCaption()`), verbs for actions (`addToCart()`), no assertions inside;
   - shared parts in `src/ui/pages/components/`, dialogs in `src/ui/pages/dialogs/`;
   - multi-page journeys in `src/ui/flows/`;
   - fixtures in `src/ui/fixtures/fixtures.ts`, and precondition fixtures (a test that starts somewhere specific) in `src/fixtures/`;
   - data a test needs (a product in stock, a throwaway customer) created and removed **through the API**, not through the UI.
2. After a change to something shared, runs **every spec that uses it**, not only the new ones.
3. **Writes the specs** step for step (the `ui-test-from-scenario` skill).
4. **Checks** with `npm run typecheck` and `npm run validate:scenarios`.
5. **Runs** each spec, and when it passes, **three more times** (`--repeat-each=3`) to catch flaky tests.
6. **Fixes its own mistakes**, at most 3 rounds per spec, from the error, the failed step and the trace or screenshot. A flaky test gets its cause fixed (a wait that races the app, shared data), never retries, sleeps or longer timeouts.
7. **Finishes:** sets `status: automated` and `automatedIn` on each scenario.

Claude then runs the typecheck, the validator and the new specs once more itself.

The engineer never edits a scenario's steps, never touches the app, and **never weakens a check to make a test pass**.

### What a generated spec looks like

```ts
// Scenarios: test-scenarios/ui/products/product-search.yml
test.describe('@products - Product search', () => {
  test('UI-001: Search by name shows only matching products', async ({ homePage }) => {
    await test.step('Open the home page.', async () => {
      await homePage.open();
    });

    await test.step('Search for "pliers".', async () => {
      await homePage.search('pliers');
    });

    await test.step('Verify the caption reads "Searched for: pliers".', async () => {
      await expect(homePage.searchCaption, 'The caption names the search term').toHaveText('Searched for: pliers');
    });
  });
});
```

- One `test.step` per scenario step, titled with the step text, so the report and the trace read like the scenario.
- Pages, flows and API services come from fixtures; the spec has **no selectors** and never calls `page.goto`.
- Every assertion has a message saying what is checked.
- `homePage.search()` waits inside the page object for the app's `search_completed` marker, so the check can't race the results.
- The test starts logged in as its role (`role` in the scenario → `test.use({ role })`); a `guest` scenario starts logged out (`test.use({ authMode: 'none' })`).

## 5. Read the report

Claude reports:

- the files changed, grouped (specs, page objects and components, flows, fixtures, test data, scenarios);
- a table: scenario → spec → result (passed, passed on repeat, known issue, failing on app behaviour, not implemented and why);
- the live writes the tests make and their cleanup;
- assumptions to confirm.

### When the app disagrees with the scenario

If the page behaves differently from what the scenario says, the agent **leaves the test failing** and Claude shows the step, the expected and the actual result, and the agent's proposal. You choose:

| Choice | When | Result |
|---|---|---|
| **Add a `knownIssue`** | The app has a bug | The scenario gets `knownIssue: <text>` and `bug: <ID>` (an open bug in `bugs/`, or a new one), the test starts with `test.fail(true, 'Known issue BUG-001: ...')` and passes as an expected failure. The dashboard lists it under Known Issues |
| **Fix the scenario** | The scenario expected something the story never promised | You (or Claude, if you ask) correct the YAML, and the test is run again |
| **Leave it failing** | You want to investigate first | Nothing changes |

## 6. Review, commit, CI

1. **Review the tests:** `/review-tests` (by default the work not pushed yet; or a spec such as `product-detail.spec.ts`, a scenario file, IDs). The read-only `test-reviewer` agent looks for what the typecheck can't catch: a test that doesn't check what its scenario says, waits that race the app, selectors outside page objects, live data written without approval or cleanup. You pick the findings; Claude applies them and re-runs the specs.
2. **Read the diff** yourself, then **commit** on `develop` (or a feature branch) and open a pull request into `main`. `verify` runs the specs your change affects. A new area folder also needs an entry in the custom UI workflow's `area` options.
3. **If CI fails:** `/heal-tests PR <number>` or `/heal-tests <run id>`. The `test-healer` agent diagnoses each failure first, using the trace, the page inspector and re-runs of read-only tests, and changes nothing until you pick the fixes. On this public demo site, **data drift** is common: another visitor changed a seeded product. The fix is a test that creates its own data.

## A full example

```text
/write-ui-scenarios Product_Detail.md AC3 AC4 AC5   → proposal → approve → test-scenarios/ui/products/product-quantity.yml
/implement-ui-scenarios product-quantity.yml        → pages inspected, plan + writes → approve → page objects, spec, all passing
/review-tests product-quantity.spec.ts              → findings → pick → fixes applied
(commit, pull request, CI)
/heal-tests PR <n>                                  → only if CI fails
```

## Doing it by hand

1. Look at the page: `npm run inspect:ui -- <path> [--role admin | --logged-out] [--then <step> ...]`. The output is also saved in `test-results/inspect/`.
2. Add what's missing: page object methods and getters, components, flows, fixtures (see [Project Structure](Project-Structure#where-new-code-goes)).
3. Write `tests/ui/<area>/<scenario file name>.spec.ts`: a `// Scenarios: <yml path>` comment at the top, `test.describe('<tags> - <suite>')`, one `test('<ID>: <name>')` per scenario, one `test.step` per step, a message on every assertion.
4. Set `status: automated` and `automatedIn: <spec path>` on the scenario.
5. Run `npm run typecheck`, `npm run validate:scenarios`, the spec, and the spec with `--repeat-each=3`.

The exemplars to copy are `tests/ui/products/product-search.spec.ts` (spec), `src/ui/pages/HomePage.ts` (page) and `src/ui/flows/ShoppingFlow.ts` (flow); the full rules are in [CLAUDE.md](https://github.com/Zaytsman/SimpRight/blob/main/CLAUDE.md#ui-layer).

See also: [API Automation](API-Automation).
