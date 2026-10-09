# Carts API Documentation

Anonymous shopping carts in the Toolshop API: create a cart, add products, change a product's quantity, read the cart, remove a product and delete the cart. The UI creates a cart when the first product is added and keeps its id in `sessionStorage['cart_id']`.

> Started by hand on 2026-10-04 with `DELETE /carts/{cartId}` (UI-002's cleanup); the rest of the area was added on 2026-10-08 from the Laravel source (`sprint5/API`: `routes/api.php`, `CartController`, `CartService`, the `Cart`/`CartItem` models, `tests/Feature/CartTest.php`) and read-only calls to the live API (`GET` and `OPTIONS` only; no cart was created or changed). Facts are tagged by origin.

## Base URL

`https://api.practicesoftwaretesting.com` (see `apiBaseUrl` in `src/envs/<ENV>.json`).

## Authentication

- None: every carts endpoint is public; whoever knows a cart id can read and change it. `CartController` has no auth middleware. _(source)_ `GET /carts/{cartId}` answers without a token. _(verified)_
- A token, when sent, is ignored by the carts handlers; it only changes how products inside the cart are serialized (`in_stock` is the stock count for an admin token, see `Products_API.md`). _(source)_

## Endpoints Overview

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/carts` | Create a cart | None |
| POST | `/carts/{cartId}` | Add a product to a cart (or increase its quantity) | None |
| GET | `/carts/{cartId}` | Get a cart with its items and products | None |
| PUT | `/carts/{cartId}/product/quantity` | Set the quantity of a product in a cart | None |
| DELETE | `/carts/{cartId}/product/{productId}` | Remove a product from a cart | None |
| DELETE | `/carts/{cartId}` | Delete a cart with its items | None |

## Data required for successful requests

| Data | Needed by | Requirements |
|---|---|---|
| Cart id (ULID) | every endpoint except `POST /carts` | The `id` returned by `POST /carts`. Carts are never listed, so a test must create its own (and delete it afterwards). |
| Product id (ULID) | `POST /carts/{cartId}`, `PUT /carts/{cartId}/product/quantity` (`product_id`) | An existing product (`exists:products,id`), e.g. an `id` from `GET /products`. An unknown id gives `422`. |
| Quantity | `POST /carts/{cartId}`, `PUT /carts/{cartId}/product/quantity` | An integer from 1 to 99. |
| A product that isn't "Thor Hammer" | quantities above 1 | The product named exactly `Thor Hammer` (seeded) is limited to one per cart. The rule matches the name, so a product created with that name gets the same limit. |
| Coordinates (optional) | `POST /carts` (`lat`, `lng`) | Only needed for the location discount: within 2 degrees of one of the cities listed under Enums. |

## Endpoints

### 1. Create cart

Creates an empty cart and returns its id. The optional coordinates are stored on the cart and later decide the location discount of the items added to it. Nothing is validated. _(source)_

**Endpoint:** `POST /carts`

**Auth:** None _(source)_

**Request Body:**
```ts
{
  lat?: number;   // latitude; stored as a decimal, no validation
  lng?: number;   // longitude; stored as a decimal, no validation
}
```

An empty body (or none) is fine (`CartTest`: "create cart without coordinates"). Any other field is ignored (`$request->only(['lat', 'lng'])`). _(source)_

**Response:** `201 Created` _(source)_
```ts
{
  id: string;   // ULID of the new cart
}
```

The handler has no error branch of its own. The source doesn't show what happens with a non-numeric `lat`/`lng` (the columns are `decimal`; the database may reject the value, which the global handler would turn into a `500`).

---

### 2. Add item to cart

Adds a product to the cart. When the product is already in the cart, its quantity is **increased** by `quantity` (`firstOrCreate` + `increment`); no second line is created. _(source)_ The service's own test adds 2 to an item with quantity 1 and expects 3. _(source)_

**Endpoint:** `POST /carts/{cartId}`

**Auth:** None _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `cartId` | string (ULID) | Yes | The cart's id (named `{id}` in the route) |

**Request Body:**
```ts
{
  product_id: string;   // required; must be an existing product id
  quantity: number;     // required; integer, min 1, max 99
}
```

Validation runs before the cart is looked up, so a bad body on an unknown cart gives `422`, not `404`. _(source)_ The handler also reads `lat` and `lng` from the body and passes them to the service, which ignores them: the discount uses the cart's coordinates from `POST /carts`. _(source)_

Rules worth testing _(source)_:
- **Quantity per request:** 1 to 99. The limit applies to each request only: the running total isn't checked, so adding 99 twice gives a quantity of 198 (`increment` without a cap).
- **Thor Hammer:** for the product named `Thor Hammer`, a `quantity` above 1, or adding it when it's already in the cart, fails with `400` and `"You can only have one Thor Hammer in the cart."`. Adding it once with `quantity: 1` creates the line with quantity 1.
- **No stock check:** neither the controller nor the service looks at the product's stock, so out-of-stock products can be added.
- **Discounts:** after each add, the cart's `additional_discount_percentage` becomes `15` when the cart holds both a rental and a non-rental product, otherwise `null`. When the cart has non-zero `lat` and `lng`, the added item's `discount_percentage` is set from the city table (see Enums; `0` when no city matches).

**Response:** `200 OK` _(verified)_
```ts
{
  result: "item added or updated";
}
```

The response has no ids: read the cart (`GET /carts/{cartId}`) to see the item's `id` and quantity. _(source)_

**Error Responses:**
- `400 Bad Request`: a Thor Hammer rule is broken (quantity above 1, or already in the cart), with `{ message: "You can only have one Thor Hammer in the cart." }`; any other unexpected exception in the service also becomes a `400` with its message _(source)_
- `404 Not Found`: no cart with this id, with `{ message: "Cart not found" }` _(source)_
- `422 Unprocessable Entity`: `product_id` missing, not a string or not an existing product; `quantity` missing or not an integer. Framework default body `{ message, errors }` (see Error Handling) _(source)_; `quantity` below 1 or above 99 _(source)_; `quantity` 0 and 1,000,000,000 give it with a `quantity` key in `errors` _(verified)_

**Example:**
```http
POST /carts/01JABCDEF0123456789ABCDEFG
{ "product_id": "01JPRODUCT0123456789ABCDE", "quantity": 2 }

200 OK
{ "result": "item added or updated" }
```

---

### 3. Get cart

Returns the cart with its items, each with its product. For an item with a non-zero `discount_percentage`, `discounted_price` is added: the product price minus the discount, rounded to 2 decimals. _(source)_

**Endpoint:** `GET /carts/{cartId}`

**Auth:** None _(verified)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `cartId` | string (ULID) | Yes | The cart's id (named `{id}` in the route) |

**Response:** `200 OK` _(verified)_
```ts
Cart   // see Data Models
```

The route has no cache headers (`Cache-Control: no-cache, private`), unlike the product routes. _(verified)_

**Error Responses:**
- `404 Not Found`: no cart with this id (also for a malformed id such as `abc`), with `{ message: "Requested item not found" }` from the global handler _(verified)_

---

### 4. Update item quantity

Sets (replaces) the quantity of a product that is in the cart. _(source)_

**Endpoint:** `PUT /carts/{cartId}/product/quantity`

**Auth:** None _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `cartId` | string (ULID) | Yes | The cart's id (named `{id}` in the route) |

**Request Body:**
```ts
{
  product_id: string;   // required; must be an existing product id
  quantity: number;     // required; integer, min 1, max 99
}
```

Rules worth testing _(source)_:
- The quantity is set, not added (`update(['quantity' => $quantity])`).
- When the product exists but isn't in the cart, nothing changes and the response is still `200` with the same body (the service's `false` result is ignored).
- **Thor Hammer:** a `quantity` above 1 fails with `400` and `"You can only have one Thor Hammer in the cart."`.
- Validation runs before the cart is looked up. Discounts aren't recalculated.

**Response:** `200 OK` _(source)_
```ts
{
  result: "item added or updated";
}
```

**Error Responses:**
- `400 Bad Request`: Thor Hammer with a quantity above 1, with `{ message: "You can only have one Thor Hammer in the cart." }`; any other unexpected exception in the service also becomes a `400` with its message _(source)_
- `404 Not Found`: no cart with this id, with `{ message: "Cart doesn't exist" }` _(source)_
- `422 Unprocessable Entity`: `product_id` missing, not a string or not an existing product; `quantity` missing, not an integer, below 1 or above 99. The service's tests assert e.g. `{ errors: { quantity: ["The quantity field is required."] }, message: "The quantity field is required." }` and `"The quantity field must be an integer."` _(source)_

---

### 5. Remove product from cart

Deletes the cart's line for this product and recalculates the cart's combined (rental + product) discount. _(source)_

**Endpoint:** `DELETE /carts/{cartId}/product/{productId}`

**Auth:** None _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `cartId` | string (ULID) | Yes | The cart's id |
| `productId` | string (ULID) | Yes | The product's id (not the cart item's id) |

**Response:** `204 No Content` _(source)_

The product id isn't checked: an unknown product, or one that isn't in the cart, also gives `204` (`CartTest`: "product not found in cart"). _(source)_

**Error Responses:**
- `404 Not Found`: no cart with this id, with `{ message: "Cart doesnt exists" }` _(source)_

---

### 6. Delete cart

**Endpoint:** `DELETE /carts/{cartId}`

Deletes the cart's items, then the cart. A product can't be deleted while a cart item points to it (`DELETE /products/{productId}` returns `409`), so remove the cart first. _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `cartId` | string (ULID) | Yes | The cart's id |

**Response:** `204 No Content` _(source)_

**Error Responses:**
- `404 Not Found`: no cart with this id, with `{ message: "Cart doesnt exists" }` _(source)_

## Data Models

### Cart

Returned by `GET /carts/{cartId}`. `created_at` and `updated_at` are hidden (`BaseModel`). _(source)_

```ts
interface Cart {
  id: string;                                    // ULID
  additional_discount_percentage: number | null; // 15 when the cart holds a rental and a non-rental product, else null
  lat: number | null;
  lng: number | null;
  cart_items: CartItem[];
}
```

### CartItem

```ts
interface CartItem {
  id: string;                          // ULID of the cart line
  quantity: number;
  discount_percentage: number | null;  // location discount; null when the cart has no coordinates, 0 when no city matches
  cart_id: string;
  product_id: string;
  discounted_price?: number;           // only when discount_percentage is non-zero: price * (1 - discount/100), 2 decimals
  product: CartProduct;
}
```

### CartProduct

The product as loaded for a cart: the `Product` fields of `Products_API.md` without `product_image`, `category` and `brand` (those relations aren't loaded). _(source)_

```ts
interface CartProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  is_location_offer: boolean;
  is_rental: boolean;
  co2_rating: string;
  in_stock: boolean;          // a number (stock count) when the caller sends an admin token
  is_eco_friendly: boolean;
}
```

## Enums

- Location discount (`CartService::calculateDiscountPercentage`), applied when the cart's `lat` and `lng` are both within 2 degrees of a city _(source)_:

| City | lat | lng | Discount |
|---|---|---|---|
| New York | 41 | 74 | 5 % |
| Mumbai | 19 | 73 | 10 % |
| Tokyo | 35 | 139 | 15 % |
| Amsterdam | 52 | 5 | 20 % |
| London | 51 | 0 | 25 % |

  New York's real longitude is negative (-74); the table uses +74, so real New York coordinates get no discount (the service's own test "add product to cart no discount location" relies on that). _(source)_

## Error Handling

- Errors raised by the handlers or the global handler (`app/Exceptions/Handler.php`) have the body `{ message: string }`. The carts handlers use three different "not found" messages: `"Cart not found"` (add item), `"Cart doesn't exist"` (update quantity), `"Cart doesnt exists"` (remove product, delete cart); `GET` gets the global `"Requested item not found"` _(verified)_.
- Validation errors (`422`): the carts handlers validate with `$request->validate()`, not a form request, so the body is Laravel's default, unlike the product endpoints: `{ message: string; errors: { [field: string]: string[] } }`, where `message` is the first error (Laravel appends "(and N more errors)" when there are several). Framework default; asserted by the service's tests. Laravel only answers with JSON when the request asks for it (`Accept: application/json`, as the test clients send); otherwise it redirects. _(source)_ Messages for the other rules are Laravel's defaults (no custom language files), e.g. `"The selected product id is invalid."`, `"The quantity field must be at least 1."`, `"The quantity field must not be greater than 99."`. Framework default, not yet seen live. _(source)_
- `405 Method Not Allowed`: any method a path has no route for, e.g. `GET /carts`; `{ message: "Method is not allowed for the requested route" }`. Shared by every route, so it isn't listed per endpoint. _(verified)_

## Notes

- **No auth:** anyone who knows a cart id can read, change or delete the cart. Cart ids are ULIDs, so hard to guess, but the UI stores them in `sessionStorage`. _(source)_
- **OPTIONS:** every carts path answers `OPTIONS` with `204` and an `Allow` header: `POST` for `/carts`, `DELETE, GET, POST` for `/carts/{cartId}`, `DELETE` for `/carts/{cartId}/product/{productId}`, and `DELETE, PUT` for `/carts/{cartId}/product/quantity`. _(verified)_
- **`/product/quantity` overlaps `/product/{productId}`:** `DELETE /carts/{cartId}/product/quantity` matches the remove-product route with `productId = "quantity"`, so it returns `204` (or `404` for an unknown cart) and removes nothing. _(source)_ The `Allow` header above reflects the overlap. _(verified)_
- **Location discount for every product:** the service applies the location discount when `isset($existingItem->product->is_location_offer)`, which is true for `false` as well as `true`, so every product added to a cart with matching coordinates gets the discount, not only location offers. Suspected bug. _(source)_
- **Running total unchecked:** the 1-99 limit applies per request; repeated adds can push a line above 99, while `PUT .../quantity` can't set it there. Possibly unintended. _(source)_
- **Thor Hammer by name:** the one-per-cart rule matches `name === 'Thor Hammer'`; product writes need no token (`Products_API.md`), so the seeded product can be renamed by anyone and the rule then no longer applies to it. _(source)_
- **Generic `400`:** both add and update catch every other exception and return `400` with the exception's message, so unexpected server errors (including database errors) show up as `400`, possibly with an internal message. _(source)_
- **XML:** with `Accept: text/xml`, responses are rendered as XML (`Controller::preferredFormat`). _(source)_
- **OpenAPI annotations vs code** (the annotations in `CartController`, which generate the published spec): `POST /carts` lists `404` and `422`, which it can't return; `POST /carts/{cartId}` doesn't list its `400`; `PUT .../quantity` documents the `UpdateResponse` body `{ success: boolean }` and the `"Resource not found"` 404, while the code returns `{ result: "item added or updated" }` and `"Cart doesn't exist"`; both `DELETE` endpoints list `401`, `409` and `422`, which they can't return; the `CartResponse` schema has only `id`. The code wins in this contract. _(source)_
- The REST endpoints share `CartService` with GraphQL mutations (`AddCartItem`, `UpdateCartItemQuantity`, `RemoveCartItem`), which aren't documented here.
