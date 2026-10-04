---
name: ui-scaffolding
description: How to add the UI test plumbing a scenario needs (page objects, components, dialogs, flows, fixture registrations, precondition fixtures and test data) in the style of the project's exemplars, adding only what's missing. Preloaded into the ui-test-engineer agent.
user-invocable: false
---

# UI scaffolding

Add only what the approved plan lists as new, and copy the style of the exemplar files in the profile's `ui.exemplars`: their naming, comments, imports and structure. Running this twice must change nothing the second time: look before adding, and reuse what exists.

## Page objects (exemplars: `ui.exemplars.page`, `ui.exemplars.basePage`)

- One class per page, extending the base page, in the pages folder (`paths.pages`). A public `open()` navigates through the base page's protected `goto('<path>')` and waits until the page is loaded (`waitForLoaded()`); a page reached only by navigating from another page may have just `waitForLoaded()`.
- **Locators are `private readonly` fields** assigned in the constructor and named with the element kind: `searchInput`, `sortSelect`, `addToCartButton`, `searchCaptionText`, `cartQuantityBadge`, `errorAlert`. Base classes use `protected` for what subclasses need.
- **A test reaches a locator only through a getter**, added when a test asserts on it, named as the plain noun: `get searchCaption(): Locator { return this.searchCaptionText; }`.
- **Dynamic locators** are methods with parameters: `card(name)`, `categoryCheckbox(label)`.
- **Methods:** verbs for actions (`search`, `sortBy`, `addToCart`, `openCart`), async readers for values a test checks (`getProductNames()`, `getPrices()`, `getTotal()`) that return plain values (trimmed text, numbers without currency signs).
- **Locator priority:** `getByTestId` (the project's test id attribute) → `getByRole` with a name, `getByLabel`, `getByText` → CSS; never XPath. Ids that end in a record id (`product-01J...`) change when the site re-seeds: match them by prefix (`a[data-test^="product-"]`) or find the element by its visible label.
- **No assertions in page objects.** Waiting for the app's own signal inside an action is fine and required (next section).

## Waits: every action waits for the app to finish it

An action returns only when the page shows its result, so the next step never reads a half-updated page. In order of preference:
1. **The app's own marker or message:** an element the app renders when done (`search_completed`), a toast ("Product added to shopping cart"). Wait with `expect(marker).toBeVisible()` / `toBeAttached()` inside the action.
2. **The request the action triggers:** start waiting before the action, then act, then await it: `const done = this.page.waitForResponse((r) => r.url().includes('/products') && r.request().method() === 'GET'); await this.sortSelect.selectOption({ label }); await done;`. Then wait for the re-render if the app shows a loading state.
3. **A visible change:** the next page's heading, a URL (`waitForURL`), an element that appears or disappears.

Never a fixed sleep (`waitForTimeout`), and never `networkidle` in page objects: the app may poll, and idle is not "done".

## Components and dialogs (exemplars: `ui.exemplars.component`, `ui.exemplars.dialog`)

- A reusable part of several pages (a grid, a filter sidebar, the nav bar) is a component class in the components folder, taking the `page` (or a root locator) in its constructor, with the same locator rules. A page exposes it as a public `readonly` field (`homePage.productGrid`).
- A modal is a dialog class extending the base dialog, with its locators under `root` and actions (`confirm`, `cancel`, or the dialog's own).
- A component or dialog only one page uses still gets its own class when it has more than a couple of locators; otherwise its locators live in the page.

## Flows (exemplar: `ui.exemplars.flow`)

- A multi-page journey several tests share (search → open product → add to cart) is a flow class in `paths.flows`, built from page objects. Each method is one user-level task that a scenario step could name (`openProduct(name)`), so a step can use it when it does exactly what the step says.
- No flow for a journey only one test makes: the spec calls the pages step by step.

## Fixtures (exemplars: `ui.exemplars.fixtures`, `ui.exemplars.preconditionFixture`, `ui.exemplars.fixturesIndex`)

- Register every new page object, component exposed on its own, dialog and flow in the UI fixtures file, built the way the existing ones are, in the section comment that fits (pages, flows, components).
- A precondition fixture (`open<Page>Test`) starts tests on a prepared page; it goes in its own file in the fixtures folder, extends `test` (or another precondition fixture), returns the objects the tests need, has no `test.step` inside, and is exported from the fixtures index. Add one only when several tests share setup that their scenarios don't list as a step.

## Test data (exemplar: `ui.exemplars.constants`)

- A seeded value that more than one test relies on (a product name, a category) goes in the constants module, in its area group, with a comment saying what makes it useful ("seeded with stock 0"). A value one test uses stays a variable in that test.
- Data a test needs that the app doesn't have at a fixed place (a customer, a product in the cart, a favourite) is created through the project's API fixtures and step helpers (for example `registerThrowawayCustomer`), which register their own cleanup; never through the UI unless creating it is what the scenario tests.

## Keep it small

- No abstraction for a single call site, and no method a scenario doesn't need yet.
- Additive changes only to shared files: no renamed or removed members, no changed signatures or behaviour.
- A new test folder or scenario area may need entries elsewhere: follow the conventions files (the custom UI workflow's `area` options, the profile's `ids.areas`), and list what you changed.
