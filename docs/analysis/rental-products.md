# Rental products

<!-- Written by the requirements-analyst agent (/analyze-requirements). Source: docs/ui/user-stories/Rental_Products.md -->

| | |
|---|---|
| **Source** | [Rental_Products.md](../ui/user-stories/Rental_Products.md) |
| **Type** | User story |
| **Criteria in scope** | AC1-AC5 (all) |
| **Analysed** | 2026-10-10 |

## Summary

A visitor wants to browse the tools that can be rented by the hour. The rentals page (`/rentals`, in the Categories menu) lists the rental products with an image, a name and a description (no price). A rental's product page replaces the quantity buttons with a duration slider (1-10 hours) and shows the total as hourly rate x duration. In the checkout cart a rental line carries a rental label. A rental that is a location offer gets the location discount for a visitor near a supported city. The server decides which products are rentals (the `is_rental` filter) and the cart's location discount; the page does everything the visitor sees: the card list, the slider, the total, the label and the detail page's discount (computed in the browser from `GEO_LOCATION` in localStorage).

## Acceptance criteria

- **AC1 – Rentals page is accessible**: Given I navigate to the rentals page, then a list of all rental products is displayed.
- **AC2 – Rental product display**: Given the rentals page is displayed, then each rental product shows a product image, name and description.
- **AC3 – Rental detail page**: Given I click on a rental product, then the product detail page shows a duration slider (1-10 hours) instead of plus/minus buttons, and the total price is the hourly rate multiplied by the selected duration.
- **AC4 – Rental label in checkout**: Given a rental item is in my cart, then the item is marked with "This is a rental item" in the checkout cart.
- **AC5 – Location-based discount on rentals**: Given a rental product is marked as a location offer and my location matches a supported city, then the location discount is applied to the rental price.

## What it touches

- **API:** `GET /products` and `QUERY /products` with `is_rental` ([Products_API.md](../api/contracts/Products_API.md) §1, §2); `POST /products` (§3) and `DELETE /products/{productId}` (§7) for setup and cleanup; `POST /carts` ([Carts_API.md](../api/contracts/Carts_API.md) §1), `POST /carts/{cartId}` (§2, Discounts), `GET /carts/{cartId}` (§3, CartProduct) and `DELETE /carts/{cartId}` (§6).
- **UI:** the rentals page (`/rentals`, reached through Categories > Rentals), a rental's product page (`/product/<id>`), the checkout cart step (`/checkout`).
- **Data:** the three seeded rentals (Excavator, Bulldozer, Crane); a rental the test creates (`is_rental` true, and `is_location_offer` true for AC5); a cart with coordinates (Amsterdam, lat 52, lng 5); a visitor in London (the existing `visitorInLondonTest` fixture).

## Test plan

API first: a check goes to the UI only when the API can't prove it ([layer rules](../../.claude/skills/analyze-requirements/references/layer-rules.md)).

| Item | Criterion | What to check | Layer | Why this layer | Flags | Scenarios |
|---|---|---|---|---|---|---|
| T1 | AC1 | The rental filter returns only rental products: `GET /products?is_rental=true` and the `QUERY /products` call the page makes (body `{ "is_rental": "true" }`) both give 200, non-empty, every item `is_rental` true | API | The server filters (Products §1, §2) | | API-0006 (existing), API-0066 (existing) |
| T2 | AC1 | A product created with `is_rental` true is in the `is_rental=true` list (found with a unique `q`): the other half of "all rental products", since API-0006 proves only that nothing else is listed | API | The server builds the list (Products §1, §3); the page just shows it | writes | API-0324 |
| T3 | AC1 | Journey: from the home page open Categories, click Rentals; `/rentals` shows the heading "Rentals" and a card for each seeded rental (Excavator, Bulldozer, Crane) | UI | Only the page links the menu to the list and renders the cards; the rule is T1, T2 | data | UI-081 |
| T4 | AC2 | Every item of the rental list has a name, a non-empty description and a product image (with `file_name`), the three fields a card reads | API | The server supplies the card's data (Products §1); API-0002 checks the shape only for the non-rental list | | API-0325 |
| T5 | AC2 | Each rental card on `/rentals` shows an image, the name and a non-empty description | UI | Only the page renders the cards (image, name, description) | data | UI-082 |
| T6 | AC3 | Journey: on `/rentals` click the "Excavator" card; the product page of that rental opens (its name is shown) and shows the duration slider | UI | Navigation from the card to the product page, and the slider, exist only in the page (`detail.component.html` shows it when `is_rental`) | data | UI-083 |
| T7 | AC3 | A rental's page shows a duration slider from 1 to 10 hours and no "Increase quantity" and "Decrease quantity" buttons | UI | The slider range (`floor 1`, `ceil 10`) is a page constant; the server accepts 1-99 for any product | data | UI-016 (existing) |
| T8 | AC3 | The total price equals the hourly rate x the selected duration (3 hours) | UI | The total is computed in the browser (`product.price * quantity`); no endpoint returns a total | data | UI-017 (existing) |
| T9 | AC4 | A rental added to a cart is returned by `GET /carts/{cartId}` with `product.is_rental` true (and a non-rental line with false), the flag the checkout label depends on | API | The server supplies the flag the page reads (Carts §3, CartProduct) | writes | API-0327 |
| T10 | AC4 | Journey: with a rental in the cart, open the checkout page; the rental's line carries the label "This is a rental item", and a non-rental line has none | UI | Only the page renders the label (`item.product.is_rental` in `cart.component.html`) | writes, data, text mismatch | UI-084 |
| T11 | AC5 | A rental that is a location offer, added to a cart created near Amsterdam (lat 52, lng 5), gets `discount_percentage` 20 and `discounted_price` = price x 0.8, rounded to 2 decimals | API | The server sets the cart item's percentage and discounted price (Carts §2 Discounts, §3, Enums) | writes, data | API-0326 |
| T12 | AC5 | For a visitor in London, the product page of a rental that is a location offer shows the badge "-25%", the hourly rate struck through, the discounted hourly rate (75% of the rate), and a total equal to the discounted rate x the duration | UI | The page computes the discount in the browser from `GEO_LOCATION` in localStorage (`DiscountUtil`, `detail.component.ts`); the API only sends `is_location_offer`, and the server rule is T11 | writes, data | UI-085 |

**Not tested:**
- AC1 "all": only page 1 of the list is shown (9 per page, no pagination controls; source). With 3 seeded rentals this is no issue, so it is not checked.
- AC2: the card shows no price (source and inspector). AC5's "applied to the rental price" can't be seen on the rentals page, only on the product page (T12) and in the cart (T11, UI-055).
- AC3 "1-10 hours" as a server rule: the story states it for the slider only; the server accepts 1-99 for a rental too.
- AC5, the other direction: a rental that is not a location offer, or a location that matches no city, gets no discount. The story states only the positive case. API-0246 (BUG-024, non-rental) already names AC5 and the server code is the same for rentals.
- AC5 in the cart for a rental: the line renders like UI-055, with no rental-specific rule.

**Totals:** 12 items: 5 API (T1, T2, T4, T9, T11), 7 UI (T3, T5, T6, T7, T8, T10, T12; one journey per criterion, T7 and T8 being AC3's UI-only items); 3 already covered by existing scenarios (T1, T7, T8); 9 new scenarios: 4 API (API-0324..0327, in `get-products.yml`, `post-carts-by-cart-id.yml` and `get-carts-by-cart-id.yml`) and 5 UI (UI-081..085, in the new `rentals.yml`, `checkout-cart-review.yml` and `product-detail.yml`). Flags: 5 writes (T2, T9, T10, T11, T12), 8 data, 0 dangerous, 0 known issues (T10 may become one), 0 contract gaps.

## Open questions

- **T10, suspected text mismatch (not reproduced live).** The story says "This is a rental item"; the app's translation file says "Item for rent, price per hour" (`pages.checkout.cart.rental-explainer`, a small line under the product name). The inspector can't create a cart, so the live text is unseen. `/report-bug` should reproduce it before any `knownIssue` is written.
- **T12's product.** Whether a seeded rental is a location offer is unknown (product data can't be read with the inspector). T12 creates its own, so the question matters only if the test should avoid the write.

## Notes

- **T10 wording (the user's decision):** T10 expects the story's wording "This is a rental item" and carries the `text mismatch` flag; no `knownIssue` until `/report-bug` reproduces it.
- **Thin API items (the user's decision):** T2, T4, T9 and T11 are kept. T11 runs the same server code as API-0237 (`is_rental` doesn't affect the discount); it differs only in the product's flag.
- **T4 scope (the user's decision, checkpoint 2):** API-0325 ignores products created by tests (names starting with "Product-") in every check, because `description` is optional on `POST /products` and other carts scenarios create rentals without one that stay listed until cleanup. It stays a separate scenario from API-0006, and API-0327 from API-0236.
- **T12 data (the user's decision):** the test creates its own rental with `is_location_offer` true through `POST /products` (no token needed) and removes it with the admin's `DELETE`, after the cart that holds it if any.
- **T12 location (the user's decision):** London (25%) with the `visitorInLondonTest` fixture, or a step that sets `GEO_LOCATION`, as UI-074. T11 uses Amsterdam (20%, as API-0237); both avoid BUG-025 (New York) and BUG-026 (London's server coordinates).
- **T10 cart state (the user's decision):** left to the engineer; the scenario says only "a rental is in the cart". The framework has no helper yet for putting an API-created cart's id into `sessionStorage['cart_id']` (the same open point as UI-049..057).
- **T3 and T5 (the user's decision):** they check the seeded names and the card content, with the `data` flag. The seeded rentals can be renamed or deleted by anyone (open product writes), and tests that create rentals add cards to `/rentals`; with more than 9 rentals the page would hide some.
- **Existing UI-016 and UI-017 (the user's decision):** `docs/ui/user-stories/Rental_Products.md#AC3` is added to their `ref` (as a list, next to Product_Detail.md#AC10), by the UI scenario writer. AC3 duplicates Product_Detail AC10; T6 adds only the click from the rentals page.
- **BUG-024, BUG-025, BUG-026** name this story's AC5 in their `ref`; their scenarios (API-0246, API-0238, API-0289) stay as they are.
- **Page objects needed:** a rentals page object and a `NavBar` action for Categories > Rentals (neither exists), and a rental label getter on `CartPage`.
- **Sources for the layer decisions:** the app's source (`practice-software-testing/sprint5/UI`, read-only): `products/rentals/overview/overview.component.{html,ts}`, `products/detail/detail.component.{html,ts}`, `checkout/cart/cart.component.html`, `_helpers/discount.util.ts`, `_services/product.service.ts`, `assets/i18n/en.json`. Two inspector runs: `/rentals` logged out (3 cards with image, name and description, no price, no pagination), and `/` logged out with `click:nav-categories` then `click:nav-rentals` (lands on `/rentals`).
- **Refs for the scenarios:** `docs/ui/user-stories/Rental_Products.md#AC<n>`.
