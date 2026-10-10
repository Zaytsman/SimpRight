# User registration

<!-- Written by the requirements-analyst agent (/analyze-requirements). Source: docs/ui/user-stories/User_Registration.md -->

| | |
|---|---|
| **Source** | [User_Registration.md](../ui/user-stories/User_Registration.md) |
| **Type** | User story |
| **Criteria in scope** | AC1-AC6 (all) |
| **Analysed** | 2026-10-10 |

## Summary

A new visitor wants to create an account on the registration page, with strong-password validation and live feedback, to access the application. The form asks for first name, last name, date of birth (YYYY-MM-DD), street, postal code (numeric), city, state, country (dropdown), phone (numeric) and email (max 256, RFC format), plus a password. While the visitor types the password, a list of four requirements and a five-level strength indicator (20% to 100%) should update at once. A duplicate email shows "Email is already in use.". A successful submit creates the account, sends a confirmation email and redirects to the login page. The story names no other error texts.

## Acceptance criteria

- **AC1 – Registration form fields**: Given the registration form is displayed, then the required fields First name, Last name, Date of birth (ISO YYYY-MM-DD), Street, Postal code (numeric), City, State, Country (dropdown), Phone (numeric only), Email (max 256, RFC-compliant) and Password are shown.
- **AC2 – Password requirements displayed**: Given the password input is focused, then a list of requirements is displayed: at least 8 characters, upper and lower case, at least one number, at least one special character.
- **AC3 – Real-time password validation**: Given I type in the password field, then the requirements update immediately to show which rules are fulfilled.
- **AC4 – Password strength indicator**: Given I am entering a password, then a strength indicator shows Weak (1 criterion, 20%), Moderate (2, 40%), Strong (3, 60%), Very Strong (4, 80%) or Excellent (all, 100%).
- **AC5 – Duplicate email**: Given the email is already registered, then the error "Email is already in use." is displayed.
- **AC6 – Successful registration**: Given all fields are valid, when I submit the form, then the account is created, a confirmation email is sent to the registered address, and I am redirected to the login page.

## What it touches

- **API:** `POST /users/register` ([Users_API.md](../api/contracts/Users_API.md) §2, and "Data required for successful requests": Strong password, Adult date of birth, Unique email); `POST /users/login` (§1) and `GET /users/me` (§5) to read an account back.
- **UI:** the registration page (`/auth/register`, reached from "Sign in"), and the login page (`/auth/login`, the redirect target).
- **Data:** a customer registered through the API for the duplicate email (T18); unique emails and a valid country and postal code pair such as `NL` and `1011AB` (T4, T5, T18, T20); an admin token to delete every customer a test created.

## Test plan

API first: a check goes to the UI only when the API can't prove it ([layer rules](../../.claude/skills/analyze-requirements/references/layer-rules.md)).

| Item | Criterion | What to check | Layer | Why this layer | Flags | Scenarios |
|---|---|---|---|---|---|---|
| T1 | AC1 | The registration page shows First name, Last name, Date of Birth (placeholder YYYY-MM-DD), Street, Postal code, City, State, Phone, Email address and Password, a Country dropdown (a select with a country list), and the Register button | UI | Only the page shows the form and its labels | | UI-086 |
| T2 | AC1 | Clicking Register on the empty form shows a "required" alert for each of the story's fields, and the page stays on `/auth/register` | UI | Eight of the twelve fields (date of birth, street, city, state, country, postal code, house number, phone) are required only in the browser: `StoreCustomer` requires just first name, last name, email and password. One submit shows them all; the four server rules are T3 | | UI-087 |
| T3 | AC1 | `POST /users/register` with first name, last name, email and password missing returns 422 with a message for each of the four keys | API | The server enforces them (`required` rules, contract §2 422) | | API-0087 (existing) |
| T4 | AC1 | With every other field valid, a phone with letters (e.g. "06-abc") is highlighted as invalid with the phone format error, and no account is created | UI | "Numeric only" exists only in the browser (`Validators.pattern(/^\d\d*$/)`): the server accepts any string up to 24 characters (source) | data | UI-088 |
| T5 | AC1 | With every other field valid, an email that is clearly not an address (no "@") is highlighted as invalid with the email format error, and no account is created | UI | The server has no email format rule (only required, unique, string, max 256, source); the browser checks the format | data | UI-089 |
| T6 | AC1 | `POST /users/register` with a 257-character email returns 422 with an `email` message | API | The server enforces the 256 limit (contract §2) | | API-0094 (existing) |
| T7 | AC1 | `POST /users/register` with a well-formed email of exactly 256 characters returns 201, and the stored email equals the one sent | API | The boundary the criterion names; the server enforces the limit (contract §2). `UserFactory.emailOfLength(256)` exists | writes, data | API-0328 |
| T8 | AC1 | `POST /users/register` with a dob not in YYYY-MM-DD (DD-MM-YYYY) returns 422 with a `dob` message; a valid ISO dob is stored | API | The server enforces `date_format:Y-m-d` (contract §2, "Adult date of birth"). The criterion names no message, so no UI item | | API-0093, API-0086 (existing) |
| T9 | AC1 | `POST /users/register` with country "DE" and a postal code with letters (e.g. "ABCDE") returns 422 with an `address.postal_code` message | API | The server checks the postal code against the country's format (`PostcodeFormat::matches` in `StoreCustomer`, contract §2). The accepted side is API-0305 | | API-0330 |
| T10 | AC2 | With the password field focused, the page lists "Be at least 8 characters long", "Contain both uppercase and lowercase letters", "Include at least one number" and "Have at least one special symbol (e.g., @, #, $, etc.)" | UI | Texts that exist only in the page | | UI-090 |
| T11 | AC2 | `POST /users/register` with a 7-character password that meets the other rules returns 422 with a `password` message; an 8-character password that meets all rules returns 201 | API | The server enforces the length (`Password::min(8)`, contract "Strong password"). Random passwords, because the server also rejects passwords found in public breaches | writes, data | API-0329, API-0331 |
| T12 | AC2 | `POST /users/register` with a password that has no uppercase letter (otherwise valid) returns 422 with a `password` message; the same with no lowercase letter | API | The server enforces `mixedCase()` (contract "Strong password") | | API-0332, API-0333 |
| T13 | AC2 | `POST /users/register` with a password that has no number (otherwise valid) returns 422 with a `password` message | API | The server enforces `numbers()` (contract "Strong password") | | API-0334 |
| T14 | AC2 | `POST /users/register` with a password that has no special character (otherwise valid) returns 422 with a `password` message | API | The server enforces `symbols()` (contract "Strong password") | | API-0335 |
| T15 | AC3 | While the cursor stays in the password field, typing a password that meets some rules (e.g. "abcdefgh": length only) marks only the met requirements as fulfilled; typing more characters ("A1!") marks all four | UI | No endpoint: the page evaluates the rules in the browser. Typing, not submitting, is the action | known issue (suspected, source only) | UI-091 |
| T16 | AC4 | Typing passwords that meet 1, 2, 3, 4 and all 5 criteria highlights Weak, Moderate, Strong, Very Strong and Excellent in turn, with the bar at 20%, 40%, 60%, 80% and 100% | UI | No endpoint: the page works out the strength in the browser (`passwordStrength`, `getStrengthWidth`) | known issue (suspected, source only) | UI-092..UI-096 |
| T17 | AC5 | `POST /users/register` with an already registered email returns 409 and the `email` message "A customer with this email address already exists."; with another invalid field it returns 422 | API | The server enforces uniqueness and builds the message (contract §2, `BaseFormRequest`) | | API-0096, API-0097 (existing) |
| T18 | AC5 | A customer registered through the API exists. On the registration page, fill every field with valid values and that customer's email, click Register: the error "Email is already in use." is shown and the page stays on the form | UI | Only the page shows the error; the rule itself is T17. The source suggests the page prints the server's text instead (see Open questions) | writes (setup), data, known issue (suspected, source only) | UI-097 |
| T19 | AC6 | `POST /users/register` with valid values returns 201 with the new id and the sent values; logging in with that email and password returns 200, and `GET /users/me` returns the new id and email | API | The server creates and stores the account; reading it back proves it (contract §2, §1, §5) | | API-0085, API-0086 (existing) |
| T20 | AC6 | Journey: on the registration page, fill every field with valid values and click Register: the browser lands on `/auth/login` (the login form is shown); then logging in through the API with those credentials returns 200, and `GET /users/me` returns the first name, last name and email entered | UI | The redirect is the page's own (`redirectToLogin`), and the page builds the register payload from the form: only the UI can prove the form sends what was typed. The server rules are T19 | writes, data | UI-098 |

**Not tested:**
- AC6, "a confirmation email is sent": no endpoint, mailbox or page shows it. In the source, `UserService::registerUser` queues the Register mail only when `APP_ENV=local`, so the live app probably sends none.

**Totals:** 20 items: 11 API (T3, T6, T7, T8, T9, T11, T12, T13, T14, T17, T19), 9 UI (1 journey: T20; the others are display or browser-only checks, each with its UI-only reason); 5 already covered by existing scenarios (T3, T6, T8, T17, T19). New scenarios: 21 = 8 API (API-0328..0335, appended to `post-users-register.yml`) + 13 UI (UI-086..098, in the new `test-scenarios/ui/account/user-registration.yml`). The 15 planned became 21 because T11 split into an accepted and a rejected case (API-0329, API-0331), T12 into two (API-0332, API-0333) and T16 into one scenario per strength level (UI-092..096, as UI-032..036 do). Flags: 4 writes (T7, T11, T18, T20), 6 data (T4, T5, T7, T11, T18, T20), 0 dangerous, 3 suspected known issues (T15, T16, T18), 0 contract gaps.

## Open questions

- **AC5 text (T18), suspected, not reproduced.** The story wants "Email is already in use."; the API answers 409 with "A customer with this email address already exists." (API-0096), and the source shows the page prints the server's text (only a plain-string "Duplicate Entry" body becomes "Email is already in use."). T18 expects the story's text and carries no `knownIssue` until `/report-bug` reproduces it.
- **AC3 and AC4 (T15, T16), suspected, not reproduced.** The form group uses `updateOn: 'blur'`, so the password's model value changes only on blur. The requirement list reads the model (it would turn green on blur, not while typing), and the strength indicator is computed from the model value in the `input` handler, i.e. from the value at the last blur. The inspector can't type, so none of this is confirmed. Both items carry no `knownIssue` until `/report-bug` reproduces them.
- **AC6, confirmation email:** not observable and probably not sent on the live site; not tested.
- **Contract §2** mostly holds `_(source)_` facts for the new API items (T7, T9, T11..T14); they get tagged `_(verified)_` when those scenarios are automated. The 422 key for a wrong postal code (`address.postal_code`) is not in the contract yet.

## Notes

- **Levels** (the user's decision): T16 follows the source's 5 criteria (length, lowercase, uppercase, digit, special character), as UI-032..036 do, although AC2 lists 4 requirements.
- **T11..T14 kept** (the user's decision): AC2 only says "displayed", but the same rules are proved on the server. API-0090 covers only the all-lowercase password, which fails all four at once.
- **T9 tests DE only** (the user's decision): "Postal code (numeric)" is not read literally; the app checks a per-country format (27 countries; `NL` "1011AB" is valid), on the browser and on the server. Countries without a format are unchecked.
- **House number left out** (the user's decision): the app requires a "House number" field the story doesn't list. T1 and T2 follow the story's fields only. Note for the UI writer and engineer: when country, postal code and house number are filled, the page's postcode lookup (`GET /postcode-lookup`) overwrites street, city and state; wait for the `postcode-lookup-loading` indicator to go away before typing those three.
- **T5** (the user's decision): uses only a clearly invalid email (no "@"). The browser uses a simplified regex, not a full RFC check, and the server has no format rule.
- **T4** (the user's decision): "numeric only" for the phone is browser-only; the server accepts letters (source). No API item and no bug from this story.
- **T4 and T5 kept** (the user's decision), though they could be dropped without losing a server rule.
- **T16 separate** (the user's decision): registration gets its own scenarios and is not merged with UI-032..036 (the same levels on the profile page's change-password form).
- **Writes allowed** (the user's decision): T7, T11, T18 (setup) and T20 create customers, each with cleanup. The rejection items create nothing by design, but a customer appears if the rule fails, so every test should register its cleanup. A customer created through the UI (T20, or T4/T5 when the rule fails) is removed by logging in with its credentials, reading `GET /users/me` and deleting the id as admin.
- **Page object:** none for `/auth/register`. Data-test ids (inspector): `register-form`, `first-name`, `last-name`, `dob`, `country`, `postal_code`, `house_number`, `street`, `city`, `state`, `phone`, `email`, `password`, `register-submit`, `postcode-lookup-hint`; errors `<field>-error` and `register-error`, shown after a submit; the strength labels and the requirement list have no data-test ids. Page heading "Customer registration".
- **Test data:** `UserFactory.registerCustomer()` registers the customer for T18 (the `throwawayCustomerTest` fixture also logs the customer in, which T18 doesn't need); `UserFactory.emailOfLength(256)` for T7. The registration page is public, so its UI scenario area (for example `account`, `users` or `cart`) is left to the scenario writer.
- **Sources for the layer decisions:** the app's source (`practice-software-testing/sprint5`, read-only) was used only to decide where each rule is enforced: `UI/src/app/auth/register/register.component.{ts,html}`, `shared/password-input/*`, `shared/customer-account.service.ts`, `API/app/Http/Requests/Customer/StoreCustomer.php`, `BaseFormRequest.php` and `UserService::registerUser`. One inspector run as a logged-out visitor: `/auth/register` (`test-results/inspect/auth-register-none.md`).
