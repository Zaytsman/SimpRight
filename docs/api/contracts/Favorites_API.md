# Favorites API Documentation

A logged-in user's favorite products in the Toolshop API: list the user's favorites, add a product, read one favorite and remove one. Every endpoint needs a token.

> Written on 2026-10-10 from the Laravel source (`sprint5/API`: `routes/api.php`, `FavoriteController`, `FavoriteService`, the `StoreFavorite`/`DestroyFavorite` form requests, the `Favorite` model and its migration, `Authenticate`, `app/Exceptions/Handler.php`, `tests/Feature/FavoriteTest.php`), the OpenAPI spec (`storage/api-docs/api-docs.json`, tag `Favorite`) and read-only calls to the live API (`GET` without a token or with a malformed one; no favorite was read, created or deleted). Facts are tagged by origin.

## Base URL

`https://api.practicesoftwaretesting.com` (see `apiBaseUrl` in `src/envs/<ENV>.json`).

## Authentication

- Scheme: `Authorization: Bearer <JWT>` from `POST /users/login` (see `Users_API.md`). _(source)_
- Every favorites endpoint needs a valid token: `FavoriteController` applies the `auth:users` middleware to all its actions. There is no role check, so customers and admins alike have favorites. _(source)_
- Without a token, or with a malformed or expired token, the endpoints return `401` with `{ message: "Unauthorized" }`. _(verified)_ (seen for both `GET` endpoints; `POST` and `DELETE` share the same middleware _(source)_)
- A restricted token (the intermediate token of the two-factor login flow, with the `restricted` claim) gets `401` with `{ message: "Unauthorized token usage" }`. _(source)_
- **Account state, shared by every endpoint:** a disabled account (`enabled: false`) gets `403` with `{ message: "Account disabled." }`. The middleware caches the user for 60 seconds, so a change can take up to a minute to apply. _(source)_
- Every favorite belongs to the user of the token: `POST` sets `user_id` from the token, `GET /favorites` lists only that user's favorites and `DELETE` only deletes that user's favorites. `GET /favorites/{favoriteId}` doesn't check the owner (see Notes). _(source)_

## Endpoints Overview

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/favorites` | List the current user's favorites, with their products | Any logged-in user |
| POST | `/favorites` | Add a product to the current user's favorites | Any logged-in user |
| GET | `/favorites/{favoriteId}` | Get one favorite by id | Any logged-in user |
| DELETE | `/favorites/{favoriteId}` | Remove one of the current user's favorites | Any logged-in user |

## Data required for successful requests

| Data | Needed by | Requirements |
|---|---|---|
| Access token | every endpoint | A token from `POST /users/login` for an enabled account, any role. The favorites are that user's, so tests that add favorites should use a user whose favorites they own (the run's customer or a throwaway one). |
| Product id (ULID) | `POST /favorites` (`product_id`) | An existing product (`exists:products,id`), e.g. an `id` from `GET /products`. Each product can be a favorite of the same user only once (`409` otherwise). |
| Favorite id (ULID) | `GET /favorites/{favoriteId}`, `DELETE /favorites/{favoriteId}` | The `id` returned by `POST /favorites` or listed by `GET /favorites`. |

## Endpoints

### 1. List favorites

Returns all favorites of the user of the token, each with its product and the product's image. The list isn't paginated. An empty list is `[]`. _(source)_

**Endpoint:** `GET /favorites`

**Auth:** Any logged-in user _(source)_

**Query Parameters:** None

**Response:** `200 OK` _(source)_
```ts
FavoriteWithProduct[]   // see Data Models
```

The service's test asserts that each item has `user_id`, `product_id` and `product`. _(source)_

**Error Responses:**
- `401 Unauthorized`: no token, or a malformed or expired token, with `{ message: "Unauthorized" }` _(verified)_

---

### 2. Add favorite

Adds a product to the favorites of the user of the token. `user_id` is always taken from the token; any other field in the body is ignored (only `user_id` and `product_id` are fillable). _(source)_

**Endpoint:** `POST /favorites`

**Auth:** Any logged-in user _(source)_

**Request Body:**
```ts
{
  product_id: string;   // required; must be an existing product id
}
```

**Response:** `201 Created` _(source)_
```ts
Favorite   // see Data Models; without the product
```

The service's test asserts `201` and the keys `product_id`, `user_id` and `id`. The spec says `200`. _(source)_

**Error Responses:**
- `401 Unauthorized`: no token, or a malformed or expired token, with `{ message: "Unauthorized" }` _(source)_
- `409 Conflict`: the product is already one of this user's favorites; the unique index `user_product_unique` (`user_id`, `product_id`) rejects the insert and the global handler turns the duplicate-key error (MySQL 1062) into `{ message: "Duplicate Entry" }` _(source)_
- `422 Unprocessable Entity`: `product_id` missing or not an existing product id. The body is a map of field to messages without a wrapper (`BaseFormRequest`), e.g. `{ product_id: ["The product id field is required."] }` or `["The selected product id is invalid."]` (framework default messages) _(source)_

**Example:**
```http
POST /favorites
Authorization: Bearer <token>
{ "product_id": "01JPRODUCT0123456789ABCDE" }

201 Created
{ "product_id": "01JPRODUCT0123456789ABCDE", "user_id": "01JUSER00123456789ABCDEFG", "id": "01JFAVORITE123456789ABCDE" }
```

---

### 3. Get favorite

Returns one favorite by id, without its product. _(source)_

**Endpoint:** `GET /favorites/{favoriteId}`

**Auth:** Any logged-in user _(source)_ The favorite's owner isn't checked: any logged-in user can read any favorite whose id they know (see Notes). _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `favoriteId` | string (ULID) | Yes | The favorite's id (named `{id}` in the route) |

**Response:** `200 OK` _(source)_
```ts
Favorite   // see Data Models
```

**Error Responses:**
- `401 Unauthorized`: no token, or a malformed or expired token, with `{ message: "Unauthorized" }` _(verified)_
- `404 Not Found`: no favorite with this id (`findOrFail`), with `{ message: "Requested item not found" }` from the global handler _(source)_

---

### 4. Delete favorite

Removes the favorite with this id if it belongs to the user of the token. _(source)_

**Endpoint:** `DELETE /favorites/{favoriteId}`

**Auth:** Any logged-in user _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `favoriteId` | string (ULID) | Yes | The favorite's id (named `{id}` in the route) |

**Response:** `204 No Content` _(source)_

The delete is a `where user_id = <token user> and id = <favoriteId>` query whose result is ignored, so an unknown id, or another user's favorite, also gives `204` and deletes nothing. `DestroyFavorite` has no rules (the `exists` rule is commented out). _(source)_

**Error Responses:**
- `401 Unauthorized`: no token, or a malformed or expired token, with `{ message: "Unauthorized" }` (the service's test "guests cannot delete favorites" asserts it) _(source)_

## Data Models

### Favorite

Returned by `POST /favorites` and `GET /favorites/{favoriteId}`. `created_at` and `updated_at` are hidden (`BaseModel`). _(source)_

```ts
interface Favorite {
  id: string;          // ULID
  user_id: string;     // ULID of the owner
  product_id: string;  // ULID
}
```

### FavoriteWithProduct

Returned by `GET /favorites`. _(source)_

```ts
interface FavoriteWithProduct extends Favorite {
  product: FavoriteProduct;
}
```

### FavoriteProduct

The product as loaded for a favorite: the `Product` fields of `Products_API.md` with `product_image`, but without `category` and `brand` (those relations aren't loaded). _(source)_

```ts
interface FavoriteProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  is_location_offer: boolean;
  is_rental: boolean;
  co2_rating: string;
  in_stock: boolean;          // a number (stock count) when the caller has an admin token
  is_eco_friendly: boolean;
  product_image: ProductImage; // see Products_API.md
}
```

## Error Handling

- Errors from the auth middleware and the global handler (`app/Exceptions/Handler.php`) have the body `{ message: string }`, e.g. `"Unauthorized"` _(verified)_, `"Requested item not found"`, `"Duplicate Entry"`, `"Method is not allowed for the requested route"` _(source)_.
- Validation errors from `StoreFavorite` (`422`) are a map of field to messages, without a wrapper (`BaseFormRequest`); the status would be `409` only if every failing rule were a uniqueness rule, and `StoreFavorite` has none. _(source)_
- `405 Method Not Allowed`: any method a path has no route for, e.g. `PUT /favorites/{favoriteId}`; `{ message: "Method is not allowed for the requested route" }`. Shared by every route, so it isn't listed per endpoint. _(source)_
- The `401` responses are JSON even without `Accept: application/json` (the middleware builds them itself). _(verified)_

## Notes

- **Reading other users' favorites:** `GET /favorites/{favoriteId}` loads the favorite with `Favorite::findOrFail($id)` and no owner condition, while the list and the delete are limited to the token's user. Any logged-in user can read another user's favorite (its `user_id` and `product_id`) by id. Suspected bug (should be `404` or `403`). _(source)_
- **Silent delete:** `DELETE /favorites/{favoriteId}` returns `204` for an unknown id and for another user's favorite, so a client can't tell whether anything was removed. Possibly intended (idempotent delete), but the spec documents a `404`. _(source)_
- **Duplicate favorites** depend on the database's unique index, not on validation: the `409` comes from the global handler's duplicate-key branch (MySQL error 1062). _(source)_
- **OPTIONS:** `routes/api.php` defines `OPTIONS` for `/favorites` and `/favorites/{favoriteId}` (the shared `$respondOptions` handler). Not called live. _(source)_
- **XML:** with `Accept: text/xml`, responses are rendered as XML (`Controller::preferredFormat`). _(source)_
- **Cache headers:** the favorites routes have no cache middleware; the `401` responses carry `Cache-Control: no-cache, private`. _(verified)_
- **UpdateFavorite:** a form request `UpdateFavorite` (`name`, `slug`) exists in the source, but no route uses it; there is no update endpoint. _(source)_
- **OpenAPI spec vs source:**
  - `POST /favorites`: the spec documents `200`; the handler returns `201` (asserted by the service's test). The spec's `404` can't happen; its `409` and `422` match the code. The request body is described as "Brand request object", and `FavoriteRequest` doesn't mark `product_id` required, while the code requires it.
  - `GET /favorites`: the spec's `404` can't happen (an empty list is `200`).
  - `DELETE /favorites/{favoriteId}`: the spec lists `404`, `409` and `422`, which the handler can't return (no validation rules, delete result ignored).
  - `GET /favorites/{favoriteId}`: the spec's example id is `1`; ids are ULIDs. Its `FavoriteResponse` matches the code.
  - Every operation lists `405`, which is the framework-wide response (see Error Handling).
  - The spec's descriptions say "User role is required"; the code accepts any logged-in user, admins included.
  _(source)_
