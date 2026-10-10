# Customer profile

<!-- Written by the requirements-analyst agent (/analyze-requirements). Source: docs/ui/user-stories/Customer_Profile.md -->

| | |
|---|---|
| **Source** | [Customer_Profile.md](../ui/user-stories/Customer_Profile.md) |
| **Type** | User story |
| **Criteria in scope** | AC1-AC4 (all) |
| **Analysed** | 2026-10-10 |

## Summary

A logged-in customer wants to view and update their personal information on the profile page, so the account details stay accurate. The page shows the current data (first name, last name, email, phone, street, postal code, city, state, country) and lets the customer change everything except the email, which is read-only. The story marks all eight editable fields as required. Saving valid data shows a success message that fades out after 5 seconds. The page loads the data with `GET /users/me` and saves the whole form with one `PUT /users/{userId}`. The story names no error texts, formats or length limits.

## Acceptance criteria

- **AC1 – Profile page is accessible**: Given I am logged in, when I navigate to my profile page, then my current profile information is displayed.
- **AC2 – Editable fields**: Given the profile page is displayed, then I can edit First name, Last name, Phone, Street, Postal code, City, State and Country, all required.
- **AC3 – Read-only email**: Given the profile page is displayed, then the email field is not editable.
- **AC4 – Successful update**: Given I modify profile fields with valid data, when I save, then a success message is displayed and fades out after 5 seconds.

## What it touches

- **API:** `GET /users/me` ([Users_API.md](../api/contracts/Users_API.md) §5), `PUT /users/{userId}` (§12), `POST /users/register` (§2, setup).
- **UI:** the profile page (`/account/profile`), reached from the user menu link "My profile" (`nav-my-profile`).
- **Data:** a throwaway customer registered through the API with a phone and a full address including a country (T2, T5, T7, T8); the run's customer for the display-only checks (T4, T6).

## Test plan

API first: a check goes to the UI only when the API can't prove it ([layer rules](../../.claude/skills/analyze-requirements/references/layer-rules.md)).

| Item | Criterion | What to check | Layer | Why this layer | Flags | Scenarios |
|---|---|---|---|---|---|---|
| T1 | AC1 | `GET /users/me` returns the profile saved for the customer: first name, last name, email, phone, and street, city, state, country and postal code of the address | API | The page gets its data from this endpoint (source `getDetails`); the API proves the data, the UI item only shows it. Users_API.md §5 | | API-0063, API-0086, API-0305, API-0312 (existing; API-0305 and API-0312 are manual) |
| T2 | AC1 | Journey: a logged-in customer with a saved phone and address (country included) opens the user menu, clicks "My profile", and the profile page shows the first name, last name, email, phone, street, postal code, city, state and country as saved | UI | Navigation and what the page displays; one case, the data itself is T1 | writes (setup), data | UI-063 |
| T3 | AC2 | Each of `first_name`, `last_name`, `address.street`, `address.city` and `address.country` missing in turn (valid otherwise, own id, own token) gives 422 with an error on that field, and the stored profile is unchanged | API | The server requires these five (`UpdateCustomer`, Users_API.md §12 422). Rejections are API items, never repeated on the UI | writes (setup) | API-0314, API-0315, API-0316, API-0317, API-0318 |
| T4 | AC2 | The page shows First name, Last name, Phone, Street, Postal code, City, State and Country, and each one accepts typing (the typed value replaces the shown one); nothing is saved | UI | Only the page holds the form controls and their labels; "editable" is a property of the page | | UI-064 |
| T5 | AC2 | With the other fields filled, emptying Phone, State or Postal code in turn and clicking "Update Profile" is not accepted: the field is highlighted as invalid, an error alert is shown, and no success message appears | UI | These three are required only in the browser: the server accepts them missing (`phone`, `state`, `postal_code` are nullable, Users_API.md §12). Only the page can prove the rule | writes (setup), data | UI-065 (Phone), UI-066 (State), UI-067 (Postal code) |
| T6 | AC3 | The email field shows the account's email and is read-only: typing in it doesn't change the value | UI | The `readonly` attribute exists only on the page; the server accepts an email in `PUT` (Users_API.md §12), so the API can't prove it | | UI-068 |
| T7 | AC4 | `PUT /users/{userId}` with the customer's own id and token and valid, changed values (first name, last name, phone, street, postal code, city, state, country) returns 200 `{ success: true }`, and `GET /users/me` then returns the new values | API | The server validates and stores the update; reading it back proves it (Users_API.md §12, §5). New file `put-users-by-user-id.yml` | writes | API-0313 |
| T8 | AC4 | Journey: on the profile page, change the fields to valid values and click "Update Profile": a success alert is shown, and about 5 seconds later it is gone | UI | The alert and its 5-second fade-out are built and timed in the browser (source: `fadeOutMessage`); the update itself is T7 | writes, data | UI-069 |

**Not tested:**
- AC1, logged-out access: the story starts from "I am logged in"; the redirect for a guest isn't described.
- AC2 and AC4, formats and limits: the phone format (7-24 of digits, spaces, `( ) + - .`) and the max lengths (first name 40, last name 20, street 70, city 40, state 40, country 40, postal code 10, phone 24) aren't in the story, although the server enforces them.

**Totals:** 8 items: 3 API, 5 UI (2 journeys: T2, T8; T4, T5, T6 are display or browser-only checks, each with its UI-only reason); 1 already covered by existing scenarios (T1). Flags: 5 writes (T2, T3, T5, T7, T8), 3 data (T2, T5, T8), 0 dangerous, 0 known issues, 0 contract gaps.

**Scenarios written:** 13 new, all `manual`: 6 API (API-0313..0318) in `test-scenarios/api/users/put-users-by-user-id.yml` (T7 is one scenario, T3 is five, one per missing field) and 7 UI (UI-063..069) in `test-scenarios/ui/account/customer-profile.yml` (T5 is three, one per field). The UI scenarios use `ref` `Customer_Profile.md#AC1` to `#AC4`, the API ones `#AC2` and `#AC4`.

## Open questions

- **Contract §12 and §5** hold mostly `_(source)_` facts for `PUT /users/{userId}`. They get tagged `_(verified)_` when T3 and T7 are automated.
- **Dotted error keys:** §12 and "Error Handling" write the 422 body as `{ <field>: string[] }`; the source confirms keys such as `address.street`. A one-line addition to the contract would state it.
- **The success text** isn't in the story; the source has "Your profile is successfully updated!", and the read-only inspector can't show it before a submit. T8 checks that a success alert is shown, the text confirmed on the first run.

## Notes

- **Browser-only required fields** (the user's decision): Phone, State and Postal code are required only in the browser, so T5 is UI only, with no API item asserting that the server accepts them missing. T5 checks the highlight, an error alert ("Please correct the highlighted fields before saving.", source) and no success message.
- **No UI item for the server-enforced five** (the user's decision): First name, Last name, Street, City and Country are API only (T3); T5 already shows the display mechanism once.
- **Valid data** (the user's decision): T7 and T8 use plain valid values (a phone of digits, short texts, an address with a country); no format or limit items.
- **Email on the server** (the user's decision): `PUT /users/{userId}` accepts a changed email (a duplicate gives 403, a suspected bug already in the contract). No API item and no bug report from this story.
- **T1** (the user's decision): the data for AC1 is covered by API-0063, API-0086, API-0305 and API-0312; no new scenario.
- **T2 and T4** (the user's decision): kept as two items, one per criterion, though they could share one scenario.
- **Test data** (the user's decision): T5 and T8 use a throwaway customer with a phone and a country in its address, never the run's customer, because [Checkout_Billing_Address](checkout-billing-address.md) assumes the run's customer has no saved address and a mistaken save would break it. T4 and T6 only type and don't submit, so the run's customer is fine. The `throwawayCustomerTest` fixture registers a customer without details, so the UI engineer needs a variant with a phone and a country (`UserFactory.registerCustomerWithDetails` has no country; API-0305 shows a valid pair such as `NL` and `1011AB`).
- **Fade-out timing** (the user's decision): T8 checks with a tolerance: the alert is visible right after the save and gone by about 6 seconds, with no fixed sleep for the first check.
- **Page data-test ids** (inspector): `first-name`, `last-name`, `email`, `phone`, `street`, `postal_code`, `city`, `state`, `country`, `update-profile-submit`; the menu link `nav-my-profile`. Page heading "Profile". There's no page object for this page yet; it also serves Change Password UI-031..040 (area `account`).
- **API errors for T3** come back as a flat `{ "<field>": string[] }` map with dotted keys such as `address.street` (Users_API.md §12 and Error Handling).
- **Sources for the layer decisions:** the app's source (`practice-software-testing/sprint5`, read-only) was used only to decide where each rule is enforced: `UI/src/app/account/profile/profile.component.{ts,html}`, `shared/customer-account.service.ts`, `API/.../Customer/UpdateCustomer.php` and `UserService::updateUser`. Two inspector runs as the default role: `/account/profile` (the fields, labels and the button) and `/` with `click:nav-menu` (the "My profile" link).
