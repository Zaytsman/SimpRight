# Checkout sign in

<!-- Written by the requirements-analyst agent (/analyze-requirements). Source: docs/ui/user-stories/Checkout_Sign_In.md -->

| | |
|---|---|
| **Source** | [Checkout_Sign_In.md](../ui/user-stories/Checkout_Sign_In.md) |
| **Type** | User story |
| **Criteria in scope** | AC1-AC5 (all) |
| **Analysed** | 2026-10-10 |

## Summary

A customer who is not logged in wants to sign in inside the checkout wizard, so the purchase can be completed without leaving it. On step 2 ("Sign in") a guest sees a login form with email, password and a submit button. An account with TOTP enabled gets a TOTP code field after valid credentials and must enter a valid code to go on. After a successful login the customer can proceed to the billing address step. A customer who is already logged in sees "You are already signed in as [First Name] [Last Name]" and can proceed directly. The server decides only who is authenticated (login, the TOTP step, `/users/me`). The step's form, its messages and the wizard navigation exist only in the page.

## Acceptance criteria

- **AC1 – Login step displayed for guests**: Given a guest on the checkout page with items in the cart, when I click "Proceed to checkout" on the cart step, then a login form is displayed as the next step of the wizard.
- **AC2 – Login form fields**: Given the checkout login step is displayed, then email and password fields and a submit button are shown.
- **AC3 – TOTP support during checkout login**: Given an account with TOTP enabled, when I submit valid email and password on the checkout login step, then a 6-digit TOTP input is displayed and I must enter a valid code to proceed.
- **AC4 – Successful login during checkout**: Given valid credentials on the checkout login step, when I submit the form, then I am authenticated and can proceed to the billing address step.
- **AC5 – Already logged in**: Given I am already logged in, when I reach the checkout login step, then "You are already signed in as [First Name] [Last Name]" is shown and I can proceed directly to the billing address step.

## What it touches

- **API:** `POST /users/login` ([Users_API.md](../api/contracts/Users_API.md) §1, both steps; Authentication section), `GET /users/me` (§5), `PATCH /users/{userId}` (§13, only as setup for the TOTP account), `POST /users/register` (§2, setup).
- **UI:** the checkout page (`/checkout`), wizard step 2 "Sign in" (a step with no URL of its own, reached through the cart step), then step 3 "Billing Address".
- **Data:** a product in stock in the cart (logged-out cart for T1, T2, T7, T9); a throwaway customer with TOTP enabled and a known base32 secret (T3-T7); the run's customer (T9, T11); a throwaway registered customer with known names (T10).

## Test plan

API first: a check goes to the UI only when the API can't prove it ([layer rules](../../.claude/skills/analyze-requirements/references/layer-rules.md)).

| Item | Criterion | What to check | Layer | Why this layer | Flags | Scenarios |
|---|---|---|---|---|---|---|
| T1 | AC1 | Journey: a logged-out visitor with a product in the cart opens the checkout page and clicks "Proceed to checkout"; step 2 "Sign in" is shown with the login form (the Login form, not the signed-in message) | UI | Moving between wizard steps and which form the step shows happen in the browser; the click calls no endpoint. UI-054 covers the step for a logged-in user only | writes | UI-058 |
| T2 | AC2 | On the guest's sign-in step the fields Email and Password and the submit button "Login" are displayed | UI | Only the page holds the form and its labels; no API shows them | writes | UI-059 |
| T3 | AC3 | First step of a TOTP account's login: `POST /users/login` with its email and password returns 200 `{ message: "TOTP required", requires_totp: true, access_token }` and no `token_type` or `expires_in` | API | The server decides that TOTP is required (`UserService::login`; contract §1 Response, `_(source)_`). The page only reacts to `requires_totp` | writes, data | API-0308 |
| T4 | AC3 | The `access_token` from the first step is not a session: `GET /users/me` with it returns 401 `{ message: "Unauthorized token usage" }` | API | The server rejects restricted tokens (`Authenticate` middleware); this is "must enter a valid code to proceed". Not in the Users contract yet, see Open questions | writes, data | API-0310 |
| T5 | AC3 | Second step with the right code: `POST /users/login` with `access_token` (the restricted one) and the current TOTP code returns 200 with a full `access_token` and `token_type` "bearer", and `GET /users/me` with it returns 200 for that customer | API | The server verifies the code and issues the full token (contract §1, `_(source)_`) | writes, data | API-0309 |
| T6 | AC3 | Second step with a wrong code returns 401 `{ error: "Invalid TOTP" }` and no `access_token` | API | The server rejects the code (contract §1 Error Responses, `_(source)_`). Wrong codes don't count toward the lockout (`UserService::login`), but the account is a throwaway anyway | writes, data | API-0311 |
| T7 | AC3 | Journey: a guest whose account has TOTP enabled submits valid email and password on the sign-in step; the TOTP input (labelled "TOTP Code") and the "Verify TOTP" button replace the credentials form; a wrong code leaves the user not signed in (no "Proceed to checkout" button); the right code signs the user in (the signed-in message and the button appear) | UI | The field, the swap of the form and the proceed button are rendered by the page only; one journey, the rules and every code case are T3 to T6 | writes, data | UI-060 |
| T8 | AC4 | Valid credentials: `POST /users/login` returns 200 with a bearer token, and `GET /users/me` with it returns 200 with that user's email | API | The server authenticates (contract §1, §5) | | API-0078 (existing) |
| T9 | AC4 | Journey: a guest enters the run customer's valid email and password on the sign-in step and submits; the form is replaced by the signed-in state, the nav bar's user menu appears, and "Proceed to checkout" leads to the "Billing Address" step | UI | The swap of the form, the nav bar and the wizard navigation happen in the browser; the authentication itself is T8 | writes | UI-061 |
| T10 | AC5 | `GET /users/me` returns the `first_name` and `last_name` the customer registered with (register, login, read back) | API | The page builds the message from `GET /users/me` (`getCustomerInfo`); the API proves the data, the UI item shows it (contract §5, §2). API-0063 checks only that the names are not empty | writes | API-0312 |
| T11 | AC5 | Journey: logged in as the run's customer with a product in the cart, open the checkout page and click "Proceed to checkout"; step 2 shows "You are already signed in as [First Name] [Last Name]" with the customer's names, no login form, and "Proceed to checkout" leads to the "Billing Address" step | UI | The message text and the direct navigation exist only in the page; one case, the names' source is T10 | writes, known issue | UI-062 |

**Not tested:** nothing in the five criteria is dropped. Seen in the app but not in the story, so not planned: the "Continue as Guest" tab (guest checkout with email, first and last name), the register and forgot-password links under the form, the form's validation (required, email format, password 6-40 characters), the page's "Invalid email or password" alert for wrong credentials (a failed-login scenario would also count toward the account lockout), and the TOTP step's "TOTP code is required" message.

**Totals:** 11 items: 6 API, 5 UI (4 journeys: T1, T7, T9, T11; T2 is a display check with its own UI-only reason); 1 already covered by an existing scenario (T8, API-0078). Flags: 10 writes, 5 data, 0 dangerous, 1 known issue (T11, suspected), 0 contract gaps.

**Scenarios written:** 10 new, all `manual`: 5 API (API-0308..API-0311 in `post-users-login.yml`, API-0312 in `get-users-me.yml`) and 5 UI (UI-058..UI-062 in the new `checkout-sign-in.yml`). The contract gaps for the engineer to close when automating: the text "Invalid TOTP" (API-0311) and the restricted-token 401 (API-0310) are not in Users_API.md.

## Open questions

- **T11, suspected bug (from the source and the translation file, not reproduced).** The story says "You are already signed in as [First Name] [Last Name]". The app's `pages.checkout.sign-in.already` says "Hello {first_name} {last_name}, you are already logged in. You can proceed to checkout." The same message also shows right after a successful login (T9). It could not be seen live: the inspector cannot reach step 2 without a cart in the browser. Next step: `/report-bug` reproduces it, then `knownIssue` and `bug` go on T11's scenario. T9 checks the signed-in state, not the exact text.
- **AC3 "6-digit".** The page's TOTP input is a plain text field (no `maxlength`, `pattern` or digit check) and the server accepts any string and answers 401 for a wrong one. No digit-count check on either layer.
- **Contract gaps in the facts T3-T6 rely on.** They are `_(source)_`; the restricted-token 401 on `GET /users/me` (T4) is not in Users_API.md (only Product_Specs_API.md mentions it, for writes). Add it when T4 is automated. `POST /totp/setup`, `POST /totp/verify` and `POST /totp/login/totp` are in no contract.
- **Self-service TOTP flags.** The TOTP account is made with `PATCH /users/{userId}` (`totp_enabled`, `totp_secret`), which relies on the suspected bug "self-service account flags" (Users contract Notes). If that is fixed, the setup breaks and the route `POST /totp/setup` + `POST /totp/verify` has to be used, after a contract exists for it.

## Notes

- **T11 against the story's wording** (the user's decision): flagged `known issue` (suspected), with no `knownIssue` written until `/report-bug` reproduces it.
- **AC3 "6-digit"** (the user's decision): no digit-count check; T7 checks that the TOTP field is displayed and what follows a wrong and a right code.
- **TOTP account setup** (the user's decision): option (a), `PATCH /users/{userId}` with the customer's own token, `totp_enabled: true` and a known base32 `totp_secret` (Users contract §13), on a throwaway customer.
- **T4 kept** (the user's decision): "must enter a valid code to proceed" is read as: the first-step token can't be used as a session.
- **T1 and T2 kept as two scenarios** (the user's decision), one per criterion, although they share their setup and page state.
- **T9 customer** (the user's decision): the run's customer. A successful login changes nothing other tests rely on; the cart is created by the guest.
- **No duplicate of the Billing Address coverage** (the user's decision): T9 and T11 are the scenarios that assert the Billing Address step is reached from sign-in; UI-041..UI-048 use that "Proceed" only as setup.
- **TOTP code helper:** both setup routes and T5, T7 need the current 6-digit code computed from the secret (RFC 6238: HMAC-SHA1, 30-second step). The project has no TOTP helper or dependency; a small helper on `node:crypto` is needed for the API and UI specs. A note for the engineer, not a test item.
- **Existing coverage:** API-0078 covers T8. UI-054 shows the "Sign in" step to the logged-in default user and doesn't cover T1. API-0082 and API-0083 are the TOTP step with a full or an invalid token, not the AC3 rules. API-0063 is the base of T10 (names not empty).
- **Where the scenarios go:** T3-T6 in `test-scenarios/api/users/post-users-login.yml`, T10 in `test-scenarios/api/users/get-users-me.yml`, T1, T2, T7, T9 and T11 in a new `test-scenarios/ui/cart/checkout-sign-in.yml` (area `cart`, tag `@cart`; T1, T2, T7 and T9 with `role: guest`, T11 with the default role).
- **Page object:** `LoginPage` is the `/auth/login` page; the checkout step needs its own part. The ids from the source are `email`, `password`, `login-submit`, `login-error`, `totp-code`, `verify-totp`, `proceed-2`; the tabs "Sign in" / "Continue as Guest" sit above the form. The page object's author confirms them against the page.
- **Wrong TOTP codes and the lockout:** per `UserService::login`, only wrong email or password counts toward the lockout, not a wrong TOTP code. The TOTP account is a throwaway anyway.
- **Sources for the layer decisions:** the app's source (`practice-software-testing/sprint5`, read-only), used only to decide where each rule is enforced: `UI/src/app/checkout/login/login.component.{ts,html}`, `checkout.component.html`, `cart/cart.component.{ts,html}`, `assets/i18n/en.json`, `API/.../UserService.php::login`, `UserController::login`, `Middleware/Authenticate.php`, `TOTPService.php`, `PatchCustomer.php`, `routes/api.php`. One inspector run: `/checkout` as the default role, no steps (only the wizard's step titles).
