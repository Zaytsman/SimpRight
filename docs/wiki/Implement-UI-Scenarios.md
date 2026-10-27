<!-- Source: docs/wiki/Implement-UI-Scenarios.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# /implement-ui-scenarios

Automates **UI scenarios** as Playwright browser specs. It inspects the live pages, plans the page objects, flows, fixtures and tests, then waits for your approval, including every test that changes live data. Then it writes the code, runs the specs, repeats them to catch flaky tests, and marks the scenarios `automated`.

| | |
|---|---|
| **Command** | `/implement-ui-scenarios <scenario IDs \| scenario file \| area>` |
| **Agent** | [`ui-test-engineer`](https://github.com/Zaytsman/SimpRight/blob/main/.claude/agents/ui-test-engineer.md) |
| **Skill files** | [`implement-ui-scenarios`](https://github.com/Zaytsman/SimpRight/blob/main/.claude/skills/implement-ui-scenarios/SKILL.md) (the command); [`ui-scaffolding`](https://github.com/Zaytsman/SimpRight/blob/main/.claude/skills/ui-scaffolding/SKILL.md) and [`ui-test-from-scenario`](https://github.com/Zaytsman/SimpRight/blob/main/.claude/skills/ui-test-from-scenario/SKILL.md), preloaded into the agent (not commands) |
| **Input** | Scenarios with `status: manual` in `test-scenarios/ui/` |
| **Output** | Specs in `tests/ui/<area>/`; page objects, components, dialogs, flows, fixtures, constants as needed; scenarios marked `automated` |
| **Live app** | Read-only page inspector while planning; runs the specs in Chromium; tests that write data only with your approval |
| **Checkpoint** | A plan you approve, with the list of writes and of changes to shared code, before any code is written |

## When to use it

- New UI scenarios have been written and approved.
- A story's scenarios are ready (`/implement-ui-scenarios product-quantity.yml`).

## How to use it

```text
/implement-ui-scenarios product-sorting.yml
/implement-ui-scenarios UI-018 UI-019
/implement-ui-scenarios UI-008..011
/implement-ui-scenarios products
```

Only `manual` scenarios are in scope. More than about 10 scenarios or 2 files makes the plan hard to review, so Claude suggests one file at a time.

## What happens

### Phase 1: the plan (nothing is written)

The agent reads the profile, the conventions, the scenarios, the existing page objects, flows and fixtures, and the exemplars. Then it **inspects every page the steps touch** (`npm run inspect:ui`), as the scenario's role, reaching the states the steps describe (a sort order, a ticked filter, an open menu). It notes each element's `data-test` id or role and name, and **how the app signals an action is done**: a marker, a toast, a URL, a reloaded list.

Per scenario file, the plan shows the spec, a table of scenarios (role, writes, known issue), and:

- **Needs:** pages, components, dialogs, flows, methods, getters, fixtures, constants, each `exists`, `new` or **`changed (needs approval)`** (a behaviour change to something other tests use, with the reason and the tests affected);
- **Locators:** how each new element is found;
- **Waits:** the signal each new action waits for;
- **Test data** and **Cleanup**.

Then **Writes needing approval** (cart, registration, favourites, orders), **Can't automate as written** and **Decisions needed**. Claude asks once for all of it.

### Phase 2: implementation

1. **Scaffold** what the plan lists as new or approved as changed (`ui-scaffolding`). After a change to a shared member, run **every** spec that uses it.
2. **Write the specs** (`ui-test-from-scenario`).
3. **Check:** `npm run typecheck`, `npm run validate:scenarios`.
4. **Run** each spec, then `--repeat-each=3` (with `DISABLE_API_COVERAGE=true`).
5. **Fix loop**, at most 3 rounds per spec, from the error, the failed step and the screenshot: a test-code mistake is fixed; a flaky test gets its cause fixed (a wait that races the app, shared data); a disagreement with the app stops work on that test.
6. **Finish:** `status: automated` + `automatedIn` on each scenario.

Claude runs the typecheck, the validator and the new specs once more itself, then reports: files by group, scenario → result, live writes and their cleanup, assumptions to confirm. A failing test on app behaviour comes with its step, expected, actual and a proposal (`knownIssue`, scenario fix, or leave it failing), and you choose. To record the bug, use [/report-bug](Report-Bug).

## The preloaded skills

They describe how to write code in this project's style; the agent follows them, you never call them.

### `ui-scaffolding`

| Part | Rules |
|---|---|
| **Page objects** | One class per page extending `AppPage`; `open()` through `goto()` plus `waitForLoaded()`. Locators are `private readonly` fields named with the element kind (`sortSelect`, `searchCaptionText`); a test reaches one only through a noun getter (`get searchCaption()`); dynamic locators are methods (`card(name)`); verbs for actions, async readers for values (`getPrices()`). No assertions |
| **Locator priority** | `getByTestId` → `getByRole` / `getByLabel` / `getByText` → CSS; never XPath. Ids ending in a record id change on re-seed: match by prefix or by label |
| **Waits** | Every action returns only when the page shows its result, in order of preference: the app's own marker or toast; the request the action triggers (`waitForApiResponse` started before the action); a visible change. Never `waitForTimeout` or `networkidle` |
| **Components, dialogs** | Parts several pages share are component classes exposed as page fields (`homePage.productGrid`); they extend `BaseComponent` and look up their locators inside their container (`root`). Modals extend `BaseDialog` |
| **Flows** | Multi-page journeys several tests share; each method one user-level task (`openProduct(name)`) |
| **Fixtures** | Everything new registered in `src/ui/fixtures/fixtures.ts`; precondition fixtures (`open<Page><State>Test`, such as `openHomePageInLondonTest`) for the scenarios' shared `preconditions`, which run before the first step |
| **Test data** | Shared seeded values in `TestConstants`; data the app lacks (a customer, a cart item) created through API fixtures, never through the UI |

### `ui-test-from-scenario`

| Part | Rules |
|---|---|
| **File and tests** | Same name as the scenario file; `// Scenarios:` comment; `test.describe('<tags> - <suite>')`; `test('<ID>: <name>')`; `role` via `test.use`, `guest` via `test.use({ authMode: 'none' })`; known issue right before the first step, after any setup |
| **Steps** | One `test.step` per scenario step, verbatim; page objects, flows and API fixtures from fixtures; no selectors or `page.goto` in specs |
| **Checks** | A plain-text message on every assertion; web-first assertions on locators first (they retry until the page settles); order checks against a sorted copy, after checking the list isn't empty; approved readings recorded as a comment; exactly what the step says |
| **Things that bite** | Hourly re-seed (never use ids, find records by name); re-rendered lists read half-updated; hidden duplicate elements in responsive layouts; no fixed sleeps |

## What the agent never does

- **Change what a scenario checks:** never a weakened check.
- **Guess the page:** locators and data come from the inspector, existing page objects or constants.
- **Rely on the inspector's waits:** the inspector waits for pages to settle, so page objects get their own waits.
- **Write to the live app unasked**, touch more than test-side code, make non-additive changes to shared code without approval, or touch secrets.

## Tips

- If the plan has `changed (needs approval)` items, read them carefully: they affect existing tests.
- A new area folder also needs an option in the custom UI workflow; the engineer adds it with the first spec.
- Next: [/review-tests](Review-Tests), then commit.

See also: [UI Automation](UI-Automation), [/write-ui-scenarios-from-steps](Write-UI-Scenarios-From-Steps).
