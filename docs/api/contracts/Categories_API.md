# Categories API Documentation

The product categories of the Toolshop API: a two-level hierarchy of top-level categories and their sub-categories (`parent_id`). Listing, reading and searching categories, reading them as a tree, plus creating, updating and deleting them. Products reference a category through `category_id` (see `Products_API.md`).

> Built from the OpenAPI spec (Toolshop API 5.0.0), the Laravel source (`sprint5/API`: `routes/api.php`, `CategoryController`, `CategoryService`, the `Category` form requests, model, migration and seeder, `tests/Feature/CategoryTest.php`) and read-only calls to the live API on 2026-10-10 between 07:49 and 07:51 UTC (no writes, no token). Facts are tagged by origin.

## Base URL

`https://api.practicesoftwaretesting.com` (see `apiBaseUrl` in `src/envs/<ENV>.json`).

## Authentication

- Scheme: `Authorization: Bearer <JWT>`. Get a token with `POST /users/login` (see `Users_API.md`). _(source)_
- Only `DELETE /categories/{categoryId}` checks a token: it requires the `admin` role (`role:admin` middleware in `CategoryController`). Every other category endpoint, including create and update, has no auth middleware and accepts requests without a token. _(source)_ The writes were not called live, so this is not observed. _(source)_
- Without a token, or with an invalid one, `DELETE` returns `401` with `{ message: "Unauthorized" }` _(verified)_; a token whose user isn't an admin gets `403` with `{ message: "Forbidden" }` _(source)_.
- `DELETE` uses only the `role` middleware, not the `auth:users` middleware of the Users API, so the source doesn't show the "Account disabled." check (`Users_API.md`) applying here. _(source)_

## Endpoints Overview

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/categories` | List all categories (flat) | None |
| POST | `/categories` | Create a category | None |
| GET | `/categories/tree` | Top-level categories with their sub-categories | None |
| QUERY | `/categories/tree` | Category tree, criteria in a JSON body | None |
| GET | `/categories/tree/{categoryId}` | Get one category with its sub-categories | None |
| GET | `/categories/search` | Search categories by name | None |
| QUERY | `/categories/search` | Search categories, criteria in a JSON body | None |
| PUT | `/categories/{categoryId}` | Update a category | None |
| PATCH | `/categories/{categoryId}` | Partially update a category | None |
| DELETE | `/categories/{categoryId}` | Delete a category | Admin |

There is no `GET /categories/{categoryId}`: a single category is read with `GET /categories/tree/{categoryId}`. `GET /categories/{categoryId}` returns `405`. _(verified)_

## Data required for successful requests

| Data | Needed by | Requirements |
|---|---|---|
| Category id (ULID) | `GET /categories/tree/{categoryId}`, `PUT`/`PATCH`/`DELETE /categories/{categoryId}` | An existing category, e.g. an `id` from `GET /categories`. Seeded ids change at every hourly re-seed, so read them at run time. |
| Top-level category slug | `by_category_slug` on `GET`/`QUERY /categories/tree` | The slug of a category whose `parent_id` is `null` (seeded: `hand-tools`, `power-tools`, `other`). A sub-category's slug matches nothing. |
| Unique slug | `POST /categories` (required), `PUT`/`PATCH` (when `slug` is sent) | ASCII letters, digits, `-` and `_` only, at most 120 characters, not used by any other category. Use `uniqueName()`-style values. |
| Parent category id | `parent_id` on `POST`/`PUT`/`PATCH` (optional) | An existing category id, or `null` for a top-level category. An unknown id fails with `500` (see the endpoints). |
| Admin token | `DELETE /categories/{categoryId}` | A token from `POST /users/login` for a user whose `role` is `admin`. |
| A category nothing references | `DELETE /categories/{categoryId}` → `204` | No product uses it (`products.category_id`) and it has no sub-categories (`categories.parent_id`). Create a throwaway category first. |
| A product or sub-category using the category | `DELETE /categories/{categoryId}` → `409` | E.g. a throwaway category with a throwaway sub-category (`POST /categories` with `parent_id`); delete the child before the parent. |

## Endpoints

### 1. List categories

Returns every category, top-level and sub-categories alike, as a flat array without `sub_categories` (no pagination). The seeded data has 19 categories: 3 top-level and 16 sub-categories. _(verified)_

**Endpoint:** `GET /categories`

**Auth:** None _(verified)_

**Query Parameters:** None

**Response:** `200 OK` _(verified)_
```ts
Category[]   // keys id, name, slug, parent_id
```

---

### 2. Create category

Creates a category; with `parent_id` it becomes a sub-category of that category. No token is needed (see Notes). _(source)_

**Endpoint:** `POST /categories`

**Auth:** None _(source)_

**Request Body:**
```ts
{
  name: string;              // max 120, no subscript/superscript characters (U+2070 to U+209F)
  slug: string;              // max 120, alpha_dash (ASCII letters, digits, "-", "_"), unique among categories, no subscript/superscript characters
  parent_id?: string | null; // id of the parent category; null or absent for a top-level category; not checked for existence by validation
}
```

Other fields are ignored (the model's `$fillable` is `name`, `slug` and `parent_id`). An empty string counts as missing (`ConvertEmptyStringsToNull`). _(source)_

**Response:** `201 Created` _(source)_
```ts
Category   // the created model: the fields sent plus id; parent_id appears only when it was sent
```

**Error Responses:**
- `409 Conflict`: the only failing rule is the slug's uniqueness (another category has this slug); `{ slug: ["A category already exists with this slug."] }` _(source)_
- `422 Unprocessable Entity`: `name` or `slug` missing, `slug` outside `alpha_dash`, `name` or `slug` longer than 120 characters, `parent_id` not a string, subscript/superscript characters; body `{ <field>: string[] }`, e.g. `{ name: ["The name field is required."], slug: ["The slug field is required."] }` for an empty body (the service's own test). A duplicate slug together with another failing rule also gives `422` _(source)_
- `500 Internal Server Error`: `parent_id` is not the id of an existing category; the foreign key `categories.parent_id` rejects it and the global handler answers `{ message: "Something went wrong" }`; suspected bug, should be 422 _(source)_

**Example:**
```http
POST /categories
Content-Type: application/json

{ "name": "Contract-20261010-3fa9c2", "slug": "contract-20261010-3fa9c2", "parent_id": "<id of Hand Tools>" }

201 Created
{ "name": "Contract-20261010-3fa9c2", "slug": "contract-20261010-3fa9c2", "parent_id": "<id of Hand Tools>", "id": "..." }
```
The key order is what Brands returns for the same code path (`Model::create`), not observed for categories.

---

### 3. Get category tree

Returns the top-level categories (`parent_id` is `null`), each with its `sub_categories`, loaded recursively (the seeded data has two levels, so sub-categories have an empty `sub_categories`). _(verified)_

**Endpoint:** `GET /categories/tree`

**Auth:** None _(verified)_

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `by_category_slug` | string | No | Only the top-level category with this slug. A sub-category's slug or an unknown slug returns `[]`. |

**Response:** `200 OK` _(verified)_
```ts
CategoryTree[]   // 3 items unfiltered, 1 or 0 with by_category_slug
```

**Error Responses:**
- `500 Internal Server Error`: `by_category_slug` sent as an array (`?by_category_slug[]=x`); `{ message: "Server Error" }`; suspected bug, should be 422 or treated as text _(verified)_

**Example:** `GET /categories/tree?by_category_slug=hand-tools` returns one item, Hand Tools, with its 7 sub-categories. `GET /categories/tree?by_category_slug=hammer` returns `[]` (Hammer is a sub-category). _(verified)_

---

### 4. Get category tree (HTTP QUERY)

Same as `GET /categories/tree`, with the criteria in a JSON body (RFC 10008 `QUERY` method); the body keys are merged into the query string. _(source)_

**Endpoint:** `QUERY /categories/tree`

**Auth:** None _(verified)_

**Request Body:**
```ts
{
  by_category_slug?: string;   // the slug of a top-level category
}
```

**Response:** `200 OK` _(verified)_
Same shape as `GET /categories/tree`, with the header `Accept-Query: application/json`. An empty body `{}` returns the whole tree; `{ "by_category_slug": "power-tools" }` returns one item with 4 sub-categories. _(verified)_

**Error Responses:**
- `415 Unsupported Media Type`: `Content-Type` is not JSON; `{ message: "QUERY requests must use Content-Type: application/json" }` with `Accept: application/json` _(verified)_
- `500 Internal Server Error`: `by_category_slug` sent as an array; suspected bug, same code path as `GET /categories/tree` _(source)_

---

### 5. Get category

Returns one category, top-level or sub-category, with its `sub_categories` (recursive). A sub-category comes back with its `parent_id` and an empty `sub_categories`. _(verified)_

**Endpoint:** `GET /categories/tree/{categoryId}`

**Auth:** None _(verified)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `categoryId` | string | Yes | Category ULID (named `{id}` in the route) |

**Response:** `200 OK` _(verified)_
```ts
CategoryTree
```

**Error Responses:**
- `404 Not Found`: no category with this id; `{ message: "Requested item not found" }` _(verified)_

---

### 6. Search categories

Searches category names, across top-level and sub-categories; each result has its `sub_categories` loaded. Queries of 4 characters or more use a MySQL full-text prefix match (`MATCH(name) AGAINST('<q>*' IN BOOLEAN MODE)`); shorter ones use `LIKE '%<q>%'`. _(source)_ A missing `q` returns every category, not an error. _(verified)_

**Endpoint:** `GET /categories/search`

**Auth:** None _(verified)_

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `q` | string | No | Search term. The spec marks it required, but without it the API returns `200` with all 19 categories. |

**Response:** `200 OK` _(verified)_
```ts
CategoryTree[]   // empty array when nothing matches
```

**Error Responses:**
- `500 Internal Server Error`: `q` sent as an array (`?q[]=x`); `{ message: "Server Error" }`; suspected bug, should be 422 or treated as text _(verified)_

**Example:** `q=saw` (3 characters, `LIKE`) returns Hand Saw and Saw; `q=hand` (4 characters, full-text prefix) returns Hand Tools (with its 7 sub-categories) and Hand Saw. _(verified)_

---

### 7. Search categories (HTTP QUERY)

Same as `GET /categories/search`, with the criteria in a JSON body (RFC 10008 `QUERY` method); the body keys are merged into the query string. _(source)_

**Endpoint:** `QUERY /categories/search`

**Auth:** None _(verified)_

**Request Body:**
```ts
{
  q?: string;   // the spec marks it required; without it every category is returned (same code as GET)
}
```

**Response:** `200 OK` _(verified)_
Same shape as `GET /categories/search`, with the header `Accept-Query: application/json`. `{ "q": "saw" }` returns the same 2 categories as the `GET`. _(verified)_

**Error Responses:**
- `415 Unsupported Media Type`: `Content-Type` is not JSON; `{ message: "QUERY requests must use Content-Type: application/json" }` with `Accept: application/json` _(verified)_
- `500 Internal Server Error`: `q` sent as an array (`{ "q": ["x"] }`); suspected bug, same code path as `GET /categories/search` _(source)_

---

### 8. Update category

Updates a category with the fields sent. No token is needed (see Notes). Despite being `PUT`, no field is required, and the slug has no uniqueness rule: a duplicate is caught by the database instead. _(source)_

**Endpoint:** `PUT /categories/{categoryId}`

**Auth:** None _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `categoryId` | string | Yes | Category ULID |

**Request Body:**
```ts
{
  name?: string;              // max 120, no subscript/superscript characters
  slug?: string;              // max 120, alpha_dash (ASCII); not checked for uniqueness by validation
  parent_id?: string | null;  // an existing category id; null makes it a top-level category
}
```

Validation runs before the category is looked up, so an invalid body on an unknown id gives `422`, not `404`. _(source)_

**Response:** `200 OK` _(source)_
```ts
{ success: true }
```

**Error Responses:**
- `404 Not Found`: no category with this id; `{ message: "Requested item not found" }` _(source)_
- `409 Conflict`: `slug` is already used by another category; the database's unique index rejects it and the global handler answers `{ message: "Duplicate Entry" }` (not a field map) _(source)_
- `422 Unprocessable Entity`: `name` or `slug` longer than 120 characters or not a string, `slug` outside `alpha_dash`, `parent_id` not a string, subscript/superscript characters _(source)_
- `500 Internal Server Error`: `parent_id` is not the id of an existing category (foreign-key error, `{ message: "Something went wrong" }`); suspected bug, should be 422 _(source)_

---

### 9. Partially update category

Updates only the validated fields that are sent (`$request->validated()`). _(source)_

**Endpoint:** `PATCH /categories/{categoryId}`

**Auth:** None _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `categoryId` | string | Yes | Category ULID |

**Request Body:**
```ts
{
  name?: string;              // max 120, no subscript/superscript characters
  slug?: string;              // when sent: not empty, max 120, alpha_dash (ASCII), unique among all categories, including this one
  parent_id?: string | null;  // an existing category id; null makes it a top-level category
}
```

**Response:** `200 OK` _(source)_
```ts
{ success: true }
```

**Error Responses:**
- `404 Not Found`: no category with this id (and the body is valid); `{ message: "Requested item not found" }` _(source)_
- `409 Conflict`: `slug` is already used by a category, including the category being patched: sending its own current slug is refused; `{ slug: [...] }`. Suspected bug for the own-slug case: the `unique` rule doesn't ignore the current category _(source)_
- `422 Unprocessable Entity`: `slug` empty or outside `alpha_dash`, `name` or `slug` too long or not a string, `parent_id` not a string, subscript/superscript characters _(source)_
- `500 Internal Server Error`: `parent_id` is not the id of an existing category (foreign-key error, `{ message: "Something went wrong" }`); suspected bug, should be 422 _(source)_

---

### 10. Delete category

Deletes a category. Admin only. _(source)_

**Endpoint:** `DELETE /categories/{categoryId}`

**Auth:** Bearer token, `admin` role _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `categoryId` | string | Yes | Category ULID |

**Response:** `204 No Content` _(source)_

**Error Responses:**
- `401 Unauthorized`: no token, or an invalid one; `{ message: "Unauthorized" }` _(verified)_
- `403 Forbidden`: the token's user isn't an admin; `{ message: "Forbidden" }` _(source)_
- `404 Not Found`: no category with this id; `{ message: "Requested item not found" }` (asserted by the service's own test) _(source)_
- `409 Conflict`: a product uses the category (foreign key `products.category_id`) or the category has sub-categories (foreign key `categories.parent_id`, no cascade); `{ success: false, message: "Seems like this category is used elsewhere." }` _(source)_

---

## Data Models

### Category

As returned by `GET /categories`. `created_at` and `updated_at` are hidden (`BaseModel`). _(verified)_

```ts
interface Category {
  id: string;               // ULID
  name: string;
  slug: string;
  parent_id: string | null; // null for a top-level category
}
```

### CategoryTree

As returned by `GET`/`QUERY /categories/tree`, `GET /categories/tree/{categoryId}` and `GET`/`QUERY /categories/search`: a `Category` with its children loaded recursively. _(verified)_

```ts
interface CategoryTree extends Category {
  sub_categories: CategoryTree[];   // [] for a category without children
}
```

## Enums

None. The seeded categories (`CategorySeeder`) _(verified)_:

| Top-level (slug) | Sub-categories (slug) |
|---|---|
| Hand Tools (`hand-tools`) | Hammer (`hammer`), Hand Saw (`hand-saw`), Wrench (`wrench`), Screwdriver (`screwdriver`), Pliers (`pliers`), Chisels (`chisels`), Measures (`measures`) |
| Power Tools (`power-tools`) | Grinder (`grinder`), Sander (`sander`), Saw (`saw`), Drill (`drill`) |
| Other (`other`) | Tool Belts (`tool-belts`), Storage Solutions (`storage solutions`, with a space), Workbench (`workbench`), Safety Gear (`safety-gear`), Fasteners (`fasteners`) |

## Error Handling

- Errors raised by the framework or the global handler (`app/Exceptions/Handler.php`) have the body `{ message: string }`, e.g. `"Requested item not found"` (unknown id), `"Resource not found"` (unknown route), `"Duplicate Entry"` (a database unique-index violation, `409`), `"Something went wrong"` (other database errors, such as a foreign-key violation, `500`), `"Server Error"` (unhandled PHP errors). _(source)_
- Validation errors from form requests are a map of field to messages, without a wrapper: `{ "name": ["The name field is required."], ... }` (`BaseFormRequest`). When every failing rule is a uniqueness rule (a duplicate `slug` on `POST` or `PATCH`), the status is `409` instead of `422`. _(source)_
- `405 Method Not Allowed`: any method a path has no route for, e.g. `QUERY /categories`, `QUERY /categories/tree/{categoryId}`, `GET /categories/{categoryId}`; `{ message: "Method is not allowed for the requested route" }`. Shared by every route, so it isn't listed per endpoint. _(verified)_
- Framework errors (e.g. `415`) are JSON only when the request sends `Accept: application/json`; otherwise Laravel renders an HTML page (see `Products_API.md`). _(source)_

## Notes

- **No auth on writes:** `POST /categories`, `PUT` and `PATCH /categories/{categoryId}` have no auth middleware (only `destroy` gets `role:admin`) and no security in the spec. Anyone could create categories or rename and re-parent seeded ones. Suspected security bug, the same as Brands; not called live (writes weren't allowed). _(source)_
- **Unknown `parent_id`:** no rule checks that `parent_id` exists, so the foreign key rejects it (MySQL 1452) and the handler's default branch answers `500 { message: "Something went wrong" }` on `POST`, `PUT` and `PATCH`. Suspected bug, like `category_id` on `POST /products`. _(source)_
- **Hierarchy not guarded:** nothing stops `parent_id` from being the category's own id or one of its descendants. A top-level category given a `parent_id` leaves the top level of `GET /categories/tree`. The source doesn't show what the recursive `sub_categories` loading does with a cycle (the API wasn't written to). _(source)_
- **`PATCH` with the category's own slug:** the `unique:categories,slug` rule in `PatchCategory` doesn't exclude the category being patched, so re-sending the current slug returns `409`. Suspected bug (verified for the identical Brands rule). _(source)_
- **`PUT` vs `PATCH` duplicates:** `UpdateCategory` has no uniqueness rule, so a duplicate slug reaches the database and comes back as `409 { message: "Duplicate Entry" }`, while `POST`/`PATCH` return `409 { slug: [...] }`. _(source)_
- **Seeded slug with a space:** Storage Solutions has the slug `storage solutions`, which the API's own `alpha_dash` rule would refuse. A client that sends it back unchanged on `PUT` or `PATCH` gets `422` (on `PATCH` the uniqueness rule fails too). `by_category_slug=storage solutions` isn't useful anyway (it's a sub-category). _(source)_
- **Length limits:** validation allows 120 characters for `name` and `slug`; the database columns hold 220. _(source)_
- **Delete edge case:** `destroy` catches only `QueryException` with SQLSTATE `23000` (→ `409`); any other database error falls through the `catch` without a return, so Laravel would send an empty `200`. Not triggerable on purpose. _(source)_
- **`/tree` and `/search` overlap `/{categoryId}`:** `PUT`, `PATCH` and `DELETE /categories/tree` and `/categories/search` match the id routes with `categoryId = "tree"` or `"search"` (→ `404`; `DELETE` needs an admin token first). That's why `OPTIONS` on those paths lists `DELETE, GET, PATCH, PUT, QUERY`. _(source)_ The `Allow` headers are observed. _(verified)_
- **OPTIONS:** every category path answers `OPTIONS` with `204` and an `Allow` header: `GET, POST` for `/categories`, `DELETE, GET, PATCH, PUT, QUERY` for `/categories/tree` and `/categories/search`, `GET` for `/categories/tree/{categoryId}`, `DELETE, PATCH, PUT` for `/categories/{categoryId}`. Not in the spec. _(verified)_
- **Caching:** the `GET` routes send `Cache-Control: max-age=120, public` and an `ETag`, and a matching `If-None-Match` gets `304` _(verified)_; the `QUERY` routes send `Cache-Control: no-cache, private` _(verified)_. Server-side, `CategoryService` caches the list, the whole tree, each `by_category_slug` tree, each category (`categories.{id}`, with its sub-categories) and each search term for 1 hour. Create clears only the list and the whole tree; update and delete clear the list, the whole tree and that category's own entry. None of them clears the per-slug trees, the search entries or the parent's entry, so after a sub-category is created, changed or deleted, `GET /categories/tree/{parentId}`, `?by_category_slug=<parent slug>` and earlier search terms can show stale data for up to an hour. Use fresh records and search terms in tests. _(source)_
- **XML:** with `Accept: text/xml`, responses are rendered as XML (`<response><id>...`) instead of JSON (`Controller::preferredFormat`). _(verified)_
- **Spec vs source** (the annotations in `CategoryController` and `Category`, which generate the published spec): `CategoryRequest` has no `required` list, but `POST` requires `name` and `slug`; `q` is marked required on both search endpoints but is optional; `404` is listed on `GET /categories`, `GET /categories/tree`, `GET /categories/search` and `POST /categories`, which can't return it; `405` is listed on every `GET`/`POST`/`PUT`/`PATCH`/`DELETE` operation (it's router-wide); `DELETE` lists `422`, which it can't return (its only rule checks the route's `id`, which is always present), and doesn't list `403`; the `409` on `PUT` is described as a field map or a message, but `PUT` has no uniqueness rule and returns only `{ message: "Duplicate Entry" }`; no operation lists the `500` for an unknown `parent_id`; the path parameter example is `1`, but ids are ULIDs. The code wins in this contract. _(source)_
