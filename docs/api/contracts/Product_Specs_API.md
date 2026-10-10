# Product Specs API Documentation

The technical specifications of products in the Toolshop API (weight, material, warranty and so on): listing a product's specs, reading one, adding, updating and deleting them, and listing every spec name with its values. A product's specs are also returned in `specs` by `GET /products/{productId}` (see `Products_API.md`), and `GET /products` can filter on them with `by_spec`.

> Built from the OpenAPI spec (Toolshop API 5.0.0, tag "Product Spec"), the Laravel source (`sprint5/API`: `routes/api.php`, `ProductSpecController`, the `ProductSpec` model, its migration and seeder, the `Authenticate` middleware, `Handler`) and read-only calls (`GET` and `OPTIONS`) to the live API on 2026-10-10. The write endpoints were not called, so their facts are tagged `_(source)_`. Facts are tagged by origin.

## Base URL

`https://api.practicesoftwaretesting.com` (see `apiBaseUrl` in `src/envs/<ENV>.json`).

## Authentication

- Scheme: `Authorization: Bearer <JWT>`. Get a token with `POST /users/login` (see `Users_API.md`). _(source)_
- The three reads are public: `GET /products/{productId}/specs`, `GET /products/{productId}/specs/{specId}` and `GET /product-specs/names` answered without a token. _(verified)_
- The three writes (`POST`, `PUT`, `DELETE`) need a valid token: the controller applies the `auth:users` middleware to every action except `index`, `show` and `specNames`. The middleware checks only that the token is valid and the account enabled, not the role, so **any logged-in user, a customer included, can change any product's specs**. This differs from `DELETE /products/{productId}` (admin only) and from `POST`/`PUT`/`PATCH /products` (no token at all). _(source)_
- Without a token, or with an invalid, expired or logged-out one, a write returns `401` with `{ message: "Unauthorized" }`; a restricted token (the temporary token of a TOTP login) returns `401` with `{ message: "Unauthorized token usage" }`. _(source)_
- **Account state:** a disabled account (`enabled: false`) gets `403` with `{ message: "Account disabled." }` on the three writes. The middleware caches the user for 60 seconds, so a change can take up to a minute to apply (see `Users_API.md`). _(source)_

## Endpoints Overview

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/products/{productId}/specs` | List a product's specs | None |
| POST | `/products/{productId}/specs` | Add a spec to a product | Any user |
| GET | `/products/{productId}/specs/{specId}` | Get one spec of a product | None |
| PUT | `/products/{productId}/specs/{specId}` | Update a spec | Any user |
| DELETE | `/products/{productId}/specs/{specId}` | Delete a spec | Any user |
| GET | `/product-specs/names` | List every spec name with its distinct values | None |

## Data required for successful requests

| Data | Needed by | Requirements |
|---|---|---|
| Product id (ULID) | All endpoints with `{productId}` | An existing product, e.g. the `id` of an item from `GET /products`. Seeded ids change at every hourly re-seed, so read them at run time. Not every seeded product has specs. |
| Spec id (ULID) | `GET`, `PUT`, `DELETE /products/{productId}/specs/{specId}` | The `id` of a spec **of that product**, from `GET /products/{productId}/specs`. A spec id under another product's id is a `404` (`GET`, `PUT`) or a silent no-op (`DELETE`). |
| User token | `POST`, `PUT`, `DELETE` | A token from `POST /users/login` for any enabled user, customer or admin. Valid for 300 seconds. |
| `spec_name`, `spec_value` | `POST` | Non-empty strings, at most 100 and 255 characters. `spec_value` is always a string, also for numbers (`"340"`). |
| An existing product | `POST` | The product id in the path must exist: the foreign key `product_specs.product_id` rejects an unknown one with `500`. |
| `Accept: application/json` header | `POST`, `PUT` | Needed to get a `422` body instead of a redirect when the body is invalid (see the endpoints' error responses). |

## Endpoints

### 1. List a product's specs

Returns the specs of one product as a plain array (no pagination). An id that matches no product returns an empty array, not `404`. _(verified)_ A product without specs does the same, because the query only filters on `product_id`. _(source)_

**Endpoint:** `GET /products/{productId}/specs`

**Auth:** None _(verified)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `productId` | string | Yes | Product ULID. Matched case-insensitively. _(verified)_ |

**Query Parameters:** None. Query parameters are ignored (`?spec_name=Weight` returned the same body). _(verified)_

**Response:** `200 OK` _(verified)_
```ts
ProductSpec[]   // [] when the product has no specs or doesn't exist
```

The query has no `ORDER BY`. The observed order was alphabetical by `spec_name` (a side effect of the `product_id, spec_name` index), which the source doesn't guarantee. _(verified)_

**Example:** `GET /products/<productId>/specs` returned 5 specs for a seeded product (`Handle Material`, `Length`, `Material`, `Warranty`, `Weight`). `spec_unit` is `null` for specs without a unit, such as `Material`. _(verified)_

---

### 2. Add a spec to a product

Creates a spec for the product in the path. The product isn't looked up first. _(source)_

**Endpoint:** `POST /products/{productId}/specs`

**Auth:** Bearer token, any role _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `productId` | string | Yes | Product ULID. Must exist (see the `500` below). |

**Request Body:**
```ts
{
  spec_name: string;          // required, max 100
  spec_value: string;         // required, max 255; a JSON number fails the string rule
  spec_unit?: string | null;  // nullable, max 30
}
```

Other fields are ignored: `product_id` comes from the path, so a `product_id` in the body has no effect (the spec's `ProductSpecRequest` schema lists it as required, but no operation uses that schema). An empty string counts as missing (`ConvertEmptyStringsToNull`). _(source)_

**Response:** `201 Created` _(source)_
```ts
ProductSpec   // { product_id, spec_name, spec_value, spec_unit, id }; spec_unit is null when not sent
```

The `id` is a lower-case ULID (`HasUlids`; seeded specs have upper-case ids), and `created_at`/`updated_at` are hidden (`BaseModel`). _(source)_

**Error Responses:**
- `401 Unauthorized`: no token, or an invalid, expired or logged-out one; `{ message: "Unauthorized" }` _(source)_
- `422 Unprocessable Entity`: `spec_name` or `spec_value` missing, empty or not a string, a value longer than its limit, `spec_unit` not a string; with `Accept: application/json` the body is Laravel's default `{ message: string; errors: { <field>: string[] } }`, thrown by `$request->validate()` in the controller (not a form request, so not the flat field map of the `BaseFormRequest` areas); framework default _(source)_
- `302 Found`: the same invalid body sent without `Accept: application/json` (no `Accept` header, or `Accept: text/xml`); the framework treats the request as a browser form and redirects instead of answering `422`; framework default, observed on `POST /payment/check` (`Payment_API.md`) _(source)_
- `500 Internal Server Error`: `productId` matches no product: the insert violates the foreign key, and the global handler answers `{ message: "Something went wrong" }`; suspected bug, should be 404 _(source)_

Validation runs before the insert, so an invalid body for an unknown product gives `422`, not `500`. _(source)_

**Example:**
```http
POST /products/<productId>/specs
Authorization: Bearer <token>
Content-Type: application/json
Accept: application/json

{ "spec_name": "Contract-20261010-3fa9c2", "spec_value": "1.5", "spec_unit": "kg" }

201 Created
{ "product_id": "01m4jtz6...", "spec_name": "Contract-20261010-3fa9c2", "spec_value": "1.5", "spec_unit": "kg", "id": "01m4jx..." }
```

---

### 3. Get a spec

Returns one spec, looked up by its id within the product in the path. _(verified)_

**Endpoint:** `GET /products/{productId}/specs/{specId}`

**Auth:** None _(verified)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `productId` | string | Yes | Product ULID. Matched case-insensitively. _(verified)_ |
| `specId` | string | Yes | Spec ULID, from `GET /products/{productId}/specs`. Matched case-insensitively. _(verified)_ |

**Response:** `200 OK` _(verified)_
```ts
ProductSpec
```

**Error Responses:**
- `404 Not Found`: no spec with this id, or the spec belongs to another product, or the product doesn't exist: the lookup is scoped by `product_id`, so a spec is not reachable under a different `productId`; `{ message: "Requested item not found" }` _(verified)_

---

### 4. Update a spec

Updates the fields that are sent. Despite being `PUT`, no field is required: an empty body `{}` passes validation and changes nothing. The spec is looked up by id within the product in the path. _(source)_

**Endpoint:** `PUT /products/{productId}/specs/{specId}`

**Auth:** Bearer token, any role _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `productId` | string | Yes | Product ULID of the product that owns the spec |
| `specId` | string | Yes | Spec ULID |

**Request Body:**
```ts
{
  spec_name?: string;         // max 100; null or "" is rejected
  spec_value?: string;        // max 255; null or "" is rejected
  spec_unit?: string | null;  // max 30; null clears the unit
}
```

Only these three keys are applied (`$request->only(...)`); other fields, `product_id` included, are ignored, so a spec can't be moved to another product. _(source)_

**Response:** `200 OK` _(source)_
```ts
{ success: true }
```

The response doesn't return the updated spec; read it back with `GET`. _(source)_

**Error Responses:**
- `401 Unauthorized`: no token, or an invalid, expired or logged-out one; `{ message: "Unauthorized" }` _(source)_
- `404 Not Found`: no spec with this id for this product (including a spec of another product, or an unknown product); `{ message: "Requested item not found" }` (`firstOrFail`) _(source)_
- `422 Unprocessable Entity`: a sent field fails its rule (too long, not a string, `spec_name` or `spec_value` null or empty); same Laravel default `{ message, errors }` body as `POST`, with `Accept: application/json`; framework default _(source)_
- `302 Found`: the same invalid body sent without `Accept: application/json`; framework default, as on `POST` _(source)_

Validation runs before the lookup, so an invalid body on an unknown id gives `422`, not `404`. _(source)_ The spec lists only `200` and `401` for this operation. _(spec)_

---

### 5. Delete a spec

Deletes a spec of the product in the path. It answers `204` also when nothing was deleted. _(source)_

**Endpoint:** `DELETE /products/{productId}/specs/{specId}`

**Auth:** Bearer token, any role _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `productId` | string | Yes | Product ULID of the product that owns the spec |
| `specId` | string | Yes | Spec ULID |

**Response:** `204 No Content` _(source)_

**Error Responses:**
- `401 Unauthorized`: no token, or an invalid, expired or logged-out one; `{ message: "Unauthorized" }` _(source)_

An unknown `productId` or `specId`, or a spec that belongs to another product, doesn't give `404`: the `DELETE ... WHERE product_id = ? AND id = ?` simply matches no row and the handler returns `204`. The other product's spec is not deleted. Suspected inconsistency: `GET` and `PUT` return `404` for the same ids. _(source)_

---

### 6. List spec names

Returns every distinct spec name with its distinct values and one unit, across all products. The names and values are the ones `by_spec` on `GET /products` filters on (`name:value1|value2`, see `Products_API.md`). _(verified)_

**Endpoint:** `GET /product-specs/names`

**Auth:** None _(verified)_

**Query Parameters:** None

**Response:** `200 OK` _(verified)_
```ts
Array<{
  name: string;           // the spec name, e.g. "Warranty"
  values: string[];       // distinct values for this name
  unit: string | null;    // the unit of the first row of this name only
}>
```

- The array is ordered by `name`, and `values` is sorted as text (`"120"`, `"1200"`, `"1500"`, `"180"`), not as numbers. _(verified)_
- `unit` comes from the first row of each name only. A name used with several units shows one of them: `Length` returned `"mm"`, although the seeded values `"5"` and `"7.5"` (tape measures) are in `m`. Suspected bug. _(verified)_ The seed data's units are read from `ProductSpecSeeder`. _(source)_
- The result is cached on the server for 300 seconds, and every `POST`, `PUT` and `DELETE` on a spec clears that entry, so a change normally shows up at once. _(source)_

**Example:** `GET /product-specs/names` returned 41 entries on 2026-10-10, e.g. `{ "name": "Battery", "values": ["2.0", "3.0", "4.0", "5.0"], "unit": "Ah" }`. _(verified)_

---

## Data Models

### ProductSpec

As returned by the list, get and create endpoints, and in `specs` of `GET /products/{productId}`. `created_at` and `updated_at` are hidden. _(verified)_

```ts
interface ProductSpec {
  id: string;                 // ULID; seeded specs have upper-case ids, created ones lower-case
  product_id: string;         // ULID of the owning product
  spec_name: string;          // max 100
  spec_value: string;         // max 255; numbers are strings
  spec_unit: string | null;   // max 30
}
```

### SpecName

One entry of `GET /product-specs/names`. _(verified)_

```ts
interface SpecName {
  name: string;
  values: string[];
  unit: string | null;
}
```

## Enums

None. The names and values are free text. The seed (`ProductSpecSeeder`) uses names such as `Weight`, `Length`, `Material`, `Handle Material` and `Warranty`, with units such as `g`, `mm`, `years`, `pcs`, `V` and `W`. `GET /product-specs/names` lists the current ones. _(source)_

## Error Handling

- Errors raised by the framework or the global handler (`app/Exceptions/Handler.php`) have the body `{ message: string }`: `"Requested item not found"` (an unknown spec, `404`), `"Unauthorized"` (`401`), `"Something went wrong"` (a database error such as a foreign-key violation, `500`). _(source)_ The `404` was observed. _(verified)_
- Validation errors on `POST` and `PUT` come from `$request->validate()` in the controller, so they are Laravel's default (`{ message, errors }`), not the flat `{ field: [messages] }` map of the areas that use form requests (Brands, Products). Without `Accept: application/json` the failure is a `302` redirect. _(source)_
- `405 Method Not Allowed`: any method a path has no route for, e.g. `PATCH /products/{productId}/specs/{specId}` or `PUT /products/{productId}/specs`; `{ message: "Method is not allowed for the requested route" }`. Shared by every route, so it isn't listed per endpoint. _(source)_
- Framework errors are JSON only when the request sends `Accept: application/json`; otherwise Laravel may render an HTML page (see `Products_API.md`). The `404` for an unknown spec was JSON with or without the header, and also with `Accept: text/xml`. _(verified)_

## Notes

- **Writes need a token, but any role is enough:** `POST`, `PUT` and `DELETE` use `auth:users` and no role check, so a customer can add, change or delete the specs of any product, while deleting the product itself needs an admin. Suspected authorization gap. _(source)_
- **Unknown product on `POST`:** a `POST` for a product id that doesn't exist gives `500` (foreign-key violation), where `404` or `422` would be expected. Suspected bug. _(source)_
- **`DELETE` is silent:** `204` even when no spec matched (unknown ids, or a spec of another product). `GET` and `PUT` return `404` for the same ids. Suspected inconsistency. _(source)_
- **Product delete cascades:** `product_specs.product_id` is a foreign key with `ON DELETE CASCADE`, so deleting a product (`DELETE /products/{productId}`, admin) removes its specs and is not blocked by them. _(source)_
- **Specs are scoped by product:** `GET`, `PUT` and `DELETE` on a spec always include `product_id` in the lookup, so a spec id under a different `productId` is never reachable: `404` on `GET` _(verified)_, `404` on `PUT` and a no-op on `DELETE` _(source)_.
- **Ids are case-insensitive:** `GET` with lower-case ids returned the same body (and `ETag`) as with the stored upper-case ids. _(verified)_ The lookup is a database comparison, so the write routes most likely behave the same; they weren't called. _(source)_
- **Caching:** the `GET` routes send `Cache-Control: max-age=120, public` and an `ETag` on `200`; a matching `If-None-Match` got `304` (list). `404` answers send `Cache-Control: no-cache, private`. _(verified)_ After a write, the product detail cache entry (`products.{productId}`, which embeds the specs) and the names cache are cleared, so `GET /products/{productId}` and `GET /product-specs/names` reflect the change on the server; a client or proxy that honours `max-age=120` may still show the old body for up to 2 minutes. _(source)_
- **OPTIONS:** every spec path answers `OPTIONS` with `204` and an `Allow` header: `GET, POST` for `/products/{productId}/specs`, `DELETE, GET, PUT` for `/products/{productId}/specs/{specId}` and `GET` for `/product-specs/names`. Unknown ids get the same answer, because only the route is matched. Not in the spec. _(verified)_
- **XML:** with `Accept: text/xml` the `200` bodies are XML (`<response><item>...`, `Content-Type: text/xml; charset=utf-8`); a `null` unit becomes an empty `<spec_unit></spec_unit>`, and in `GET /product-specs/names` the `values` array comes out as a JSON string inside the element (`<values>["Yes"]</values>`). The `404` stays JSON. _(verified)_
- **Spec vs source:**
  - the operations `GET` (all three) and `POST`, `PUT`, `DELETE` list only `200`/`201`/`204`, `401` and, for `POST`, `422`; the code also answers `404` on `GET` one and `PUT`, `422` on `PUT`, and `500` on `POST` for an unknown product;
  - the `GET /product-specs/names` response has no schema in the spec;
  - the `ProductSpecRequest` schema (required `product_id`, `spec_name`, `spec_value`) is not used by any operation, and the real `POST` body has no `product_id`;
  - the `spec_unit` is `type: [string, null]` in the spec (OpenAPI 3.1), matching `nullable` in the code.
  The code wins in this contract. _(source)_
- **Product writes vs spec writes:** `Products_API.md` notes that `POST`/`PUT`/`PATCH /products` need no token. The spec writes are protected, so tests for them need a token fixture, and their data needs cleanup (`DELETE` of the created spec, or removing the throwaway product it belongs to).
