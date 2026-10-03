# Products API Documentation

The product catalogue of the Toolshop API: listing, filtering, searching and reading products, plus creating, updating and deleting them.

> Built from the OpenAPI spec (Toolshop API 5.0.0), the Laravel source (`sprint5/API`) and read-only calls to the live API on 2026-10-01; facts are tagged by origin.

## Base URL

`https://api.practicesoftwaretesting.com` (see `apiBaseUrl` in `src/envs/<ENV>.json`).

## Authentication

- Scheme: `Authorization: Bearer <JWT>`. Get a token with `POST /users/login` (see `Users_API.md`). _(source)_
- Only `DELETE /products/{productId}` checks a token: it requires the `admin` role (`role:admin` middleware in `ProductController`). Every other product endpoint, including create and update, accepts requests without a token. _(source)_
- A token changes one response field: with an admin token, `in_stock` is the stock count (a number) instead of a boolean (`Product::getInStockAttribute`, `ProductPolicy::viewStock`). _(verified)_

## Endpoints Overview

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/products` | List products (filters, sorting, pagination) | None |
| QUERY | `/products` | List products, criteria in a JSON body | None |
| POST | `/products` | Create a product | None |
| GET | `/products/{productId}` | Get one product | None |
| PUT | `/products/{productId}` | Update a product | None |
| PATCH | `/products/{productId}` | Partially update a product | None |
| DELETE | `/products/{productId}` | Delete a product | Admin |
| GET | `/products/{productId}/related` | Products in the same category | None |
| GET | `/products/search` | Search products by name | None |
| QUERY | `/products/search` | Search products, criteria in a JSON body | None |

## Data required for successful requests

| Data | Needed by | Requirements |
|---|---|---|
| Product id (ULID) | `GET`/`PUT`/`PATCH`/`DELETE /products/{productId}`, `/related` | An existing product, e.g. the `id` of an item from `GET /products`. |
| Admin token | `DELETE /products/{productId}` | A token from `POST /users/login` for a user whose `role` is `admin`. |
| Brand id | `POST /products` (`brand_id`), filter `by_brand` | An existing brand id (Brands API). An unknown id makes `POST` fail with `500`. |
| Category id | `POST /products` (`category_id`), filter `by_category` | An existing category id (Categories API). An unknown id makes `POST` fail with `500`. |
| Product image id | `POST /products` (`product_image_id`) | An existing product image id (Images API). |
| A product nobody references | `DELETE /products/{productId}` | A product used in an invoice line (or other foreign key) can't be deleted (`409`). Create a throw-away product first. |

## Endpoints

### 1. List products

Returns the products, 9 per page. Without `is_rental`, rental products are excluded (`is_rental` defaults to false). _(verified)_

**Endpoint:** `GET /products`

**Auth:** None _(verified)_

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `by_brand` | string | No | Brand id, or several ids separated by commas |
| `by_category` | string | No | Category id, or several ids separated by commas |
| `by_category_slug` | string | No | Category slug; also matches its direct sub-categories. In the source, not in the spec. |
| `is_rental` | string | No | `true` or `1` returns only rentals; anything else, or no value, returns only non-rentals |
| `between` | string | No | Range filter, e.g. `price,10,30` |
| `sort` | string | No | `<column>,<asc\|desc>`, e.g. `name,asc` or `price,desc` |
| `eco_friendly` | string | No | `true` or `1`: only products with CO2 rating A or B. In the source, not in the spec. |
| `q` | string | No | Name contains this text. In the source, not in the spec. |
| `by_spec` | string | No | Spec filter, `name:value1\|value2,name2:value3`. In the source, not in the spec. |
| `page` | integer | No | Page number, starting at 1 |

**Response:** `200 OK` _(verified)_
```ts
{
  current_page: number;
  data: Product[];        // up to 9; category has id, name, slug
  from: number | null;
  last_page: number;
  per_page: number;
  to: number | null;
  total: number;
}
```

**Error Responses:**
- `500 Internal Server Error`: `sort` names a column that doesn't exist (`sort=no_such_column,asc`); suspected bug, should be 400/422 or ignored _(verified)_

**Example:** `GET /products?by_category=<categoryId>&sort=price,asc&page=2`. An unknown `by_category` id returns `200` with an empty `data` array. _(verified)_

---

### 2. List products (HTTP QUERY)

Same as `GET /products`, but the criteria are sent as a JSON body (RFC 10008 `QUERY` method). The body keys are merged into the query string, so the results equal the `GET` with the same parameters. _(source)_

**Endpoint:** `QUERY /products`

**Auth:** None _(verified)_

**Request Body:**
```ts
{
  by_brand?: string;
  by_category?: string;
  by_category_slug?: string;
  is_rental?: string;
  between?: string;
  sort?: string;
  eco_friendly?: string;
  q?: string;
  by_spec?: string;
  page?: string;
}
```

**Response:** `200 OK` _(verified)_
Same shape as `GET /products`. The response has the header `Accept-Query: application/json`. _(verified)_

**Error Responses:**
- `415 Unsupported Media Type`: `Content-Type` is not JSON; `{ message: "QUERY requests must use Content-Type: application/json" }` with `Accept: application/json`, an HTML page without it _(verified)_
- `500 Internal Server Error`: `sort` names a column that doesn't exist; suspected bug, same code path as `GET /products` _(source)_

**Example:**
```http
QUERY /products
Content-Type: application/json
Accept: application/json

{ "sort": "name,asc" }
```

---

### 3. Create product

Creates a product. No token is needed (see Notes). _(source)_

**Endpoint:** `POST /products`

**Auth:** None _(source)_

**Request Body:**
```ts
{
  name: string;               // max 120, no subscript/superscript characters
  description?: string;       // max 1250, no subscript/superscript characters
  price: number;
  category_id: string;        // existing category id
  brand_id: string;           // existing brand id
  product_image_id: string;   // existing product image id
  is_location_offer: boolean;
  is_rental: boolean;
  co2_rating?: string;        // not validated; stored as sent
  stock?: number;             // not validated; stored as sent
}
```

**Response:** `201 Created` _(source)_
```ts
Product   // with product_image, category and brand loaded
```

**Error Responses:**
- `422 Unprocessable Entity`: a required field is missing or a field fails its rule; body `{ <field>: string[] }` _(source)_
- `500 Internal Server Error`: `category_id`, `brand_id` or `product_image_id` doesn't exist (the foreign-key error isn't validated first); suspected bug, should be 422 _(source)_

---

### 4. Get product

Returns one product with its category (including `parent_id`), brand, image and specs. _(verified)_

**Endpoint:** `GET /products/{productId}`

**Auth:** None _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `productId` | string | Yes | Product ULID |

**Response:** `200 OK` _(verified)_
```ts
Product & {
  category: { id: string; name: string; slug: string; parent_id: string | null };
  specs: ProductSpec[];
}
```

**Error Responses:**
- `404 Not Found`: no product with this id; `{ message: "Requested item not found" }` _(verified)_

---

### 5. Update product

Updates a product with the fields sent. No token is needed (see Notes). Despite being `PUT`, no field is required. _(source)_

**Endpoint:** `PUT /products/{productId}`

**Auth:** None _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `productId` | string | Yes | Product ULID |

**Request Body:**
```ts
{
  name?: string;              // max 120
  description?: string;       // max 1250
  price?: number;             // not validated
  category_id?: string;       // not validated
  brand_id?: string;          // not validated
  product_image_id?: string;  // not validated
  is_location_offer?: boolean;
  is_rental?: boolean;
  co2_rating?: string;        // not validated
  stock?: number;             // not validated
}
```

**Response:** `200 OK` _(verified)_
```ts
{ success: true }
```

**Error Responses:**
- `404 Not Found`: no product with this id; `{ message: "Requested item not found" }` _(verified)_
- `422 Unprocessable Entity`: `name` or `description` too long or not a string, or `is_location_offer`/`is_rental` not a boolean _(verified)_

---

### 6. Partially update product

Updates only the validated fields that are sent. Unlike `PUT`, fields without a rule (`co2_rating`, `stock`) are dropped. _(source)_

**Endpoint:** `PATCH /products/{productId}`

**Auth:** None _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `productId` | string | Yes | Product ULID |

**Request Body:**
```ts
{
  name?: string;              // max 120
  description?: string;       // max 1250
  price?: number;
  category_id?: string;
  brand_id?: string;
  product_image_id?: string;
  is_location_offer?: boolean;
  is_rental?: boolean;
}
```

**Response:** `200 OK` _(source)_
```ts
{ success: true }
```

**Error Responses:**
- `404 Not Found`: no product with this id _(source)_
- `422 Unprocessable Entity`: a sent field fails its rule (e.g. `price` not numeric) _(source)_

---

### 7. Delete product

Deletes a product. Admin only. _(source)_

**Endpoint:** `DELETE /products/{productId}`

**Auth:** Bearer token, `admin` role _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `productId` | string | Yes | Product ULID |

**Response:** `204 No Content` _(source)_

**Error Responses:**
- `401 Unauthorized`: no token, or an invalid or expired one; `{ message: "Unauthorized" }` _(source)_
- `403 Forbidden`: the token's user isn't an admin; `{ message: "Forbidden" }` _(source)_
- `404 Not Found`: no product with this id; `{ message: "Requested item not found" }` _(source)_
- `409 Conflict`: the product is referenced elsewhere (e.g. an invoice line); `{ success: false, message: "Seems like this product is used elsewhere." }` _(source)_

---

### 8. Get related products

Returns up to 10 other products from the same category as the given product. _(verified)_

**Endpoint:** `GET /products/{productId}/related`

**Auth:** None _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `productId` | string | Yes | Product ULID |

**Response:** `200 OK` _(verified)_
```ts
Array<Omit<Product, 'co2_rating'>>   // category has id and name only; no co2_rating field
```

**Error Responses:**
- `500 Internal Server Error`: no product with this id; `{ message: "Server Error" }`; suspected bug, should be 404 _(verified)_

---

### 9. Search products

Searches product names. Returns 9 per page. Special characters are stripped from `q`; an empty or missing `q` returns an empty page, not an error. _(verified)_

**Endpoint:** `GET /products/search`

**Auth:** None _(source)_

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `q` | string | No | Search term. The spec marks it required, but without it the API returns `200` with an empty `data` array. |
| `page` | integer | No | Page number, starting at 1 |

**Response:** `200 OK` _(verified)_
```ts
{
  current_page: number;
  data: Product[];        // category has id and name only
  from: number | null;    // null when there are no results
  last_page: number;
  per_page: number;
  to: number | null;
  total: number;
}
```

---

### 10. Search products (HTTP QUERY)

Same as `GET /products/search`, with the criteria in a JSON body. _(source)_

**Endpoint:** `QUERY /products/search`

**Auth:** None _(verified)_

**Request Body:**
```ts
{
  q?: string;     // without it the result is empty
  page?: string;
}
```

**Response:** `200 OK` _(verified)_
Same shape as `GET /products/search`, with the header `Accept-Query: application/json`. _(verified)_

**Error Responses:**
- `415 Unsupported Media Type`: `Content-Type` is not JSON _(verified)_

---

## Data Models

### Product

As returned by `GET /products`. _(verified)_

```ts
interface Product {
  id: string;                 // ULID
  name: string;
  description: string;
  price: number;
  is_location_offer: boolean;
  is_rental: boolean;
  co2_rating: string;
  in_stock: boolean;          // a number (stock count) when the caller has an admin token
  is_eco_friendly: boolean;   // true when co2_rating is A or B
  product_image: ProductImage;
  category: { id: string; name: string; slug: string };
  brand: { id: string; name: string };
}
```

### ProductImage

```ts
interface ProductImage {
  id: string;
  by_name: string;
  by_url: string;
  source_name: string;
  source_url: string;
  file_name: string;
  title: string;
}
```

### ProductSpec

Returned in `specs` by `GET /products/{productId}`. _(verified)_

```ts
interface ProductSpec {
  id: string;
  product_id: string;
  spec_name: string;
  spec_value: string;
  spec_unit: string | null;
}
```

## Enums

- `sort` direction: `asc`, `desc`. _(spec)_
- `co2_rating`: `A` and `B` count as eco-friendly (case-insensitive); the source doesn't restrict the other values. _(source)_

## Error Handling

- Errors raised by the framework or the global handler (`app/Exceptions/Handler.php`) have the body `{ message: string }`, e.g. `"Requested item not found"` (unknown id), `"Resource not found"` (unknown route), `"Method is not allowed for the requested route"`, `"Server Error"`. _(source)_
- Validation errors from form requests (`422`) are a map of field to messages, without a wrapper: `{ "name": ["The name field is required."], ... }` (`BaseFormRequest`). When every failing rule is a uniqueness rule the status is `409` instead (no product rule is a uniqueness rule). _(source)_
- `405 Method Not Allowed`: any method a path has no route for, e.g. `QUERY /products/{productId}`; `{ message: "Method is not allowed for the requested route" }`. Shared by every route, so it isn't listed per endpoint. _(verified)_
- Framework errors (e.g. `415`) are JSON only when the request sends `Accept: application/json`; otherwise Laravel renders an HTML page. _(verified)_

## Notes

- **No auth on writes:** `POST`, `PUT` and `PATCH /products` accept requests without a token (no auth middleware in `ProductController`, and the spec has no security on them either). Anyone can create or change products. Suspected security bug. _(source)_
- **Spec vs source:** the spec documents `200` for `POST /products`, the handler returns `201`; the spec lists `404`/`405` on the list and search endpoints and `422` on `DELETE`, which these handlers can't return. _(source)_
- **Related products:** the query doesn't select `co2_rating`, so the field is missing and `is_eco_friendly` is always `false` in `/related`. Suspected bug. _(source)_
- **Caching:** `GET` routes send `Cache-Control: max-age=120, public` and an `ETag` _(verified)_; a request with a matching `If-None-Match` gets `304 Not Modified` (Laravel `cache.headers` middleware) _(source)_. Server-side, product lists and details are cached for 5 minutes, so a change may not show up immediately in `GET` responses. _(source)_
- **OPTIONS:** every product path answers `OPTIONS` with `204` and an `Allow` header listing its methods, e.g. `GET, POST, QUERY` for `/products` and `DELETE, GET, PATCH, PUT` for `/products/{productId}`. Not in the spec. _(verified)_
- **XML:** with `Accept: text/xml`, most product responses are rendered as XML instead of JSON (`Controller::preferredFormat`). _(source)_
- Product specs (`/products/{productId}/specs`) are a separate area (spec tag "Product Spec") and aren't documented here.
