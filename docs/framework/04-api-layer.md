# 4. API layer

The API layer is three tiers: **clients** send requests and return raw responses, **services** turn happy-path calls into typed results, and **DTOs** type the bodies. Every request in the framework, the UI tests' setup and the run's customer included, goes through one method: `BaseClient.executeRequest`.

```
spec / step helper
   │  "check the status"            "set up a record"
   ▼                                 ▼
ProductsClient.create(body)     ProductsService.create(body)  ──► parseOk: 2xx or ApiError, JSON parsed
   │                                 │
   └──────────────┬──────────────────┘
                  ▼
     BaseClient.executeRequest(method, path, options)
        headers (Accept, Content-Type, Authorization from the token or token function)
        Playwright APIRequestContext.fetch
        → ApiResponse { status, statusText, body (string), isSuccess, headers }
        → onApiCall listeners (coverage)            on a failed request: credentials masked in the error
```

## `BaseClient` ([`src/api/clients/BaseClient.ts`](../../src/api/clients/BaseClient.ts))

| Part | What it does |
|---|---|
| Constructor `(request, config, accessToken?)` | The test's `APIRequestContext`, `apiBaseUrl`, and an `AccessToken`: a string, or a function called when each request is sent |
| `executeRequest(method, path, options)` | Builds the URL and headers, sends, reads the body as text, notifies listeners, returns `ApiResponse` |
| Verb helpers (protected) | `get(path, query)`, `post/put/patch/delete(path, { data, query })`, `query(path, options)`, `queryBody(path, body, options)` |
| `queryString(params)` | The query string from an object, in order: undefined values left out, `''` sent as `name=`, arrays as `name[]=` |
| `RequestOptions` | `accept` (`null` leaves the header out) and `maxRedirects` (`0` returns a 3xx as it is), passed on with a spread |
| `BaseClient.onApiCall(listener)` | A listener called after every request of every client in the worker: method, URL, path, query, body, status (0 when the request failed), duration. Returns a function that removes it; a throwing listener only logs a warning |

`executeRequest` details:

- **Defaults:** `Accept: application/json`; a `data` body is sent as JSON with `Content-Type: application/json; charset=utf-8`.
- **Negative tests:** `rawData` sends a body as-is with its `contentType` (the 415 checks); `accept` replaces or removes Accept; `headers` adds extra ones (`If-None-Match`); `multipart` sends a form (listeners see files as name, type and size, never their bytes).
- **QUERY** (the HTTP method with criteria in the body): `queryBody` sends an object as JSON, or a string as-is with a given Content-Type.
- **Failed requests** (no response at all): Playwright's error includes a call log listing every request header, the bearer token included. `describeRequestError` masks `Authorization`, `Cookie` and `Set-Cookie` before the error is rethrown as `<METHOD> <url> failed: ...`, because errors reach published reports and public CI logs.

## Clients ([`src/api/clients/`](../../src/api/clients/))

One client per API area (14: Auth, Brands, Carts, Categories, Favorites, Images, Invoices, Messages, Payment, Postcode, ProductSpecs, Products, Reports, Users), with **one public method per endpoint**:

```ts
export class ProductsClient extends BaseClient {
  async search(query?: string, page?: number): Promise<ApiResponse> {
    return this.get('/products/search', queryString({ q: query, page }));
  }
  async create(body: CreateProductRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.post('/products', { data: body });
  }
  /** PATCH /products/{productId}. */
  async partialUpdate(productId: string, body: PatchProductRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.patch(`/products/${productId}`, { data: body });
  }
}
```

- Clients don't parse and don't check statuses: a step that checks a status code uses the client.
- Write methods accept their DTO **or any object**, so validation scenarios can send invalid bodies; services keep the strict types.
- The PATCH method is `partialUpdate`, because `patch` is the verb helper.

## Services ([`src/api/services/`](../../src/api/services/))

Domain operations on top of a client, for happy paths, setup and cleanup. They expect success:

```ts
async create(body: CreateProductRequest): Promise<Product> {
  return parseOk(await this.client.create(body), `create product "${body.name}"`);
}
```

[`serviceUtils.ts`](../../src/api/services/serviceUtils.ts):

| Helper | Behaviour |
|---|---|
| `ApiError` | A non-2xx where a happy path was expected; carries `status`, so callers tell a 5xx from a 4xx |
| `assertOk(response, action)` | Throws `ApiError` with the status and the start of the body |
| `assertOkOrNotFound` | The same, but a 404 counts as done: for `deleteIfExists`, the cleanup of a record the test may already have deleted |
| `parseOk<T>(response, action)` | `assertOk`, then the parsed body; a 2xx body that isn't JSON fails with the action and the body's start |

## DTOs ([`src/api/dto/`](../../src/api/dto/))

Request and response types per area (14 modules), written from the contracts in `docs/api/contracts/`: optional fields with `?`, nullable ones with `| null`. `common.ts` holds what areas share: `Paginated<T>` (Laravel's page), `FieldValidationError`, `ValidationErrors`. Shared shapes are reused, not copied: a cart item's product is the `Product` type, and its category and brand are `Category` and `Brand`.

## Authentication ([`src/api/auth/`](../../src/api/auth/))

- **`POST /users/login`** returns `access_token` and `expires_in` (300 s). The JWT's `role` claim is `admin` or `user`.
- **`TokenService`** (worker-scoped): `getAccessToken(role)` logs in once through the project's `login` (`apiLogin`, the call above), caches the token until `TOKEN_EXPIRY_MARGIN_MS` (2 minutes) before it expires, then logs in again. A failed login throws `ApiError` with a hint: a 5xx means the site, not the credentials.
- **`roleToken(tokenService, role)`** (in the API fixtures): the token function role and admin clients get, read when each request is sent.
- **`runUser.ts`**: the run's customer, registered and deleted around the run by the project's `beforeRun` and `afterRun` ([2](02-configuration.md#the-runs-customer-the-default-role)).

## API coverage (optional)

[`src/api/coverage/apiCoverage.ts`](../../src/api/coverage/apiCoverage.ts) loads the private package `@zaytsman/playwright-api-coverage` with `require` **only when it's installed**:

- `loadApiCoverage()` returns the package or `undefined`; the auto worker fixture `apiCoverage` then records every call through `onApiCall`.
- `apiCoverageReporter(options)` returns the reporter entry for `playwright.config.ts`, or nothing.
- The part of the package's API used here is declared locally, so the typecheck passes without the package. Specs never import the package: forks and their pull requests don't have it.

The reporter compares the recorded calls with `docs/api/contracts/` and writes `test-results/api-coverage/` (`index.html`, `summary.json`). `DISABLE_API_COVERAGE=true`, or a CLI `--reporter`, turns it off.

## How to add an endpoint

1. Check its contract in `docs/api/contracts/<Area>_API.md` (add the endpoint if it's missing).
2. Add a client method in the area's client, built on a verb helper; types in the area's DTO module.
3. Add a service method only if a step uses the endpoint as a happy path, setup or cleanup.
4. A new client or service is registered in `src/api/fixtures/fixtures.ts` ([3](03-fixtures.md)).

## Changed in the review

- **Blocker fixed:** a failed request's error carried the bearer token, from Playwright's call log, into test errors, cleanup warnings, CI logs and the coverage report. Now `describeRequestError` masks the credential headers. A local probe confirmed it.
- One `queryBody` replaced 7 copies of the QUERY-with-body branch; one `queryString` replaced query strings built by hand in 9 methods; `RequestOptions` replaced `{ accept, maxRedirects }` passed field by field in 4 places.
- `BaseClient`: the unused `setToken` and `config` were removed, `baseUrl` made read-only, the verb helpers made `protected`, and every write helper takes the same `(path, { data, query })` shape.
- `parseOk` fails with context on a 2xx body that isn't JSON; `deleteIfExists` (4 copies) uses `assertOkOrNotFound`.
- DTOs: `CartProduct` and `FavoriteProduct` reuse `Product` instead of repeating its 9 fields, `PaymentMethod` is defined once, and the unused `UpdateUserResponse` was removed.
- `ApiError` carries the status (used by `runUser`'s retry), and the token is fetched per request (the token function).
- 17 copies of the same JSDoc boilerplate became one block in `BaseClient`.

Details: [13. Code review, October 2026](13-code-review-2026-10.md).
