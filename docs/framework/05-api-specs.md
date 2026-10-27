# 5. API specs

An API spec turns a scenario file into tests, step by step. Most of a step's code is shared: the send and its attachments (`sendAndAttach`), the checks (`src/utils/apiChecks.ts`), and the setup of the area (`src/api/fixtures/<area>Steps.ts`). So a spec reads like its scenario, and the same check fails with the same message everywhere.

The exemplar the agents copy is [`tests/api/products/get-products-search.spec.ts`](../../tests/api/products/get-products-search.spec.ts).

## Anatomy of a test

```ts
// Scenarios: test-scenarios/api/users/get-users-me.yml
test.describe('@users-api - Users API', () => {
  test("API-0063: Current user endpoint returns the logged-in user's profile", { tag: '@smoke' }, async ({ usersClientWithToken, user }) => {
    const request = { method: 'GET', path: '/users/me' };
    let response: ApiResponse;

    await test.step("Send GET /users/me with the default user's token.", async () => {
      ({ response } = await sendAndAttach('Current User', request, () => usersClientWithToken.me()));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify email equals the default user's email, and id, first_name and last_name are not empty.", async () => {
      const profile = parseJson<User>(request, response);
      // The email is a secret: compare it as a condition so a failure diff doesn't print it.
      expect(profile.email === user.username, assertMessage({ request, expected: "Email equals the default user's email", actual: profile.email })).toBe(true);
      for (const field of ['id', 'first_name', 'last_name'] as const) {
        expect(profile[field], assertMessage({ request, expected: `"${field}" is not empty`, actual: profile })).toBeTruthy();
      }
    });
  });
});
```

What the validator checks ([9](09-scenarios-and-bugs.md)): the `// Scenarios:` comment, the describe `'<tags> - <suite>'`, the title `'<ID>: <name>'` verbatim, and the tag option matching the scenario's `tags`. The step titles are the scenario's steps verbatim; `npm run check:step-titles` compares them after a run.

## The rules, in short

The full list is in [`conventions.md`](conventions.md) ("Spec style, both layers", "API spec style"):

- One `test.step` per scenario step, titled verbatim. Action steps act; `Verify` steps only check (they may read, never write).
- State shared between steps goes in `let` variables at the top of the test.
- **Happy paths and setup go through a service; a step that checks a status code goes through the client.**
- Every assertion passes `assertMessage({ request, expected, actual })`.
- Secrets are compared as a condition, `expect(a === b, message).toBe(true)`, because a matcher's diff isn't masked.
- A list check over "every item" starts with `expectSomeItems`, or it passes on an empty page.
- Records a test creates are removed with `cleanup.add(...)`, registered right after the create succeeds.

## Sending: `sendAndAttach` and request records

```ts
const request = { method: 'POST', path: '/brands', auth: AUTH.admin, body };
const { response } = await sendAndAttach('Create Brand', request, () => brandsClientWithToken.create(body));
```

`sendAndAttach(name, request, call, describe?)` ([`sendSteps.ts`](../../src/api/fixtures/sendSteps.ts), the core's; `apiSteps.ts` re-exports it) attaches the **request record** as "<name> Request", makes the call, attaches the response as "<name> Response", and returns both. The request record is a plain object describing what was sent; it's also the `request` in every assertion message, so a failure shows exactly what was sent.

| Helper | For |
|---|---|
| `AUTH` | The token's name in a record, in the scenarios' wording: `AUTH.none`, `AUTH.malformed`, `AUTH.admin`, `AUTH.defaultUser`, `AUTH.throwaway`, `AUTH.customer`, ...; the login, logout and refresh specs name their token by its state (`AUTH.newLogin`, `AUTH.loggedOut`, `AUTH.refreshed`). Never a string of a spec's own: send helpers and typed records take `auth` as `AuthLabel`, so another string fails the typecheck |
| `withHeaders` | A `describe` that attaches the response headers too, for steps that check a header |
| `describePage(item)`, `pageSummary(page, item)` | Attach a page that may list other visitors (users, invoices, messages) as a summary: pagination fields and a reduced view of each item. Reports are public. |
| `sendQueryAndAttach`, `JSON_QUERY_HEADERS` | The same for `QUERY` requests with explicit Content-Type and Accept |

## Checking: `src/utils/apiChecks.ts`

Each function holds the checks of one kind of scenario step, with the request in the failure message. The HTTP-level ones (`parseJson`, `expectStatus`, `expectStatusAndBody`, `expectSomeItems`, `expectMessage`, `expectLocation`, the Content-Type checks, `expectEmptyArray`) are the framework's core, in `src/utils/httpChecks.ts`; `apiChecks.ts` re-exports them next to the checks of the Toolshop's own formats, so specs import every check from `@utils/apiChecks`. A new check of the app's formats goes in `apiChecks.ts`.

| Function | Step it checks |
|---|---|
| `parseJson<T>(request, response)` | (not a step) The body as JSON. A body that isn't JSON (an HTML error page, Cloudflare's check) fails with the request, the status and the body's start, not a bare `SyntaxError`. Never `JSON.parse` in a spec. |
| `expectStatus(request, response, status, describeBody?)` | "Verify the response status is N." `describeBody` replaces the body in the message (a page summary, or nothing for a body that may list other visitors) |
| `expectStatusAndBody<T>` | The status, then the parsed body, when later steps read it |
| `expectSomeItems(request, items, what)` | The guard before an "every item" check |
| `expectMessage`, `expectSuccess`, `expectErrorText` | The body's `message`, `success`, `error` |
| `expectErrorKeys`, `expectErrorKeysPresent`, `expectNoOtherKeys` | Laravel's 422 `errors` keys (with messages, keys only, nothing else) |
| `expectFieldMessages`, `expectFieldMessageIncludes` | A field's messages, for 422 bodies without the `errors` wrapper |
| `expectLocation` | A redirect's `Location` |
| `expectContentType`, `expectContentTypeStartsWith`, `expectAcceptQuery` | Response headers |
| `expectEmptyArray`, `expectItemNamesContain` | Array bodies |

A check that only one endpoint has stays in its spec.

## Templates: tests that differ only in data

Families of scenarios with the same steps and different data (the 401/403 access checks every protected endpoint has, the 422 validation cases, the redirects) go through **one template function**, called from a literal `test()` per scenario:

```ts
test('API-0150: Delete brand with an invalid token returns 401', async ({ adminBrandsService, brandsClientWithInvalidToken, cleanup }) => {
  const brand = await createBrand(adminBrandsService, cleanup);   // setup: a brand of its own, removed after the test

  await checkStatusAndMessage(
    'Send DELETE /brands/{brandId} with that id, with an invalid token.',
    () => sendDeleteBrand(brandsClientWithInvalidToken, brand.id, AUTH.malformed),   // the spec's own send helper
    401,
    'Unauthorized'
  );
});
```

| Template (`apiSteps.ts`) | Steps it runs |
|---|---|
| `checkStatusAndMessage(sendStep, send, status, message)` | The send, "Verify the response status is N.", "Verify the body's message is "...".". About 90 access, 404 and 415 tests in 37 specs use it. |
| `checkRejectedBody(sendStep, send, field)` | The send, the 422, "Verify the body has a <field> key with at least one message." (`fieldMessagesStep`) |
| `checkValidationRedirect(sendStep, send, apiBaseUrl)` | The send, the 302, the Location (compared with the configured `apiBaseUrl`, so it holds in any environment) |

Area modules have their own templates (`checkInvalidProductChange`, `checkRejectedRegistration`, `checkUnknownRef`, ...) and specs may define a spec-local `check...` for a family only they have.

**Why not a loop over a table of cases?** The validator finds tests as literal `test('<ID>: <name>'` calls, so every scenario keeps its own `test()` line with its title, and only the body is shared. Setup the scenario has before the send (a record to update, the known-issue line) stays in the test, before the template call.

## Area step helpers (`src/api/fixtures/<area>Steps.ts`)

Setup steps and checks that several specs of an area share. A helper that is a step returns its result from `test.step` (`return test.step(title, async () => { ...; return product; })`), not through a `let`. Step titles that several scenarios share are constants (`PRODUCT_CREATE_STEP`, `BRAND_CREATE_ID_SLUG_STEP`).

| Module | Holds, for example |
|---|---|
| `apiSteps.ts` | `AUTH`, the QUERY sends, page summaries, the validation templates; it re-exports the core's `sendSteps.ts` (`sendAndAttach`, `checkStatusAndMessage`, `removeIfCreated`) |
| `productSteps.ts` | `createProduct` (with cleanup), `takeProductRefs`, `takeFirstProductId`, `checkInvalidProductChange`, `sendCreateProduct` |
| `userSteps.ts` | `registerThrowawayCustomer`, `loginThrowawayCustomer`, `readCurrentUser`, user page summaries |
| `cartSteps.ts` | `createCart`, `createProductAndCart`, `getCartOk`, `expectSingleItem` |
| `invoiceSteps.ts` | Invoice setups for customers and guests, `pollPdfStatus`, invoice page summaries |
| `brandSteps.ts`, `categorySteps.ts` | Create with cleanup, read back, slug lookups |
| `favoriteSteps.ts`, `messageSteps.ts`, `productSpecSteps.ts`, `reportSteps.ts` | The same for their areas |

Before writing a helper in a spec, look in these modules and `apiChecks.ts`: a spec never redefines one. When a second spec needs a spec-local helper, it moves to the area's module.

## Known issues, roles and tags

- **Known issue:** a scenario with `knownIssue` and `bug` gets `test.fail(true, 'Known issue BUG-010: <text>');` right **before its first `test.step`**, after any setup code. A failed setup (a 5xx during the re-seed) is then a real failure, not "bug still present". A bug that makes a test too slow uses `test.skip(true, ...)` as the first line instead.
- **Role:** `test.use({ role: 'admin' })` in the describe when every scenario has the role; otherwise an anonymous `test.describe(() => { test.use(...); test(...) })`.
- **Tags:** a scenario's `tags` become the tag option, `{ tag: '@smoke' }`; the title stays verbatim.

## Things that bite

- **Server-side caches:** `GET /products` (5 min), reports (5 min), product-spec names (300 s). Never read a record before changing it in the same test; read back only records the test created.
- **The hourly re-seed** changes every id: find records by name or take them from a list, never hard-code ids. `UNKNOWN_ID` (a ULID no record has) is the one constant id, for 404 checks.
- **Shared data:** other visitors can change seeded products at any time (product writes need no token). A list check filtered by brand or category can include other tests' records (`ProductFactory.isTestProduct`).
- **Rate limits:** anonymous calls share a per-IP limit of 60 per minute; reports are throttled per user.

## Changed in the review

This was the largest slice of the review: all 85 API specs.

- 71 inline status checks became `expectStatus`, 128 `JSON.parse` calls `parseJson`, 29 hand-built send-and-attach blocks plus 52 helpers `sendAndAttach`, and 118 token labels `AUTH`. The users specs' own copies of `expectStatus` and `expectMessage` were removed.
- Families of identical tests became templates: `checkStatusAndMessage` (about 90 tests in 37 specs), `checkRejectedBody`, `checkValidationRedirect`, `checkRejectedRegistration` (14), `checkInvalidProductChange`, `checkUnknownRef` and more.
- 23 "every item" loops that passed on an empty list got the `expectSomeItems` guard.
- The redirect's expected Location comes from `config.apiBaseUrl` instead of a hard-coded host.
- Every step that returns a value returns it from `test.step` (18 helpers changed).
- **Effect:** duplicated code fell from 11.5% to 6.9% (jscpd), and `tests/api` from 20,910 to 18,778 lines. All API tests passed, and every step title still matched its scenario.

Details: [13. Code review, October 2026](13-code-review-2026-10.md).
