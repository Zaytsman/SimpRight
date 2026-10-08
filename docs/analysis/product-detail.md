# Product detail

<!-- Written by the requirements-analyst agent (/analyze-requirements). Source: docs/ui/user-stories/Product_Detail.md -->

| | |
|---|---|
| **Source** | [Product_Detail.md](../ui/user-stories/Product_Detail.md) |
| **Type** | User story |
| **Criteria in scope** | AC3-AC9 |
| **Analysed** | 2026-10-08 |

## Summary

A visitor wants to see a product's details, add it to the cart or save it to favourites. AC3-AC9 cover the quantity and the cart. An in-stock product shows a quantity field with + and - buttons that starts at 1. Plus adds 1; minus takes 1 away but never goes below 1. A typed value is used, kept between 1 and 999,999,999. "Add to Cart" adds the product with the chosen quantity and shows "Product added to shopping cart."; an out-of-stock product that isn't a rental can't be added and shows "Out of stock" in red.

## Acceptance criteria

- **AC3 – Quantity selector**: Given an in-stock product, when its page opens, then a quantity field with + and - buttons is shown and the quantity is 1.
- **AC4 – Increase quantity**: Given the quantity field is shown, when I click +, then the quantity goes up by 1.
- **AC5 – Decrease quantity**: Given the quantity is more than 1, when I click -, then the quantity goes down by 1.
- **AC6 – Minimum quantity**: Given the quantity is 1, when I click -, then the quantity stays at 1.
- **AC7 – Manual quantity entry**: Given the quantity field is shown, when I type a number, then the quantity becomes that number, kept between 1 and 999,999,999.
- **AC8 – Add to cart**: Given a valid quantity, when I click "Add to Cart", then the product is added to the cart with that quantity and "Product added to shopping cart." is shown.
- **AC9 – Out of stock**: Given a product that is out of stock and not a rental, then "Add to Cart" is disabled and "Out of stock" is shown in red.

## What it touches

- **API:** `POST /carts`, `POST /carts/{cartId}` (add an item: `product_id`, `quantity`) and `GET /carts/{cartId}` ([Carts_API.md](../api/contracts/Carts_API.md) §1-3); `DELETE /carts/{cartId}` for cleanup (§6); `GET /products/{productId}` for `in_stock` and `is_rental` ([Products_API.md](../api/contracts/Products_API.md) §4); `POST /products` and `DELETE /products/{productId}` for setup and cleanup (§3, §7).
- **UI:** the product page (`/product/<id>`), the cart page.
- **Data:** an in-stock product that isn't a rental (not "Thor Hammer", which the server limits to 1 per cart); an out-of-stock product that isn't a rental; an anonymous cart (created by every add to cart, removed with `DELETE /carts/{cartId}`).

## Test plan

API first: a check goes to the UI only when the API can't prove it ([layer rules](../../.claude/skills/analyze-requirements/references/layer-rules.md)).

| Item | Criterion | What to check | Layer | Why this layer | Flags | Scenarios |
|---|---|---|---|---|---|---|
| T1 | AC3 | An in-stock product shows the quantity field with + and - buttons, and the quantity is 1 | UI | The controls and the starting quantity exist only on the page; nothing is sent until Add to Cart (source) | data | UI-018 (existing) |
| T2 | AC4 | Clicking + raises the quantity from 1 to 2 | UI | The page changes the quantity in the browser and sends nothing (source) | data | UI-019 (existing) |
| T3 | AC5 | With the quantity above 1 (3), clicking - lowers it by 1 (to 2) | UI | The page changes the quantity in the browser and sends nothing (source) | data | UI-020 (existing) |
| T4 | AC6 | With the quantity at 1, clicking - leaves it at 1 | UI | The page enforces the minimum in the browser; nothing is sent (source) | data | UI-021 (existing) |
| T5 | AC7 | A typed number (5) becomes the quantity | UI | Typing changes only the field's state on the page | data | UI-022 (existing) |
| T6 | AC7 | Typing 0 changes the field to 1 (lower clamp) | UI | Only the page corrects the value; the server rejects out-of-range values instead of clamping them (source) | data | UI-023 (existing) |
| T7 | AC7 | Typing 1,000,000,000 changes the field to 999,999,999 (upper clamp) | UI | Only the page clamps (source) | data, known issue | UI-024 (existing) |
| T8 | AC7 | The cart accepts quantity 1, the lower end of the range: `POST /carts/{id}` succeeds and `GET /carts/{id}` shows the item with quantity 1 | API | The server checks the range (`min:1` in `CartController::addItem`, source) | writes, contract gap | API-0114 |
| T9 | AC7 | The cart accepts quantity 999,999,999, the upper end of the range: `POST /carts/{id}` succeeds and `GET /carts/{id}` shows it | API | The server checks the range (`max:99` in `CartController::addItem`, source) | writes, contract gap, known issue | API-0118 |
| T10 | AC7 | Quantities outside the range (0 and 1,000,000,000) aren't added: `POST /carts/{id}` is rejected (422, source) and `GET /carts/{id}` has no such item | API | The server enforces the range; the API proves it more cheaply than the page | writes, contract gap | API-0116, API-0117 |
| T11 | AC8 | Adding a product with quantity 2 (`POST /carts`, then `POST /carts/{id}`) puts it in the cart with quantity 2 (`GET /carts/{id}`) | API | The server stores the cart item | writes, contract gap | API-0115 |
| T12 | AC8 | Journey: on the product page, set quantity 2 and click "Add to cart"; "Product added to shopping cart." is shown and the cart has the product with quantity 2 | UI | The message comes from the page, and only the page connects the chosen quantity to the request | writes | UI-027 (existing), UI-002 (existing) |
| T13 | AC9 | On an out-of-stock product that isn't a rental, "Add to cart" is disabled and "Out of stock" is shown in red | UI | Only the page blocks it; the server adds out-of-stock products to a cart (no stock check in `CartService`, source) | data | UI-015 (existing) |

**Not tested:** none.

**Totals:** 13 items: 4 API, 9 UI (1 journey); 9 already covered by existing scenarios, 5 new API scenarios (API-0114 to API-0118 in [post-carts-by-cart-id.yml](../../test-scenarios/api/carts/post-carts-by-cart-id.yml)).

## Notes

- **AC7's upper bound (the user's decision):** the story stays the requirement (999,999,999). The app limits the quantity to 99 in three places: the field (`MAX_QUANTITY = 99`), the browser's cart service and the server (`max:99`). So T7 and T9 are known issues (UI-024 and UI-025 will fail too).
- **T10 (the user's decision):** kept as the server-side half of the stated range. The 422 comes from the source.
- **Contract gap (filled):** the carts endpoints were missing from the contracts. `/write-api-contracts` documented the whole carts area in [Carts_API.md](../api/contracts/Carts_API.md) on 2026-10-08 (from the source, read-only live checks) before the API scenarios were written. The tests should tag the facts they confirm `_(verified)_`.
- **Scenario areas:** a new area `carts` was added to the profile for the API layer, named after the API path like `products` and `users`; the UI keeps `cart`.
- **UI-025 and UI-026** (the field keeps 999,999,999 and 1) are kept. By the split rule, the range ends now belong to the API (T8, T9), so these two could be dropped later.
- **Could move to the API:** UI-002 checks the quantity in the cart through the cart page, which T11 proves on the API. It stays as part of T12's journey coverage. It has no `ref`; it could get `docs/ui/user-stories/Product_Detail.md#AC8`.
- **Seeded products:** UI-018 to UI-027 use the seeded "Combination Pliers", and UI-015 uses "Long Nose Pliers". Other visitors can change their stock at any time (product writes need no token), hence the `data` flags. Creating the product through the API, as UI-002 does, removes the risk but makes those tests writes.
- **Not tested** (seen in the source, not in the story): adding a product that's already in the cart increases its quantity; Thor Hammer is limited to 1 per cart; the "You can order at most 99 of this product." warning; the quantity controls are disabled when the product is out of stock; a rental without stock keeps "Add to cart" enabled.
- **Sources for the layer decisions:** the app's source (`practice-software-testing/sprint5`, read-only) was used only to decide where each rule is enforced: `CartController::addItem`, `CartService::addItemToCart`, `products/detail/detail.component.ts` and `.html`, `_services/cart.service.ts`. No inspector runs.
