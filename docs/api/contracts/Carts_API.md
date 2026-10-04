# Carts API Documentation

Anonymous shopping carts in the Toolshop API. The UI creates a cart when the first product is added and keeps its id in `sessionStorage['cart_id']`.

> Started by hand on 2026-10-04 with the one endpoint the tests call (UI-002's cleanup), from the Laravel source (`sprint5/API`). The rest of the area (create, add, update quantity, get, remove a product) isn't documented yet: run `/write-api-contracts` for `carts` to fill it in.

## Base URL

`https://api.practicesoftwaretesting.com` (see `apiBaseUrl` in `src/envs/<ENV>.json`).

## Authentication

- None: every carts endpoint is public; whoever knows a cart id can change it. _(source)_

## Endpoints Overview

| Method | Path | Description | Auth |
|---|---|---|---|
| DELETE | `/carts/{cartId}` | Delete a cart with its items | None |

### 1. Delete cart

**Endpoint:** `DELETE /carts/{cartId}`

Deletes the cart's items, then the cart. A product can't be deleted while a cart item points to it (`DELETE /products/{productId}` returns `409`), so remove the cart first. _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `cartId` | string (ULID) | Yes | The cart's id |

**Response:** `204 No Content` _(source)_

**Error Responses:**
- `404 Not Found`: no cart with this id, with `{ message: "Cart doesnt exists" }` _(source)_
