# 3. Fixtures

Fixtures are how a spec gets everything it uses: pages, flows, API clients and services, the test user, the cleanup list, and its starting state. Specs never construct these objects, so the wiring (which token, which role, which config) lives in one place.

## The tree

```
@playwright/test  test
        │ .extend
        ▼
src/fixtures/base.ts            role (option), config*, tokenService*, apiCoverage* (auto), user, cleanup
        │                                                  * worker-scoped
        ├── .extend ─► src/api/fixtures/fixtures.ts   63 API fixtures: clients and services per area and token
        └── .extend ─► src/ui/fixtures/fixtures.ts    authMode (option), storageState, pages, flows
                         │
src/fixtures/fixtures.ts │  mergeTests(apiTest, uiTest)  ──►  the one `test`
        │
        ├── .extend ─► src/ui/fixtures/preconditions/open<Page><State>Test.ts   (8 precondition fixtures)
        ▼
src/fixtures/index.ts   = `@fixtures`: test, expect, the precondition fixtures, UI setup helpers, API step helpers
```

Fixtures are **lazy**: a test that never names `accessToken` never logs in through the API, and an API test never starts a browser. Specs import only from `@fixtures`.

## Shared fixtures (`src/fixtures/base.ts`)

| Fixture | Scope | Responsibility |
|---|---|---|
| `role` | option | The test user: `'default'` (the run's customer) or `'admin'`. Set with `test.use({ role: 'admin' })`. |
| `config` | worker | The frozen `env` ([2](02-configuration.md)) |
| `tokenService` | worker | Logs each role in once per worker and refreshes the token 2 minutes before it expires. Worker-scoped, with its own request context, because the built-in `request` is test-scoped. |
| `apiCoverage` | worker, auto | Records every API call through `BaseClient.onApiCall` when the optional coverage package is installed; does nothing otherwise |
| `user` | test | The test user's credentials, `getUser(role)` |
| `cleanup` | test | Undo steps for records the test creates (below) |

### `cleanup`

```ts
const product = await adminProductsService.create(body);
cleanup.add(() => adminProductsService.delete(product.id));
```

After the test, pass or fail, the steps run **newest first**, so records that depend on others go first (a cart item blocks deleting its product with 409, so the cart is registered after the product and removed before it). A failing undo step only logs a warning, so cleanup never hides the test's own result. It's test-scoped on purpose: clients and services are built on the test-scoped `request`, so `afterAll` couldn't use them.

## API fixtures (`src/api/fixtures/fixtures.ts`)

Every API area gets the variants its scenarios need, named after the scenarios' wording:

| Variant | Token | Typical use |
|---|---|---|
| `xClient`, `xService` | none | Public endpoints, the "without a token" 401 checks |
| `xClientWithToken`, `xServiceWithToken` | the test's `role` | "with the default user's token"; `test.use({ role: 'admin' })` for admin checks |
| `xClientWithInvalidToken` | a fixed malformed token (`invalid-token`) | The "invalid token" 401 checks |
| `xClientForToken(token)`, `xServiceForToken(token)` | a token the test got itself | A throwaway customer's own calls |
| `adminXService` | always admin | Setup creates and cleanup deletes (DELETE is admin-only) |

Plus `accessToken` (the role's token as a string), `authClient` and `authService`. Not every area has every variant: only those its scenarios use.

**Role tokens are read per request.** A role or admin fixture gets `roleToken(tokenService, role)`, a function that `BaseClient` calls when it sends each request. `TokenService` caches the token and refreshes it before expiry, so a test that runs longer than a token's 5 minutes (the PDF polls) never sends an expired one. A token the test obtained itself is passed as a plain string.

**Why an explicit matrix and not one factory fixture:** the names match the scenarios' token wording and show in each test's parameter list (`async ({ productsClientWithInvalidToken }) => ...`), which agents and reviewers read directly. A factory (`api.client('products', { token: 'invalid' })`) would save about 300 lines but rewrite all 85 API specs. This was decided in the review.

## UI fixtures (`src/ui/fixtures/fixtures.ts`)

| Fixture | Responsibility |
|---|---|
| `authMode` (option) | `api`, `storageState` or `none` ([2](02-configuration.md#how-ui-tests-start-logged-in)) |
| `storageState` | Overrides Playwright's: the browser starts logged in as the test's role, or logged out with `none` |
| `homePage`, `productPage`, `cartPage`, `rentalsPage` | Page objects, built with `page` and `config` |
| `shoppingFlow` | The flow `ShoppingFlow` |

Components aren't fixtures: a page holds them as fields (`homePage.productGrid`, `homePage.filters`), so they're reached through the page.

## Precondition fixtures (`src/ui/fixtures/preconditions/`)

A scenario's `preconditions` ("The home page is open.") are set up **before** the first step and never inside a `test.step`. When several tests share one, a precondition fixture does it, and the spec imports it **as `test`**, so the validator still finds literal `test('<ID>: <name>'` calls:

```ts
import { openHomePageTest as test, expect } from '@fixtures';
```

Each one is named `open<Page><State>Test` after the page the test starts on and the state, if any:

| Fixture | Starts the test with |
|---|---|
| `openHomePageTest` | The home page open and loaded |
| `openHomePageInLondonTest` | The visitor in London (`setVisitorLocation`), the home page open |
| `openProductPageTest` | The product named by the option `productName` (`test.use({ productName })`) open |
| `openProductPageInLondonTest` | The same, for a visitor in London (location offers show their discount) |
| `openProductPageWithNewCustomerTest` | `openProductPageTest` logged in as a customer registered for this test |
| `openRentalsPageTest` | The rentals page open |
| `openHomePageWithProductInCartTest` | A cart with the in-stock product, made through the API, given to the browser, the home page open |
| `openHomePageWithRentalAndProductInCartTest` | A rental and a product in the cart (the 15% combined discount checked as setup) |

A **state** is a helper the fixtures call, not a fixture of its own: the visitor's location (`setVisitorLocation`), a cart (`setVisitorCart`, `putProductsInCart`), or a new customer (`newCustomerFixtures`). The new-customer state is applied with `.extend(newCustomerFixtures)`: it registers a customer through the API, logs the browser in as that customer, and after the test removes the customer's favourites, then the customer (a user with favourites can't be deleted: 409).

A precondition only one test has stays **setup code** at the top of that test, with a `// Precondition: <text>` comment.

## What `@fixtures` exports

[`src/fixtures/index.ts`](../../src/fixtures/index.ts):

- `test`, `expect`, `TestFixtures`;
- the 8 precondition fixtures;
- UI setup helpers: `putProductsInCart`, `putProductInCart`, `assertNoEcoRating`, `createProductInStock`, `findProductByName`, `catalogueProductNames`, `registerCustomerForTest`, `removeCartAfterTest`, `AMSTERDAM`;
- every API step-helper module with `export *` (`apiSteps.ts` and one `<area>Steps.ts` per area). A new helper needs no change to the index; a name that only its own module uses stays unexported, and two modules exporting the same name is a compile error.

## How to add

| To add | Do |
|---|---|
| A client or service | Register it in `src/api/fixtures/fixtures.ts` in the variants the scenarios need, built like the others; role tokens through `roleToken` |
| A page, flow or dialog | Register it in `src/ui/fixtures/fixtures.ts` in its section |
| A precondition shared by two or more tests | A new `open<Page><State>Test.ts` in `preconditions/`, extending the merged `test` (or another precondition fixture), no `test.step` inside, exported from `index.ts` |
| An API step helper | A function in the area's `src/api/fixtures/<area>Steps.ts`, or `apiSteps.ts` when several areas share it; nothing to change in `index.ts` |

## Changed in the review

- `index.ts` went from a hand-written list of about 150 re-exports to `export *` per step module; 29 names that only their own module used were unexported, and the duplicate `expect` re-exports from 10 fixture modules were removed.
- Role and admin fixtures take their token **per request** (`roleToken`), instead of once when the fixture was built. Before, a test over 5 minutes could send an expired admin token in its cleanup.
- `usersClient` used to mean "with a token" and `usersClientWithoutToken` "without", the opposite of every other area: renamed in 168 places.
- One doc block describes the variants, instead of the same comment repeated on every fixture.
- The visitor-state helpers moved from `src/ui/auth/` to `src/ui/visitor/`, and `newCustomerFixtures` to `src/ui/fixtures/`.
- The unused `loginPage` fixture was removed.

Details: [13. Code review, October 2026](13-code-review-2026-10.md).
