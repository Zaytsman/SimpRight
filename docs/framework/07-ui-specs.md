# 7. UI specs

A UI spec turns a scenario file into browser tests. Its tests start from a prepared state (a precondition fixture or setup code made through the API), then make the scenario's steps through page objects and check what a user sees with web-first assertions.

The exemplar the agents copy is [`tests/ui/products/product-search.spec.ts`](../../tests/ui/products/product-search.spec.ts).

## Anatomy of a test

```ts
// Every scenario here has the precondition "The home page is open.": the fixture opens it before the steps.
import { openHomePageTest as test, expect } from '@fixtures';
import { TestConstants } from '@data/TestConstants';

/** The checks of a "Verify every product name contains "<term>" (case-insensitive)." step: the grid's page 1. */
async function expectEveryNameContains(homePage: HomePage, term: string): Promise<void> {
  for (const name of await homePage.productGrid.getProductNames()) {
    expect(name.toLowerCase(), `Product "${name}" should contain "${term}"`).toContain(term);
  }
}

// Scenarios: test-scenarios/ui/products/product-search.yml
test.describe('@products - Product search', () => {
  test('UI-001: Search by name shows only matching products', { tag: '@smoke' }, async ({ homePage }) => {
    const term = TestConstants.products.searchTerm;

    await test.step('Search for "pliers".', async () => {
      await homePage.search(term);                       // waits for the search_completed marker itself
    });

    await test.step('Verify the caption reads "Searched for: pliers".', async () => {
      await expect(homePage.searchCaption, 'The caption names the search term').toHaveText(`Searched for: ${term}`);
    });

    await test.step('Verify at least one product is shown.', async () => {
      await expect(homePage.productGrid.cards.first(), 'At least one product card is shown').toBeVisible();
    });

    await test.step('Verify every product name contains "pliers" (case-insensitive).', async () => {
      await expectEveryNameContains(homePage, term);
    });
  });
});
```

## Where a test starts

A scenario's `preconditions` are **statements** about the starting state ("The home page is open.", "A product that is in stock is in the cart."). They're set up before the first step, **never in a `test.step`**:

| Situation | How |
|---|---|
| Several tests share the precondition | A precondition fixture, imported **as `test`**: `import { openHomePageTest as test } from '@fixtures'`. The 8 fixtures are listed in [3. Fixtures](03-fixtures.md#precondition-fixtures-srcuifixturespreconditions). |
| Tests in one file have different preconditions | Wrap those that share a fixture in an anonymous `test.describe(() => { const test = openHomePageWithProductInCartTest; ... })` |
| Only one test has it | Setup code at the top of the test with a `// Precondition: <text>` comment |

Setup code uses the **UI setup helpers**, which prepare data through the API and register its cleanup:

```ts
// Precondition: The customer's location is Amsterdam, and a product with a location offer is added to the cart.
const { product } = await putProductInCart(page, productsService, cartsService, cleanup, TestConstants.products.locationOfferProduct, 1, {
  location: AMSTERDAM,
});

await test.step('Open the checkout page.', async () => {
  await cartPage.open();
});
```

| Helper ([`src/ui/fixtures/`](../../src/ui/fixtures/)) | Prepares |
|---|---|
| `putProductsInCart(page, productsService, cartsService, cleanup, items, { location? })` | A cart made through the API with the named seeded products (in order, with quantities or rental hours), given to the browser with `setVisitorCart`; removed after the test |
| `putProductInCart(...)` | The same for one product (the seeded in-stock product by default) |
| `findProductByName(productsService, name)` | The seeded product with exactly that name |
| `createProductInStock(...)` | A product of the test's own, in stock, removed after the test (for a test that must not depend on other visitors) |
| `catalogueProductNames(...)` | The names the API lists for a category and brand in the page's default price range, for the filter checks to compare the grid with |
| `registerCustomerForTest(services, cleanup)` | A customer registered for this test only, logged in through the API; returns its body, id and token |
| `removeCartAfterTest(page, cartsService, cleanup)` | Registers the removal of a cart the app made itself after a UI "Add to cart" |
| `assertNoEcoRating(products)` | Fails setup when a product has an eco rating that would add an unexpected discount |

**Setup errors start with `Setup:`** (`Setup: no product named exactly "..."`, `Setup: "..." was not put in the cart`), so the report tells a broken setup from a failed check. Data a test needs is never created by clicking through the UI, unless creating it is what the scenario tests.

## Steps and checks

- **Action steps** call one page object, component or flow action per user action in the step. Page objects wait for the app's signal themselves; specs never sleep or wait for `networkidle`. An action step may read a value a later check needs (`unitPrice = await productPage.getUnitPrice()`).
- **Verify steps** only read the page. Every assertion has a **plain-text message** saying what is checked (`'The caption names the search term'`); UI specs don't use `assertMessage`.
- **Web-first assertions** on locators (`toHaveText`, `toBeVisible`, `toHaveCount`, `toBeChecked`) retry until the page settles. A value read once (`getProductNames()`) is only for checks a locator assertion can't express (an order, a sum, "every name contains"), and only after the action has waited for its signal.
- **"Shown" means visible:** `toHaveText` and `toHaveCount` pass on hidden elements, so a step about what the user sees needs `toBeVisible` too.
- **Every item and order checks** first check that the list isn't empty. Order checks compare the list with a sorted copy, using the comparison the step implies (names case-insensitively, prices as numbers), and put the list in the message.
- **Approved readings:** when the user approved how to read a step ("the first page of all products" = the same names in the same order), a comment above the check records it.
- **Repeated checks** that several tests of a spec make go in a function in that spec (`expectEveryNameContains`, `expectGridUnchanged`), not copied.
- **No selectors** in specs: a check goes through a page object getter.

## Roles and logins

| Scenario `role` | Spec |
|---|---|
| absent (the run's customer) | nothing to set: the browser starts logged in |
| `admin` | `test.use({ role: 'admin' })` |
| `guest` (logged out) | `test.use({ authMode: 'none' })` |
| a customer of the test's own | `openProductPageWithNewCustomerTest`, or `registerCustomerForTest` in setup |

## Known issues and tags

The same as API specs ([5](05-api-specs.md#known-issues-roles-and-tags)): `test.fail(true, 'Known issue BUG-0xx: <text>')` right before the first `test.step`, after setup; `{ tag: '@smoke' }` for smoke scenarios.

## Things that bite

- **The re-seed** changes record ids every hour: find products by visible name, never by id.
- **Other visitors** can change seeded products (stock, price, category). Tests that depend on exact values use their own product (`createProductInStock`) or check what the API says first.
- **Re-renders:** a list that re-renders after an action can be read half-updated; the action must wait for its signal first.
- **The checkout** is always opened with `cartPage.open()`, never by loading `/checkout` ([6](06-ui-layer.md#the-checkout-and-cloudflare)).
- **Locations and discounts:** a cart with city coordinates gives every product the city's discount (BUG-024), and eco ratings A/B add a discount of their own, so cart setups guard against both.

## Changed in the review

- `createProductInStock` was a `test.step` (a step that no scenario has) for UI-002's precondition. It's now setup code that fails with a `Setup:` error, and `findProductByName` replaced two copies of the same lookup.
- UI-002 opens the cart with `cartPage.open()` instead of the removed `ShoppingFlow.goToCart`.
- Repeated checks became spec-local functions: `expectEveryNameContains` (×3) and `expectGridUnchanged` (×2) in product-search, `expectGridMatchesCatalogue` (×3) in product-filters, `expectBillingAddressStep` (×2) in checkout-sign-in.
- `registerCustomerForTest` is shared by `newCustomerFixtures` and UI-060; `putProductInCart` takes a location (UI-055).
- UI-028 no longer removes favourites of a customer that was just created and has none.
- After the changes the whole UI project passed (60/60), the cart specs passed three times in a row (51/51), and every step title matched its scenario.

Details: [13. Code review, October 2026](13-code-review-2026-10.md).
