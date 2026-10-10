# Product overview

<!-- Written by the requirements-analyst agent (/analyze-requirements). Source: docs/ui/user-stories/Product_Overview.md -->

| | |
|---|---|
| **Source** | [Product_Overview.md](../ui/user-stories/Product_Overview.md) |
| **Type** | User story |
| **Criteria in scope** | AC1-AC13 (all) |
| **Analysed** | 2026-10-10 |

## Summary

A visitor wants to browse a paginated grid of all products and narrow it by search, category and brand checkboxes (with parent and child categories), sorting and a price range slider, so that they can find products within their preferences and budget. Each card shows an image, a name and a price, a struck-through original price with the discounted price for location offers, and "Out of stock" for products with no stock. Search takes 3-40 characters and resets the filters; a category and brand selection is combined (AND). The server does the filtering, sorting and paging; the page does the checkbox hierarchy, the slider, the search-length validation, the discount calculation and the labels.

## Acceptance criteria

- **AC1 – Product grid is displayed**: Given I open the home page, then a grid of product cards is shown and each card shows an image, a name and a price.
- **AC2 – Navigating to product detail**: Given the overview is displayed, when I click a product card, then I land on the product detail page.
- **AC3 – Pagination**: Given there are more products than fit on one page, then pagination controls are shown below the grid, and clicking a page number updates the grid.
- **AC4 – Search**: Given I enter a valid search query (3-40 characters) and submit, then the grid shows only matching products and all active filters are reset.
- **AC5 – Category filter**: Given I check one or more category checkboxes, then the grid shows only products from those categories.
- **AC6 – Hierarchical category selection**: Given a parent category has children, when I check the parent, then all its children are checked; unchecking all children unchecks the parent.
- **AC7 – Brand filter**: Given I check one or more brand checkboxes, then the grid shows only products from those brands.
- **AC8 – Combining filters**: Given I selected categories and brands, then the grid shows only products matching both filters.
- **AC9 – Sorting**: Given I select a sort option (Name A-Z, Name Z-A, Price High-Low, Price Low-High), then the grid reloads ordered accordingly.
- **AC10 – Price range slider**: Given I am on the overview page, then a price range slider is shown in the sidebar with a default range of $1 to $100 and a maximum of $200.
- **AC11 – Adjusting the price range**: Given I drag the slider handles to a new minimum and maximum, then the grid shows only products within that range.
- **AC12 – Discount price display**: Given a product has a discount (location-based or otherwise), then its card shows the original price struck through and the discounted price below.
- **AC13 – Out of stock indicator**: Given a product has no stock, then "Out of stock" is shown on its card.

## What it touches

- **API:** `QUERY /products` and `GET /products` ([Products_API.md](../api/contracts/Products_API.md) §1, §2; the page calls QUERY, the scenarios use GET, and parity is covered by API-0015..0071), `QUERY /products/search` and `GET /products/search` (§9, §10), `POST /products` (§3) and `DELETE /products/{productId}` (§7) for T31's setup and cleanup.
- **UI:** the home page (`/`: grid, sidebar filters, sort list, price slider, pagination) and the product page (`/product/<id>`).
- **Data:** seeded products on page 1 ("Combination Pliers", "Bolt Cutters" = a location offer, "Long Nose Pliers" = out of stock); two categories and two brands that have products (their ids change at every hourly re-seed, so read them at run time); a product with stock 0 created by the test; a visitor in London (the existing `visitorInLondonTest` fixture).

## Test plan

API first: a check goes to the UI only when the API can't prove it ([layer rules](../../.claude/skills/analyze-requirements/references/layer-rules.md)).

| Item | Criterion | What to check | Layer | Why this layer | Flags | Scenarios |
|---|---|---|---|---|---|---|
| T1 | AC1 | Each product the grid reads has a name, a price and a `product_image` | API | The server supplies the card's data (Products §1) | | API-0002 (existing) |
| T2 | AC1 | The home page shows a grid of product cards, each with an image, a name and a price | UI | Only the page renders the cards | | UI-070 |
| T3 | AC2 | Journey: clicking a card opens that product's page (`/product/<id>`, showing the clicked product's name) | UI | Navigation: only the page links a card to the detail page | data | UI-071 |
| T4 | AC3 | The list is paged by the server: 9 per page; `page=2` returns the next products and `current_page` 2 | API | The server paginates (Products §1) | | API-0002, API-0012 (existing) |
| T5 | AC3 | Journey: pagination controls show below the grid; clicking page "2" updates the grid (other products, page 2 active) | UI | Only the page shows the controls and sends the page request | data | UI-072 |
| T6 | AC4 | A search returns only products whose name contains the term (`/products/search`, GET and QUERY) | API | The server filters by name (Products §9, §10) | | API-0001, API-0030 (existing) |
| T7 | AC4 | Journey: search "pliers" on the home page; the caption names the term and every card matches | UI | The page sends the search and shows the result | | UI-001 (existing) |
| T8 | AC4 | A 3-character term is accepted | UI | The page validates the length (min 3) before sending; the server has no length rule (source `ProductController::search`; none in Products §9) | | UI-004 (existing) |
| T9 | AC4 | A 40-character term is accepted | UI | Same as T8 (max 40) | | UI-005 (existing) |
| T10 | AC4 | A 2-character term is rejected; the grid is unchanged | UI | Same as T8 | | UI-006 (existing) |
| T11 | AC4 | A 41-character term is rejected; the grid is unchanged | UI | Same as T8 | | UI-007 (existing) |
| T12 | AC4 | After a search, the checked category and brand are unchecked | UI | Checkbox state lives in the browser; the search request carries no filters (source) | | UI-003 (existing) |
| T13 | AC5 | `by_category` with one id returns only that category's products | API | The server filters (Products §1) | | API-0004 (existing) |
| T14 | AC5 | `by_category` with two ids (comma-separated) returns only products of those two categories, and both are present | API | The server filters with `whereIn` (Products §1, source `Product::scopeWithFilters`); "one or more" is not covered by API-0004 | data | API-0319 |
| T15 | AC5 | Journey: check one category in the sidebar; the grid updates to that category's products | UI | Only the page turns the checkbox into the request and shows the grid; the rule is T13/T14 | data | UI-075 |
| T16 | AC6 | Checking a parent category ("Hand Tools") checks all its child checkboxes | UI | The check state is kept in the browser and sent nowhere (source; the inspector showed it) | | UI-076 |
| T17 | AC6 | Unchecking all children unchecks the parent | UI | Same as T16 | | UI-077 |
| T18 | AC7 | `by_brand` with one id returns only that brand's products | API | The server filters (Products §1) | | API-0003 (existing) |
| T19 | AC7 | `by_brand` with two ids returns products of both brands only | API | The server filters with `whereIn` (Products §1, source); "one or more" is not covered by API-0003 | data | API-0320 |
| T20 | AC7 | Journey: check one brand in the sidebar; the grid updates to that brand's products | UI | Only the page turns the checkbox into the request and shows the grid; the rule is T18/T19 | data | UI-078 |
| T21 | AC8 | `by_brand` and `by_category` together return only products that match both | API | The server ANDs the filters (Products §1, source); API-0064 only compares QUERY with GET, not that each item matches both | data | API-0321 |
| T22 | AC8 | Journey: check a category and a brand; the grid shows only products matching both | UI | The page keeps both selections and sends them in one request (state in the browser) | data | UI-079 |
| T23 | AC9 | "Name (A - Z)" orders the grid by name ascending | UI | Kept as existing UI coverage; the server sorts (Products §1), so it could move to the API | | UI-008 (existing) |
| T24 | AC9 | "Name (Z - A)" orders the grid by name descending | UI | As T23 | | UI-009 (existing) |
| T25 | AC9 | "Price (High - Low)" orders by price descending | API | The server sorts (Products §1); API-0008 proves it | | API-0008, UI-010 (existing) |
| T26 | AC9 | "Price (Low - High)" orders by price ascending | UI | As T23 | | UI-011 (existing) |
| T27 | AC10 | The sidebar shows the price range slider with handles at $1 and $100 on a scale up to $200 | UI | Only the page renders the slider and its default (constants in the page, source; inspector) | | UI-073 |
| T28 | AC11 | `between=price,min,max` returns only products priced within the range, ends included | API | The server filters (Products §1) | | API-0007, API-0067 (existing) |
| T29 | AC11 | Journey: move the slider handles to a new range; the grid updates and every shown price is inside it | UI | The slider is a page control and only the page sends the range on release; the rule is T28 | data | UI-080 |
| T30 | AC12 | For a visitor in London (25%), a location-offer product's card shows the original price struck through and the discounted price | UI | The browser computes the discount from `GEO_LOCATION` in localStorage; the API only sends `is_location_offer` (source `DiscountUtil`) | data | UI-074 |
| T31 | AC13 | A product created with stock 0 is listed with `in_stock` false for a guest (and one with stock > 0 with true) | API | The server derives `in_stock` from the stock (source `Product::getInStockAttribute`) | writes, data | API-0322, API-0323 |
| T32 | AC13 | The card of an out-of-stock product shows "Out of stock" | UI | Only the page renders the label | data | UI-012 (existing) |

**Not tested:**
- AC12 "or otherwise": the app has only the location-based discount (source); nothing else is stated.
- AC12 "the discounted price below": the page puts both prices in one footer line; a layout position isn't checked.
- AC4 "all active filters are reset" beyond category and brand (price slider, sort).
- Seen in the page, not in the story: the eco-friendly and spec filters, CO2 sort options, compare buttons, the "X" reset button, the "no results" and result-count texts, the page controls being hidden when there is one page.

**Totals:** 32 items: 11 API, 21 UI (7 journeys: AC2, AC3, AC4, AC5, AC7, AC8, AC11); 17 already covered by existing scenarios (T1, T4, T6-T13, T18, T23-T26, T28, T32); 15 new: 4 API (T14, T19, T21, T31) and 11 UI (T2, T3, T5, T15, T16, T17, T20, T22, T27, T29, T30). Flags: 1 writes, 12 data, 0 dangerous, 0 known issues, 0 contract gaps.

**New scenarios (all `manual`):** 5 API in `test-scenarios/api/products/get-products.yml` (API-0319..API-0323; T31 became two scenarios, one per stock value) and 11 UI: UI-070..UI-074 in `test-scenarios/ui/products/product-grid.yml` and UI-075..UI-080 in the new `test-scenarios/ui/products/product-filters.yml`.

## Open questions

- **Suspected bug, from the source, not reproduced and not yet reported:** `onSearchSubmit` and `changePriceRange` in the overview component don't set `discount_price`, so a discounted product probably loses its strikethrough and discounted price on the grid after a search or a price range change, which would break AC12 there. Default: T30 is a plain check on the default grid, with no known issue. Suggested next step: `/report-bug` to confirm, then add `knownIssue` and `bug` to a scenario for it.
- **Contract facts** for several comma-separated ids in `by_category` and `by_brand` (T14, T19) and `in_stock` = stock > 0 for a guest (T31) come from the source and Products §1, and are not tagged `_(verified)_` yet. Default: tag them when those scenarios are automated.

## Notes

- **Decisions the user made at the checkpoint (the user's decision):**
  - AC4 "all active filters are reset": only category and brand (T12); the price range and sort are left out.
  - AC12: T30 covers the location-based discount only, with no check of the position of the discounted price.
  - The suspected discount bug is not reported yet; it stays as an open point above.
  - AC5, AC7 and AC8 keep their three UI journeys (T15, T20, T22).
  - AC9: no new API items for sorting; UI-008, UI-009 and UI-011 stay.
  - Contract facts get `_(verified)_` when the scenarios are automated.
  - AC10: T27 checks the handles at $1 and $100 and the maximum $200, not the floor (0).
- **Could move to the API:** T23, T24 and T26 (UI-008, UI-009, UI-011), because the server sorts; API-0008 already proves price descending.
- **Default grid range:** the page calls `QUERY /products` with `between=price,1,100` on every load. UI-vs-API comparisons (T15, T20, T22) must include that range, and a product priced outside $1-$100 never shows on the default grid.
- **Where T30 finds the card:** search results and a price range change don't compute discounts (see the open question), so T30 must reach the discounted card through the default grid or a filter, not through search or the slider. "Bolt Cutters" (a seeded location offer, as in UI-014's spec) is card 3 on page 1 now. UI-074 lists "The visitor is in London." as its first step, so the spec sets the location inside that step with plain `test`, not through `visitorInLondonTest`. UI-014 covers the product page, not the grid.
- **Waiting in T29:** `changePriceRange` sets no result-state marker, so the test needs another signal (the `QUERY /products` response). The handles have the roles `slider "ngx-slider"` and `"ngx-slider-max"` (keyboard use).
- **T31 data:** the product is created with `POST /products` and `stock` 0 (no token needed) and removed with the admin's `DELETE`. It is read back from `GET /products` with `q=<unique name>`.
- **Seeded products:** UI-012 finds "Long Nose Pliers" on page 1; other visitors can change stock, price or the catalogue at any time (product writes need no token), hence the `data` flags.
- **Sources for the layer decisions:** the app's source (`practice-software-testing/sprint5`, read-only) was used only to decide where each rule is enforced: `products/overview/overview.component.ts` and `.html`, `_helpers/discount.util.ts`, `pagination.component`, `_services/product.service.ts`, `Product::scopeWithFilters`, `Product::getInStockAttribute` and `ProductController::search`. Two inspector runs: `/` logged out (grid, 5 pages, slider 0-200 with handles at 1 and 100, "Out of stock" on "Long Nose Pliers") and `/` with `check:Hand Tools` (the parent and all its children checked).
- **Refs for the scenarios:** `docs/ui/user-stories/Product_Overview.md#AC<n>`.
