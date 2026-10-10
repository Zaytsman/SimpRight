# Checkout cart review

<!-- Written by the requirements-analyst agent (/analyze-requirements). Source: docs/ui/user-stories/Checkout_Cart_Review.md -->

| | |
|---|---|
| **Source** | [Checkout_Cart_Review.md](../ui/user-stories/Checkout_Cart_Review.md) |
| **Type** | User story |
| **Criteria in scope** | AC1-AC8 (all) |
| **Analysed** | 2026-10-10 |

## Summary

A customer wants to review the cart on the first checkout step (`/checkout`, wizard step "Cart") and check the order, discounts included, before going on. The step shows a table of lines (item, quantity, price, line total), lets the customer change a quantity or delete a line, and shows the cart total. A line with a location discount carries a badge and shows the original and the discounted price. A cart with both a rental and a non-rental product gets a 15% additional discount, shown as subtotal, discount amount and final total; removing all rentals or all non-rentals removes it. "Proceed" moves to the next checkout step. The server decides only the discount values; every amount the page shows is computed in the browser, so the API cannot prove the totals.

## Acceptance criteria

- **AC1 – Cart contents displayed**: Given items in the cart, when I open the checkout page, then a table with Item, Quantity, Price, Total and Actions columns is shown.
- **AC2 – Update quantity**: Given I change a line's quantity, then the line total and the cart total are recalculated and "Product quantity updated." is shown.
- **AC3 – Delete item**: Given I click delete on a line, then the line is removed and the cart total is recalculated.
- **AC4 – Empty cart**: Given no items in the cart, then "Your shopping cart is empty" is shown.
- **AC5 – Proceed**: Given at least one item, when I click "Proceed", then I advance to the next checkout step.
- **AC6 – Discount badge on items**: Given a line has a discount, then a discount badge is next to the product name and both the original and the discounted price are shown.
- **AC7 – Combined product discount**: Given a cart with rental and non-rental items, then a 15% additional discount applies to the cart subtotal and the cart shows subtotal, discount amount and final total.
- **AC8 – Combined discount removed**: Given I remove all rental or all non-rental items, then the 15% discount is removed and the total reverts to the regular subtotal.

## What it touches

- **API:** `POST /carts` ([Carts_API.md](../api/contracts/Carts_API.md) §1), `POST /carts/{cartId}` (§2, Discounts), `GET /carts/{cartId}` (§3), `PUT /carts/{cartId}/product/quantity` (§4), `DELETE /carts/{cartId}/product/{productId}` (§5); `POST /products` ([Products_API.md](../api/contracts/Products_API.md)) for test data.
- **UI:** the checkout page (`/checkout`), wizard step 1 "Cart" and the step it leads to (step 2 "Sign in").
- **Data:** a product the test creates (in stock; no `co2_rating`, or one that is not A or B, so the page's eco discount stays out of the totals); a rental and a non-rental product; a location offer plus coordinates in the browser (AC6).

## Test plan

API first: a check goes to the UI only when the API can't prove it ([layer rules](../../.claude/skills/analyze-requirements/references/layer-rules.md)).

| Item | Criterion | What to check | Layer | Why this layer | Flags | Scenarios |
|---|---|---|---|---|---|---|
| T1 | AC1 | Journey: with a product in the cart, open the checkout page; the table has the labelled column headers Item, Quantity, Price, Total, and the line holds the product's name, quantity, unit price and line total under them | UI | Only the page renders the table and its headers; the API has no table | writes | UI-049 |
| T2 | AC2 | The server replaces a line's quantity: `PUT /carts/{cartId}/product/quantity` returns 200 and `GET /carts/{cartId}` shows the new quantity | API | The server stores the quantity (Carts contract §4, source `CartService`) | writes | API-0251 (existing) |
| T3 | AC2 | Journey: change a line's quantity from 1 to 3; the line total is 3 × the unit price, the cart total is recalculated and the message "Product quantity updated." is shown | UI | Line and cart totals are computed in the browser (`cart.component.ts`, `calculateTotal`); the toast text is built by the page | writes | UI-050 |
| T4 | AC3 | The server removes the line: `DELETE /carts/{cartId}/product/{productId}` returns 204 and the cart no longer holds the product | API | The server deletes the line (contract §5) | writes | API-0260 (existing) |
| T5 | AC3 | Journey: with two lines in the cart, click delete on one; the line disappears and the cart total equals the remaining line's total | UI | The total is recalculated in the browser; the click and the re-render exist only in the page | writes | UI-051 |
| T6 | AC4 | A visitor who has not put anything in a cart opens `/checkout`; the message "Your shopping cart is empty" is displayed | UI | Only the page shows the message; no API holds it | known issue | UI-052 |
| T7 | AC4 | After the last line is deleted on the checkout page, the message "Your shopping cart is empty" is displayed (and "Proceed" is gone) | UI | Same message, a different page state: the cart exists with no items, while T6 has no cart at all (the page treats them differently in `cart.component.html`) | writes | UI-053 |
| T8 | AC5 | Journey: with a product in the cart, click "Proceed"; the next wizard step ("Sign in") is shown | UI | Moving between wizard steps happens in the browser; the click calls no endpoint | writes | UI-054 |
| T9 | AC6 | The server computes the line discount: with a cart created at Amsterdam coordinates (lat 52, lng 5) and a location offer added, the item has `discount_percentage` 20 and `discounted_price` = price × 0.8 | API | The server sets the percentage and the discounted price (contract §2 Discounts, §3, Enums) | writes, data | API-0237 (existing) |
| T10 | AC6 | With a location offer in a cart that has coordinates (GEO_LOCATION in the browser's localStorage at cart creation), the checkout line shows the badge "-20%" next to the product name, the original price and the discounted price | UI | The badge and the two prices (original struck through, discounted next to it) are rendered by the page only; one case, the values are T9 | writes, data | UI-055 |
| T11 | AC7 | The server sets the combined discount: a cart with one non-rental and one rental product has `additional_discount_percentage` 15 | API | The server sets it on every add (contract §2 Discounts) | writes, data | API-0236 (existing) |
| T12 | AC7 | With one rental and one non-rental line, the cart shows Subtotal (the sum of the lines), the row "Discount (15%)" with 15% of the subtotal, and a final Total = subtotal minus that discount | UI | The subtotal, the discount amount and the final total are computed and displayed only by the page (`calculateDiscount`) | writes, data | UI-056 |
| T13 | AC8 | Removing the rental product (the last rental) from a rental plus non-rental cart gives `additional_discount_percentage` null | API | The server recalculates on `DELETE .../product/{productId}` (contract §5) | writes, data | API-0261 (existing) |
| T14 | AC8 | Removing the non-rental product (the last non-rental) from a rental plus non-rental cart gives `additional_discount_percentage` null and keeps the rental line | API | The other direction of "all rental or all non-rental"; same server rule (contract §5) | writes, data | API-0306 |
| T15 | AC8 | Removing one of two rental products from a cart that also holds a non-rental product keeps `additional_discount_percentage` 15 | API | The boundary the word "all" names: the discount goes only when the last item of a kind goes (contract §2, §5) | writes, data | API-0307 |
| T16 | AC8 | Journey: with a rental and a non-rental line, delete the rental line; the Subtotal and Discount rows disappear and the Total equals the remaining line's total | UI | The rows and the total are rendered and computed by the page; the server rule is T13 to T15 | writes, data | UI-057 |

**Not tested:** nothing dropped. Seen in the app but not in the story, so not planned: the quantity clamp to 1..99 with the toast "You can order at most 99 of this product."; the "Product deleted." toast; the "Eco-Friendly Discount (5%)" row (5% when more than half of the items have CO2 rating A or B); the rental line's explainer "Item for rent, price per hour" (Rental_Products AC4); the "Continue Shopping" button; the combination of the location discount (AC6) and the combined discount (AC7).

**Totals:** 16 items: 7 API (T2, T4, T9, T11, T13, T14, T15), 9 UI (T1, T3, T5, T6, T7, T8, T10, T12, T16; one journey per criterion, T7 being AC4's second state with its own UI-only reason); 5 already covered by existing scenarios (T2, T4, T9, T11, T13). Flags: 15 writes, 8 data, 0 dangerous, 1 known issue (T6), 0 contract gaps.

**Scenarios written:** 11 new, 2 API and 9 UI. API-0306 and API-0307 (T14, T15) are in `test-scenarios/api/carts/delete-carts-by-cart-id-product-by-product-id.yml`; UI-049..UI-057 (T1, T3, T5..T8, T10, T12, T16) are in the new `test-scenarios/ui/cart/checkout-cart-review.yml`. All start as `manual`.

## Open questions

- **T6, suspected bug (observed, not yet reproduced).** For a visitor with no cart at all, `/checkout` showed no message and no table in the inspector (the template reads `cart.cart_items` of a missing cart). `/report-bug` should reproduce it before any `knownIssue` is written.
- **T7 wording risk.** The app's translation file says "The cart is empty. Nothing to display." for an existing empty cart (not seen live). T7 is written against the story's wording, so it may fail on the text; reproduce it with `/report-bug`.
- **AC1 "Actions" column, possible bug.** The app's last header cell has no label (the cell holds the delete button). T1 checks only the four labelled headers; the unlabelled column is for `/report-bug`.

## Notes

- **AC4 expectation** (the user's decision): T6 and T7 are both kept and expect the story's wording "Your shopping cart is empty". T6 stays flagged `known issue`, with no `knownIssue` written until `/report-bug` reproduces it.
- **T1 headers** (the user's decision): only Item, Quantity, Price and Total are checked; the Actions column's missing label is not asserted.
- **T8** (the user's decision): checks only that the "Sign in" step is shown after "Proceed" (the app's button reads "Proceed to checkout").
- **Eco discount** (the user's decision): the page's 5% eco discount stays out of this story; T12 and T16 use products without CO2 rating A or B.
- **AC6 + AC7 combination** (the user's decision): not tested now; T12 uses lines without a location discount.
- **T15 kept** (the user's decision): the "all" boundary of AC8.
- **UI cart-state setup** (the user's decision): a note for the scenario writers, not an extra item. T6 needs a fresh session (no `cart_id` in `sessionStorage`); T7 deletes the last line in the UI or injects an API-created empty cart's id into `sessionStorage`; T10 needs `GEO_LOCATION` in `localStorage` before the cart is created (or an API-created cart with coordinates whose id is injected). The framework has no helper for either yet.
- **API writer scope** (the user's decision): only T14 and T15 are new API items; T2, T4, T9, T11 and T13 are covered by the existing manual scenarios listed in the Scenarios column. Those scenarios got a `ref` to this story's criterion after the scenarios were written.
- **Existing UI-002** shows a cart line and total after adding a product (Product_Detail AC8) and does not cover the column headers, so T1 is not a duplicate.
- **Page object:** `CartPage` has `proceed-1`, lines and total only; headers, delete, quantity change, subtotal and discount rows need adding for the UI scenarios.
- **Sources for the layer decisions:** the app's source (`practice-software-testing/sprint5/UI`, read-only): `app/checkout/cart/cart.component.{html,ts}`, `checkout.component.{html,ts}`, `login/login.component.html`, `_services/cart.service.ts`, `app/app.component.ts`, `_helpers/discount.util.ts`, `assets/i18n/en.json`. One inspector run: `/checkout` as the default role, no steps (only the wizard's step titles, because no cart existed).
