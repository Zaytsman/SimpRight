# Brands API Documentation

The product brands of the Toolshop API: listing, searching and reading brands, plus creating, updating and deleting them. Products reference a brand through `brand_id` (see `Products_API.md`).

> Built from the OpenAPI spec (Toolshop API 5.0.0), the Laravel source (`sprint5/API`: `routes/api.php`, `BrandController`, `BrandService`, the `Brand` form requests and model, `tests/Feature/BrandTest.php`) and calls to the live API on 2026-10-10, including writes on throwaway brands that were deleted afterwards. Facts are tagged by origin.

## Base URL

`https://api.practicesoftwaretesting.com` (see `apiBaseUrl` in `src/envs/<ENV>.json`).

## Authentication

- Scheme: `Authorization: Bearer <JWT>`. Get a token with `POST /users/login` (see `Users_API.md`). _(source)_
- Only `DELETE /brands/{brandId}` checks a token: it requires the `admin` role (`role:admin` middleware in `BrandController`). Every other brand endpoint, including create and update, accepts requests without a token. _(source)_ `POST`, `PUT` and `PATCH` succeeded without a token. _(verified)_
- Without a token, or with an invalid one, `DELETE` returns `401` with `{ message: "Unauthorized" }` _(verified)_; a token whose user isn't an admin gets `403` with `{ message: "Forbidden" }` _(source)_.
- `DELETE` uses only the `role` middleware, not the `auth:users` middleware of the Users API, so the source doesn't show the "Account disabled." check (`Users_API.md`) applying here. _(source)_

## Endpoints Overview

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/brands` | List all brands | None |
| POST | `/brands` | Create a brand | None |
| GET | `/brands/{brandId}` | Get one brand | None |
| PUT | `/brands/{brandId}` | Update a brand | None |
| PATCH | `/brands/{brandId}` | Partially update a brand | None |
| DELETE | `/brands/{brandId}` | Delete a brand | Admin |
| GET | `/brands/search` | Search brands by name | None |
| QUERY | `/brands/search` | Search brands, criteria in a JSON body | None |

## Data required for successful requests

| Data | Needed by | Requirements |
|---|---|---|
| Brand id (ULID) | `GET`/`PUT`/`PATCH`/`DELETE /brands/{brandId}` | An existing brand, e.g. an `id` from `GET /brands`. Seeded brand ids change at every hourly re-seed, so read them at run time. |
| Unique slug | `POST /brands` (required), `PUT`/`PATCH` (when `slug` is sent) | Letters, digits, `-` and `_` only (ASCII), at most 120 characters, not used by any other brand. Use `uniqueName()`-style values. |
| Admin token | `DELETE /brands/{brandId}` | A token from `POST /users/login` for a user whose `role` is `admin`. |
| A brand no product uses | `DELETE /brands/{brandId}` → `204` | A brand referenced by a product's `brand_id` can't be deleted (`409`). Create a throwaway brand first. |
| A product using the brand | `DELETE /brands/{brandId}` → `409` | Create a throwaway product with `POST /products` and `brand_id` set to a throwaway brand; delete the product (admin) before the brand. |

## Endpoints

### 1. List brands

Returns every brand, as a plain array (no pagination). The seeded data has two brands. _(verified)_

**Endpoint:** `GET /brands`

**Auth:** None _(verified)_

**Query Parameters:** None

**Response:** `200 OK` _(verified)_
```ts
Brand[]
```

The model declares a `sort` filter, but `index` doesn't apply it, so query parameters are ignored. _(source)_

---

### 2. Create brand

Creates a brand. No token is needed (see Notes). _(source)_

**Endpoint:** `POST /brands`

**Auth:** None _(verified)_

**Request Body:**
```ts
{
  name: string;   // max 120, no subscript/superscript characters (U+2070 to U+209F)
  slug: string;   // max 120, alpha_dash (ASCII letters, digits, "-", "_"), unique among brands, no subscript/superscript characters
}
```

Other fields are ignored (the model's `$fillable` is `name` and `slug`). An empty string counts as missing (`ConvertEmptyStringsToNull`). _(source)_

**Response:** `201 Created` _(verified)_
```ts
Brand
```

**Error Responses:**
- `409 Conflict`: the only failing rule is the slug's uniqueness (another brand has this slug); `{ slug: ["A brand already exists with this slug."] }` _(verified)_
- `422 Unprocessable Entity`: `name` or `slug` missing, `slug` with characters outside `alpha_dash`, `name` longer than 120 characters; body `{ <field>: string[] }`, e.g. `{ name: ["The name field is required."], slug: ["The slug field is required."] }` for an empty body (messages from the service's own test). A duplicate slug together with another failing rule also gives `422` _(verified)_

**Example:**
```http
POST /brands
Content-Type: application/json

{ "name": "Contract-20261010-3fa9c2", "slug": "contract-20261010-3fa9c2" }

201 Created
{ "name": "Contract-20261010-3fa9c2", "slug": "contract-20261010-3fa9c2", "id": "01m4jc5p..." }
```

---

### 3. Get brand

Returns one brand. _(verified)_

**Endpoint:** `GET /brands/{brandId}`

**Auth:** None _(verified)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `brandId` | string | Yes | Brand ULID (named `{id}` in the route) |

**Response:** `200 OK` _(verified)_
```ts
Brand
```

**Error Responses:**
- `404 Not Found`: no brand with this id; `{ message: "Requested item not found" }` _(verified)_

---

### 4. Update brand

Updates a brand with the fields sent. No token is needed (see Notes). Despite being `PUT`, no field is required, and the slug has no uniqueness rule: a duplicate is caught by the database instead. _(source)_

**Endpoint:** `PUT /brands/{brandId}`

**Auth:** None _(verified)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `brandId` | string | Yes | Brand ULID |

**Request Body:**
```ts
{
  name?: string;   // max 120, no subscript/superscript characters
  slug?: string;   // max 120, alpha_dash (ASCII); not checked for uniqueness by validation
}
```

Validation runs before the brand is looked up, so an invalid body on an unknown id gives `422`, not `404`. _(source)_

**Response:** `200 OK` _(verified)_
```ts
{ success: true }
```

**Error Responses:**
- `404 Not Found`: no brand with this id; `{ message: "Requested item not found" }` _(verified)_
- `409 Conflict`: `slug` is already used by another brand; the database's unique index rejects it and the global handler answers `{ message: "Duplicate Entry" }` (not the field map that `POST` and `PATCH` return) _(verified)_
- `422 Unprocessable Entity`: `name` longer than 120 characters _(verified)_; `name` or `slug` not a string, `slug` outside `alpha_dash`, subscript/superscript characters _(source)_

---

### 5. Partially update brand

Updates only the validated fields that are sent (`$request->validated()`). _(source)_

**Endpoint:** `PATCH /brands/{brandId}`

**Auth:** None _(verified)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `brandId` | string | Yes | Brand ULID |

**Request Body:**
```ts
{
  name?: string;   // max 120, no subscript/superscript characters
  slug?: string;   // max 120, alpha_dash (ASCII), unique among all brands, including this one
}
```

**Response:** `200 OK` _(verified)_
```ts
{ success: true }
```

**Error Responses:**
- `404 Not Found`: no brand with this id (and the body is valid); `{ message: "Requested item not found" }` _(verified)_
- `409 Conflict`: `slug` is already used by a brand, including the brand being patched: sending its own current slug is refused; `{ slug: [...] }`. Suspected bug for the own-slug case: the `unique` rule doesn't ignore the current brand _(verified)_
- `422 Unprocessable Entity`: `slug` outside `alpha_dash` _(verified)_; `name` too long or not a string, subscript/superscript characters _(source)_

---

### 6. Delete brand

Deletes a brand. Admin only. _(source)_

**Endpoint:** `DELETE /brands/{brandId}`

**Auth:** Bearer token, `admin` role _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `brandId` | string | Yes | Brand ULID |

**Response:** `204 No Content` _(verified)_

**Error Responses:**
- `401 Unauthorized`: no token, or an invalid one; `{ message: "Unauthorized" }` _(verified)_
- `403 Forbidden`: the token's user isn't an admin; `{ message: "Forbidden" }` _(source)_
- `404 Not Found`: no brand with this id; `{ message: "Requested item not found" }` _(verified)_
- `409 Conflict`: a product uses the brand (foreign key `products.brand_id`); `{ success: false, message: "Seems like this brand is used elsewhere." }` _(verified)_

---

### 7. Search brands

Searches brand names. Queries of 4 characters or more use a MySQL full-text prefix match (`MATCH(name) AGAINST('<q>*' IN BOOLEAN MODE)`); shorter ones use `LIKE '%<q>%'`. _(source)_ A missing `q` returns every brand, not an error. _(verified)_

**Endpoint:** `GET /brands/search`

**Auth:** None _(verified)_

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `q` | string | No | Search term. The spec marks it required, but without it the API returns `200` with all brands. |

**Response:** `200 OK` _(verified)_
```ts
Brand[]   // empty array when nothing matches
```

**Error Responses:**
- `500 Internal Server Error`: `q` sent as an array (`?q[]=x`); `{ message: "Server Error" }`; suspected bug, should be 422 or treated as text _(verified)_

---

### 8. Search brands (HTTP QUERY)

Same as `GET /brands/search`, with the criteria in a JSON body (RFC 10008 `QUERY` method); the body keys are merged into the query string. _(source)_

**Endpoint:** `QUERY /brands/search`

**Auth:** None _(verified)_

**Request Body:**
```ts
{
  q?: string;   // the spec marks it required; an empty body returns every brand
}
```

**Response:** `200 OK` _(verified)_
Same shape as `GET /brands/search`, with the header `Accept-Query: application/json`. An empty body `{}` returns all brands. _(verified)_

**Error Responses:**
- `415 Unsupported Media Type`: `Content-Type` is not JSON; `{ message: "QUERY requests must use Content-Type: application/json" }` with `Accept: application/json` _(verified)_
- `500 Internal Server Error`: `q` sent as an array (`{ "q": ["x"] }`); suspected bug, same code path as `GET /brands/search` _(source)_

---

## Data Models

### Brand

As returned by `GET /brands`, `GET /brands/{brandId}` and `POST /brands`. `created_at` and `updated_at` are hidden (`BaseModel`). _(verified)_

```ts
interface Brand {
  id: string;     // ULID; seeded brands have upper-case ids, brands created through the API lower-case ones
  name: string;
  slug: string;
}
```

`POST /brands` returns the keys in the order `name`, `slug`, `id`. _(verified)_

## Enums

None. The seeded brands are `ForgeFlex Tools` (`forgeflex-tools`) and `MightyCraft Hardware` (`mightycraft-hardware`) (`BrandSeeder`). _(verified)_

## Error Handling

- Errors raised by the framework or the global handler (`app/Exceptions/Handler.php`) have the body `{ message: string }`, e.g. `"Requested item not found"` (unknown id), `"Resource not found"` (unknown route), `"Duplicate Entry"` (a database unique-index violation, `409`), `"Server Error"`. _(source)_
- Validation errors from form requests are a map of field to messages, without a wrapper: `{ "name": ["The name field is required."], ... }` (`BaseFormRequest`). When every failing rule is a uniqueness rule (a duplicate `slug` on `POST` or `PATCH`), the status is `409` instead of `422`. _(verified)_
- `405 Method Not Allowed`: any method a path has no route for, e.g. `QUERY /brands`; `{ message: "Method is not allowed for the requested route" }`. Shared by every route, so it isn't listed per endpoint. _(verified)_
- Framework errors (e.g. `415`) are JSON only when the request sends `Accept: application/json`; otherwise Laravel renders an HTML page (see `Products_API.md`). _(source)_

## Notes

- **No auth on writes:** `POST`, `PUT` and `PATCH /brands` accept requests without a token (no auth middleware in `BrandController`, no security in the spec either). Anyone can create brands or rename seeded ones. Suspected security bug. _(verified)_
- **`PATCH` with the brand's own slug:** the `unique:brands,slug` rule in `PatchBrand` doesn't exclude the brand being patched, so re-sending the current slug (as a form that submits all fields would) returns `409`. Suspected bug. _(verified)_
- **`PUT` vs `PATCH` duplicates:** `UpdateBrand` has no uniqueness rule, so a duplicate slug reaches the database and comes back as `409 { message: "Duplicate Entry" }`, while `POST`/`PATCH` return `409 { slug: [...] }`. _(verified)_
- **Delete edge case:** `destroy` catches only `QueryException` with SQLSTATE `23000` (→ `409`); any other database error falls through the `catch` without a return, so Laravel would send an empty `200`. Not triggerable on purpose. _(source)_
- **`/search` overlaps `/{brandId}`:** `PUT`, `PATCH` and `DELETE /brands/search` match the id routes with `brandId = "search"` (→ `404`; `DELETE` needs an admin token first), which is why `OPTIONS /brands/search` lists `DELETE, GET, PATCH, PUT, QUERY`. _(source)_ The `Allow` header is observed. _(verified)_
- **OPTIONS:** every brand path answers `OPTIONS` with `204` and an `Allow` header: `GET, POST` for `/brands`, `DELETE, GET, PATCH, PUT` for `/brands/{brandId}`, `DELETE, GET, PATCH, PUT, QUERY` for `/brands/search`. Not in the spec. _(verified)_
- **Caching:** the `GET` routes send `Cache-Control: max-age=120, public` and an `ETag` _(verified)_; a matching `If-None-Match` gets `304` (Laravel `cache.headers`) _(source)_. Server-side, `BrandService` caches the list, each brand and each search term for 1 hour. Create, update and delete clear the list and that brand's entry, but never the search entries, so a search term that was already used can keep returning stale results for up to an hour (a new brand missing, a deleted one still listed). Use a fresh search term in tests. _(source)_ `POST /refresh` (migrate and re-seed) flushes the whole cache; the source doesn't show whether the hourly re-seed goes through it. _(source)_
- **XML:** with `Accept: text/xml`, responses are rendered as XML (`<response><item>...`) instead of JSON (`Controller::preferredFormat`). _(verified)_
- **Spec vs source** (the annotations in `BrandController`, which generate the published spec): `BrandRequest` has no `required` list, but `POST` requires `name` and `slug`; `q` is marked required on both search endpoints but is optional; `404` is listed on `GET /brands`, `GET /brands/search` and `POST /brands`, which can't return it; `405` is listed on every operation (it's router-wide); `DELETE` lists `422`, which it can't return (its only rule checks the route's `id`, which is always present), and doesn't list `403`; the `409` on `PUT` is described as the validation field map, but `PUT` has no uniqueness rule and returns `{ message: "Duplicate Entry" }`. The code wins in this contract. _(source)_
