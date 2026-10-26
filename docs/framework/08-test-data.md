# 8. Test data

The app under test is a **shared, public demo site**. Its data re-seeds every hour at :00 UTC (every id changes), other visitors change records at any time (product writes need no token), and every run of every machine uses the same database. The test-data rules exist so tests stay correct and independent under those conditions.

## Where data comes from

| Kind | Source | Example |
|---|---|---|
| Seeded values several tests rely on | [`src/data/TestConstants.ts`](../../src/data/TestConstants.ts), grouped by area | `TestConstants.products.inStockProduct` = "Combination Pliers" |
| A seeded value only one test uses | A variable in that test | |
| Records a test creates | A factory in [`src/data/factories/`](../../src/data/factories/), with a unique name | `ProductFactory.createProduct(refs)`, `BrandFactory.name()` |
| Ids of seeded records | Looked up by a test step at run time (a list, a search by name) | `takeProductRefs`, `findProductByName` |
| Users | Roles from config, the run's customer, or a throwaway customer per test | below |

Never hard-code an id: the re-seed changes them all. The one constant id is `UNKNOWN_ID`, a well-formed ULID (dated around 2039) that no record of any area has, for the 404 and unknown-reference checks.

## `TestConstants`

```ts
export const TestConstants = {
  products: {
    /** Matches several seeded products by name (case-insensitive). */
    searchTerm: 'pliers',
    /** A seeded product in stock ($14.15, category Pliers, brand ForgeFlex Tools); several UI tests open it. */
    inStockProduct: 'Combination Pliers',
    ...
  },
  ...
};
```

Each value has a comment saying what makes it useful ("seeded with stock 0", "a location offer"). Roles aren't repeated here: they're in `src/config/roles.ts`.

## Factories

One `<Area>Factory.ts` per area that creates data, added with the first scenario that needs it:

| Factory | Builds |
|---|---|
| `ProductFactory` | Create and update payloads from the seeded refs the test passes in (`createProduct(refs, overrides)`, `createProductInStock`, `updateRefs`), invalid payloads (`nameTooLong`, `descriptionTooLong`), and `isTestProduct(name)` to recognise test-made products in lists |
| `BrandFactory`, `CategoryFactory` | Name and slug payloads, through the shared `nameAndSlugPayloads(area)` |
| `UserFactory` | `registerCustomer()` (unique email, random strong password), profile updates, emails and passwords of given lengths and character classes, TOTP secrets |
| `FavoriteFactory`, `InvoiceFactory`, `MessageFactory`, `PaymentFactory`, `ProductSpecFactory` | Their areas' payloads |

Rules:

- Factories never call the API and never hard-code ids: ids are looked up by a test step and passed in.
- Every created record gets a name from `uniqueName(prefix)` ([`testDataUtils.ts`](../../src/data/factories/testDataUtils.ts)): `<prefix>-<yyyymmdd>-<6 hex>`, such as `Lifecycle-20261001-3fa9c2`. Parallel tests and other runs never collide, and a stray record shows when it was made.
- Invalid payloads are plain objects: they break the request types on purpose.

## Users

| User | What it is | Use for |
|---|---|---|
| `admin` | The configured admin (`.env` / GitHub Secrets) | Admin endpoints, setup and cleanup (`adminXService`) |
| `default` | **The run's customer**: registered for this run by the project's `beforeRun`, deleted after it ([2](02-configuration.md#the-runs-customer-the-default-role)) | Read-only customer checks |
| A throwaway customer | Registered by the test itself: `registerThrowawayCustomer` (API), `registerCustomerForTest` or `openProductPageWithNewCustomerTest` (UI) | Anything that changes a user's own data (profile, password, favourites, invoices, TOTP, a lockout) |
| `guest` | No login (`authMode: 'none'`) | Logged-out scenarios |

**Never send a wrong password for a shared account.** The app locks an account after failed logins (423), so a lockout test registers its own customer.

## Cleanup

Records a test creates are removed with the `cleanup` fixture ([3](03-fixtures.md#cleanup)), registered **right after** the create succeeds, in the same step:

```ts
const brand = await createBrand(adminBrandsService, cleanup);   // registers its own removal
```

- When the creating call is the one under test, cleanup is registered only when the response shows a record was created: `removeIfCreated(response, cleanup, remove)`. That also covers known issues that create a record anyway.
- Undo steps run newest first, so dependent records go first: a cart item blocks deleting its product (409), and a customer with favourites can't be deleted (409).
- Deletes in cleanup use `deleteIfExists` where the test may have deleted the record itself (a 404 counts as done).
- Some records can't be deleted through the API: invoices (no `DELETE /invoices`), messages, and customers that hold an invoice. Tests that make them are kept out of the smoke set, and the re-seed removes them within the hour.

## Shared-data safety

- **Parallel tests** (`fullyParallel`, 2 workers on CI) never share mutable data: each test makes its own records, carts and customers.
- **Totals over shared data** (counts, sums of all products) can change between two reads. Tests compare before and after, or check shapes, not exact totals.
- **Caches survive writes and the re-seed:** `GET /products` for 5 minutes, reports for 5 minutes, product-spec names for 300 s. A test never reads a record before changing it in the same test, and reads back only records it created.
- **Seeded records can change** under the test (another visitor set a product out of stock). Tests that depend on exact values use a record of their own (`createProductInStock`).
- **Runs avoid :55–:03 UTC**, when the re-seed deletes users and ids change. CI waits automatically ([2](02-configuration.md)).

## Changed in the review

- Nine copies of the unknown-id ULID in `TestConstants` became one `UNKNOWN_ID`.
- `BrandFactory` and `CategoryFactory` shared 12 identical methods; now both use `nameAndSlugPayloads`.
- Product creation with cleanup existed in 4 versions; now there's one `createProduct`, with `removeIfCreated` for the creating call under test.
- `takeFirstProduct` and `takeFirstProductId` did the same thing; one is left.
- The UI-only setup helpers (`createProductInStock`, `catalogueProductNames`) moved from the API's `productSteps.ts` to `src/ui/fixtures/productSetup.ts`.
- `ProductFactory.isTestProduct` replaced the test-product name check copied in two specs.

Details: [13. Code review, October 2026](13-code-review-2026-10.md).
