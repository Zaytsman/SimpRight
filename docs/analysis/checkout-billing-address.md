# Checkout billing address

<!-- Written by the requirements-analyst agent (/analyze-requirements). Source: docs/ui/user-stories/Checkout_Billing_Address.md -->

| | |
|---|---|
| **Source** | [Checkout_Billing_Address.md](../ui/user-stories/Checkout_Billing_Address.md) |
| **Type** | User story |
| **Criteria in scope** | AC1-AC4 (all) |
| **Analysed** | 2026-10-10 |

## Summary

A customer wants to enter the billing address on the third checkout step, pre-filled from the account when logged in, so the invoice is accurate. The form has Street (max 70), City (max 40), State (max 40), Country (max 40) and Postal code (max 10), all required. Leaving a required field empty highlights it as invalid and disables "Proceed". With all fields filled, "Proceed" advances to the payment step. A logged-in user sees the fields pre-filled with the account's address details.

## Acceptance criteria

- **AC1 – Address form fields**: Given I am on the billing address step, then the required fields Street (max 70), City (max 40), State (max 40), Country (max 40) and Postal code (max 10) are displayed.
- **AC2 – Validation**: Given I leave a required field empty, then the field is highlighted as invalid and the "Proceed" button is disabled.
- **AC3 – Proceed to payment**: Given all address fields are filled in, when I click "Proceed", then I advance to the payment step.
- **AC4 – Pre-fill for logged-in users**: Given I am logged in, then the address fields are pre-filled with my account address details.

## What it touches

- **API:** `POST /invoices` ([Invoices_API.md](../api/contracts/Invoices_API.md) §8: required fields, max lengths, the 422 map of field to messages; "A consistent billing address" under Data required); `GET /users/me` ([Users_API.md](../api/contracts/Users_API.md) §5, Address model) and `POST /users/register` (§2, an address with a country); `GET /postcode-lookup` ([Postcode_API.md](../api/contracts/Postcode_API.md) §1), only as a data helper for T2.
- **UI:** the checkout page (`/checkout`), step 3 "Billing Address" (a wizard step with no URL of its own), reached through the cart step and the sign-in step.
- **Data:** a cart with an in-stock product (T3, T5, T6, T8); the run's customer, who has no saved address, for the empty form (T3, T5, T6); a throwaway customer registered through the API with an address that includes a country (T7, T8); a throwaway customer and an empty cart (T2).

## Test plan

API first: a check goes to the UI only when the API can't prove it ([layer rules](../../.claude/skills/analyze-requirements/references/layer-rules.md)).

| Item | Criterion | What to check | Layer | Why this layer | Flags | Scenarios |
|---|---|---|---|---|---|---|
| T1 | AC1 | A billing address field over its limit is rejected: `billing_street` of 71 characters, `billing_city` 41, `billing_state` 41, `billing_country` 41, `billing_postal_code` 11 each give 422 with an error on that field, the other fields valid (no write: validation runs before the invoice is created) | API | The server enforces the lengths on `POST /invoices` (contract §8: max 70, 40, 40, 40, 10; source `StoreInvoice`). Boundaries are API items, never repeated on the UI | | API-0300, API-0301, API-0302, API-0303, API-0304 |
| T2 | AC1 | A billing address at its limit is accepted: street of 70 characters, city 40, state 40 and a 40-character country (no postal code) give 201; a separate request with a 10-character postal code (a US ZIP+4 such as `12345-6789`, with the city and state that `GET /postcode-lookup` returns for it) gives 201. Use a throwaway customer, an empty cart and cash-on-delivery with `payment_details: {}` | API | Same rule, the accepted side of the boundary. When country and postal code are both sent, the server requires city and state to equal the lookup's (contract Data required, source `AddressMatchesCountry`), so the long city and state can't be sent together with a postal code | writes, data | API-0297, API-0298 |
| T3 | AC1 | On the billing address step the fields Street, City, State, Country (a dropdown) and Postal code are displayed (the page also shows House number) | UI | Only the page shows the form and its labels | writes, data | UI-041 |
| T4 | AC2 | A required field left out is rejected: `billing_street`, `billing_city` or `billing_country` missing (or an empty string) gives 422 with an error on that field | API | The server requires these three (contract §8, source `StoreInvoice`). The page only blocks the form; the UI item below checks what the user sees | | API-0299 |
| T5 | AC2 | With the other fields filled, emptying each of Street, City, State, Country and Postal code in turn highlights that field as invalid and disables "Proceed" | UI | The highlight and the disabled button exist only in the page. For State and Postal code the server doesn't require them (contract §8 `billing_state?`, `billing_postal_code?`), so only the browser enforces them; for the other three the rule is T4 and this item checks only the display | writes, data | UI-042, UI-043, UI-044, UI-045, UI-046 |
| T6 | AC3 | Journey: with all address fields filled in, click "Proceed" and the payment step is shown | UI | Navigation between wizard steps happens in the browser; no endpoint is called on that click (the invoice is created at the payment step) | writes, data | UI-047 |
| T7 | AC4 | `GET /users/me` returns the address saved at registration, country included: street, city, state, country and postal code equal the registered values (register with a country and a postal code in that country's format, e.g. `NL` and `1011AB`) | API | The page gets the pre-fill from `GET /users/me` (source `CustomerAccountService.getDetails`, contract Users §5). The API proves the data; the UI item only shows it | writes | API-0305 (API-0086 covers all fields but country) |
| T8 | AC4 | Logged in as a customer with a saved address (country included), the billing address step shows street, city, state, country and postal code equal to the account's | UI | Only the page pre-fills its fields; one case, the data itself is T7 | writes, data | UI-048 |

**Not tested:** nothing in the four criteria is dropped. Seen in the app but not in the story, so not planned: the postcode auto-fill (country, postal code and house number call `GET /postcode-lookup` and overwrite street, city and state), the lookup error alert (`postcode-lookup-error`), and the invoice rejection when city or state don't match the lookup of country and postal code.

**Totals:** 8 items: 4 API (T1, T2, T4, T7), 4 UI (1 journey, T6; T3, T5 and T8 are display checks, each with its own UI-only reason); 0 already covered by existing scenarios (T7 is partly covered by API-0086, which registers without a country). Flags: 6 writes (T2, T3, T5, T6, T7, T8), 5 data (T2, T3, T5, T6, T8), 0 dangerous, 0 known issues, 0 contract gaps (T8 has a suspected known issue, see Open questions).

**Scenarios written:** 17 in 3 files, all `manual`. API (9): API-0297..API-0304 in `test-scenarios/api/invoices/post-invoices.yml` (new) and API-0305 added to `test-scenarios/api/users/post-users-register.yml`. UI (8): UI-041..UI-048 in `test-scenarios/ui/cart/checkout-billing-address.yml` (new, area `cart`). Dropped at review: none. UI-043 (City) is the lowest-value scenario of the set (marked optional by the writer; kept).

## Open questions

- **T8, suspected bug (from the source, not reproduced).** When the pre-fill sets country, postal code and house number together, the page's postcode lookup runs and overwrites street, city and state with a generated address, so the account's street, city and state may not survive. The criterion says the fields hold the account's details. T8 (UI-048) is written against the story, with no `knownIssue` until `/report-bug` confirms it (it needs a customer with an address and a country). Without a country on the account no lookup runs.
- **State and postal code are required only in the browser.** The OpenAPI spec marks `billing_state` and `billing_postal_code` required, but the code and the contract (§8) don't: `POST /invoices` without them is accepted. No API item asserts that. The spec/code mismatch could be reported as a bug.
- **`Invoices_API.md`** still says `GET /postcode-lookup` has "no contract yet", but `Postcode_API.md` exists. Not changed here. The facts T1, T2 and T4 rely on are `_(source)_` in the contract; they get `_(verified)_` when the scenarios are automated.

## Notes

- **House number** (the user's decision): the page requires it ("House number *") although the story doesn't list it. T3 notes that it is shown, T5 covers only the five listed fields, and every UI scenario fills House number so "Proceed" can enable.
- **State and postal code browser-only** (the user's decision): T5 is UI only, with no API item for the server accepting their absence.
- **T8 written against the story** (the user's decision): no `knownIssue` until `/report-bug` confirms the pre-fill overwrite.
- **Fill order in the UI scenarios** (the user's decision): the scenarios fill country, postal code and house number first, wait for the postcode lookup to finish, then street, city and state, because the debounced (300 ms) lookup overwrites street, city and state.
- **T2 as a write** (the user's decision): `POST /invoices` with a throwaway customer and an empty cart, approved by the user. An invoice has no delete endpoint, the checkout email is queued, and the customer that owns it can't be deleted (409; the teardown only logs a warning). The hourly re-seed cleans it.
- **Reaching the step** (the user's decision): T3, T5, T6 and T8 set up the cart through `ShoppingFlow.addProductToCart` and reach step 3 with the proceed buttons (`CartPage.proceed()`, then the sign-in step's proceed). The cart step and the sign-in step belong to Checkout_Cart_Review AC5 and Checkout_Sign_In AC5, which are not analysed yet.
- **T8 customer** (the user's decision): a throwaway customer registered through the API with an address and a country, logged in by token injection. That needs a new fixture: the `role` fixture only knows the run's customer and the admin. The run's customer has no address, so it serves T3, T5 and T6.
- **No UI item for the max length** (the user's decision): the inputs declare no `maxlength`; the page flags a longer value as invalid and disables "Proceed", but the story doesn't say what the user sees past the limit. The limits are T1 and T2.
- **Contracts unchanged** (the user's decision).
- **Page data-test ids** come from the app's source (the checkout wizard's step 3 isn't reachable by the inspector with an empty cart): `country`, `postal_code`, `house_number`, `street`, `city`, `state`, `proceed-3`, `postcode-lookup-hint`, `postcode-lookup-loading`, `postcode-lookup-error`. The page object's author confirms them against the page.
- **Server error shape:** `POST /invoices` returns the 422 as a flat map of field to messages (`BaseFormRequest`), not `{ message, errors }` (contract §8). `cart_id` is only `required`, so any string passes validation for the rejection cases, with no cart or invoice created.
- **Sources for the layer decisions:** the app's source (`practice-software-testing/sprint5`, read-only) was used only to decide where each rule is enforced: `UI/src/app/checkout/address/address.component.{ts,html}` (the page's validators, the disabled button, the pre-fill from `GET /users/me`), `checkout.component.{ts,html}`, `payment.component.ts`, `login.component.ts`, `API/.../StoreInvoice.php`, `InvoiceController.php`, `AddressMatchesCountry.php`. One inspector run: `/checkout` as the default role (only the wizard's step titles, because the cart is empty).
