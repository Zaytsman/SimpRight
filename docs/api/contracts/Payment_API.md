# Payment API Documentation

The payment pre-check of the Toolshop API: one public endpoint that validates the payment details a customer typed in the checkout (bank transfer, credit card, buy now pay later, gift card, cash on delivery) before the order is placed. It stores nothing and charges nothing; the order itself is created by `POST /invoices` (see `Invoices_API.md`).

> Written on 2026-10-10 from the Laravel source (`sprint5/API`: `routes/api.php`, `PaymentController`, `app/Payments/GiftCard.php`, `Controller::preferredFormat`, `app/Exceptions/Handler.php`, `app/Http/Kernel.php`, `tests/Feature/PaymentTest.php`), the OpenAPI spec (`storage/api-docs/api-docs.json`, tag `Payment`) and calls to the live API (`POST /payment/check` with made-up payment details, plus `GET`, `PUT` and `OPTIONS` on the same path). No data is read or changed by this endpoint. Facts are tagged by origin.

## Base URL

`https://api.practicesoftwaretesting.com` (see `apiBaseUrl` in `src/envs/<ENV>.json`).

## Authentication

- None. The route is outside every auth group and has no middleware of its own: no token is needed, and an invalid `Authorization: Bearer ...` header is ignored (`200` with a made-up token). _(verified)_
- There are no roles and no account-state checks on this endpoint. _(source)_

## Endpoints Overview

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/payment/check` | Validate the payment details of the chosen payment method | None |

## Data required for successful requests

| Data | Needed by | Requirements |
|---|---|---|
| `payment_method` | `POST /payment/check` | One of the values in Enums, written exactly (lower case, hyphenated). Any other value, or none, skips all validation and gives `200` (see Notes). _(verified)_ |
| `payment_details` for `bank-transfer` | `POST /payment/check` | `bank_name` (letters and spaces), `account_name` (letters, digits, spaces, `.`, `'`, `-`) and `account_number` (digits only), each a string of at most 255 characters. _(source)_ |
| `payment_details` for `credit-card` | `POST /payment/check` | `credit_card_number` as `dddd-dddd-dddd-dddd`, `expiration_date` as `m/Y` in a month after the current one, `cvv` of 3 or 4 digits, `card_holder_name` (letters and spaces, at most 255). _(verified)_ |
| `payment_details` for `buy-now-pay-later` | `POST /payment/check` | `monthly_installments`, a number. _(verified)_ |
| `payment_details` for `gift-card` | `POST /payment/check` | `gift_card_number` of exactly 16 letters or digits and `validation_code` of exactly 4 letters or digits. _(verified)_ |
| `payment_details` for `cash-on-delivery` | `POST /payment/check` | Nothing; the details are not read. _(source)_ |
| `Accept: application/json` header | `POST /payment/check` | Needed to get a `422` body instead of a redirect when the details are invalid (see the endpoint's error responses). _(verified)_ |

## Endpoints

### 1. Check payment

Validates the details of the chosen payment method and answers `200` with `{ message: "Payment was successful" }` when they pass. Only the method named in `payment_method` is validated, and all of its fields are validated together, so a `422` lists every failing field. Nothing is stored. _(verified)_

The check runs only for the five exact values in Enums. For any other `payment_method` (a different case such as `"Bank Transfer"`, an unknown string, an array, or none) and for an empty body, nothing is validated and the answer is `200`. _(verified)_

**Endpoint:** `POST /payment/check`

**Auth:** None _(verified)_

**Request Body:**
```ts
{
  payment_method?: PaymentMethod;     // see Enums; the source never requires it
  payment_details?: PaymentDetails;   // fields depend on payment_method, see Data Models
}
```

The spec marks the request body as required and lists `payment_method` and `payment_details` without required fields; the code requires neither (an empty body gives `200`). _(verified)_

Rules by method, applied to `payment_details.<field>` (all must pass; a missing field is `required`): _(source)_

| `payment_method` | Field | Rule |
|---|---|---|
| `bank-transfer` | `bank_name` | required, string, max 255, `^[a-zA-Z ]+$` _(verified)_ |
| `bank-transfer` | `account_name` | required, string, max 255, `^[a-zA-Z0-9 .'-]+$` _(verified)_ |
| `bank-transfer` | `account_number` | required, string, max 255, `^\d+$` _(verified)_ |
| `credit-card` | `credit_card_number` | required, string, `^\d{4}-\d{4}-\d{4}-\d{4}$` (dashes required) _(verified)_ |
| `credit-card` | `expiration_date` | required, format `m/Y`, after today _(verified)_ |
| `credit-card` | `cvv` | required, string, `^\d{3,4}$` _(verified)_ |
| `credit-card` | `card_holder_name` | required, string, max 255, `^[a-zA-Z ]+$` _(verified)_ |
| `buy-now-pay-later` | `monthly_installments` | required, numeric (a number or a numeric string) _(verified)_ |
| `gift-card` | `gift_card_number` | required, string, `^[A-Za-z0-9]{16}$` _(verified)_ |
| `gift-card` | `validation_code` | required, string, `^[A-Za-z0-9]{4}$` _(verified)_ |
| `cash-on-delivery` | none | not validated _(source)_ |

**Response:** `200 OK` _(verified)_
```ts
{
  message: string;   // "Payment was successful"
}
```

With `Accept: text/xml` the same answer is XML: `<response><message>Payment was successful</message></response>`, with `Content-Type: text/xml; charset=utf-8`. _(verified)_ The spec's example message is `"Success status"`; the real message is `"Payment was successful"`. _(verified)_

**Error Responses:**
- `422 Unprocessable Entity`: the details of the named method are missing or invalid, sent with `Accept: application/json`. The body is Laravel's default validation body, `{ message, errors }`, where `message` is the first error plus `(and N more errors)` and `errors` maps `payment_details.<field>` to a list of messages. It is not the flat field map the other areas return. The attribute names in the messages read `payment details.bank name`. _(verified)_
- `302 Found`: the same invalid details sent without `Accept: application/json` (no `Accept` header, or `Accept: text/xml`). The framework treats the request as a browser form and redirects, with `Location: https://api.practicesoftwaretesting.com` and an HTML body, instead of answering `422`; framework default for a request that doesn't expect JSON. _(verified)_

**Example:**
```http
POST /payment/check
Accept: application/json
Content-Type: application/json

{ "payment_method": "bank-transfer" }

422 Unprocessable Entity
{
  "message": "The payment details.bank name field is required. (and 2 more errors)",
  "errors": {
    "payment_details.bank_name": ["The payment details.bank name field is required."],
    "payment_details.account_name": ["The payment details.account name field is required."],
    "payment_details.account_number": ["The payment details.account number field is required."]
  }
}
```

```http
POST /payment/check
Accept: application/json
Content-Type: application/json

{ "payment_method": "gift-card", "payment_details": { "gift_card_number": "ABCD1234efgh5678", "validation_code": "1a2B" } }

200 OK
{ "message": "Payment was successful" }
```

## Data Models

### PaymentDetails

The object under `payment_details`. Only the fields of the chosen method are read; unknown fields are ignored. _(source)_

```ts
type PaymentDetails =
  | BankTransferDetails
  | CreditCardDetails
  | BuyNowPayLaterDetails
  | GiftCardDetails
  | {};   // cash-on-delivery

interface BankTransferDetails {
  bank_name: string;       // letters and spaces
  account_name: string;    // letters, digits, spaces, . ' -
  account_number: string;  // digits only
}

interface CreditCardDetails {
  credit_card_number: string;  // "1234-5678-9101-1121"
  expiration_date: string;     // "m/Y", e.g. "12/2030"
  cvv: string;                 // 3 or 4 digits
  card_holder_name: string;    // letters and spaces
}

interface BuyNowPayLaterDetails {
  monthly_installments: number;   // the spec types it as a string; the code accepts any numeric value
}

interface GiftCardDetails {
  gift_card_number: string;   // 16 letters or digits
  validation_code: string;    // 4 letters or digits
}
```

### PaymentCheckResponse

```ts
interface PaymentCheckResponse {
  message: string;   // "Payment was successful"
}
```

### PaymentCheckValidationError

The `422` body, with `Accept: application/json`. _(verified)_

```ts
interface PaymentCheckValidationError {
  message: string;                       // first error, plus "(and N more errors)" when there are more
  errors: Record<string, string[]>;      // key: "payment_details.<field>"
}
```

## Enums

### PaymentMethod

The values of `payment_method` that trigger validation. They are the same values `POST /invoices` accepts. _(source)_

| Value | Validated fields |
|---|---|
| `bank-transfer` | `bank_name`, `account_name`, `account_number` |
| `cash-on-delivery` | none |
| `credit-card` | `credit_card_number`, `expiration_date`, `cvv`, `card_holder_name` |
| `buy-now-pay-later` | `monthly_installments` |
| `gift-card` | `gift_card_number`, `validation_code` |

## Error Handling

- Validation failures are thrown by `$request->validate(...)` in the controller, not by a form request, so the body is Laravel's default (`{ message, errors }`) and not the flat `{ field: [messages] }` map of the `BaseFormRequest` areas (Favorites, Invoices). _(source)_ Observed with `Accept: application/json`. _(verified)_
- Without `Accept: application/json` the same failure is a `302` redirect (see the endpoint's error responses). The API's own handler (`app/Exceptions/Handler.php`) doesn't change this. _(verified)_
- `405 Method Not Allowed`: any method other than `POST` and `OPTIONS` on `/payment/check`, e.g. `GET` or `PUT`; `{ message: "Method is not allowed for the requested route" }`. Shared by every route, so it isn't listed under the endpoint. _(verified)_
- No `400` or `415`: a malformed JSON body or a non-JSON `Content-Type` is read as an empty request and gives `200` (see Notes). _(verified)_
- Responses carry `Cache-Control: no-cache, private`. _(verified)_

## Notes

- **Only exact method names are checked.** Anything else gives `200`. The service's own tests send display names (`"Bank Transfer"`, `"Credit Card"`) and get `200` without any validation; only `bank-transfer`, `credit-card`, `buy-now-pay-later` and `gift-card` are really validated. A client or test that sends a misspelt method sees a success. _(verified)_ Possibly intended (the endpoint is a pre-check), but there is no `422` for an unknown method.
- **Empty and malformed bodies succeed.** `{}`, a body that isn't valid JSON (`{"payment_method":`), and a `text/plain` body all give `200`; the framework reads them as no input. _(verified)_ A form-urlencoded body is read like JSON (`payment_method=bank-transfer` gives `422`). _(verified)_
- **`payment_details` of the wrong type:** for `bank-transfer`, `payment_details: "abc"` gives the same `422` as a missing object. _(verified)_
- **Expiry month:** `expiration_date` must be after today, so the current month is rejected: on 2026-10-10, `10/2026` gave `422` ("must be a date after today") and `11/2026` gave `200`. A month that doesn't exist (`13/2030`) fails the format rule: "must match the format m/Y". _(verified)_ Dates must use the `m/Y` form with a slash; `2099-12` fails the format rule. _(verified)_
- **Field limits:** `max:255` on the bank and card holder names and on `account_name` and `account_number` comes from the source and wasn't tried live (a 20-digit account number passed). _(source)_
- **Number of installments:** `monthly_installments: 6` passes and `"abc"` gives `422` ("must be a number"); the spec types the field as a string. _(verified)_
- **Pre-check only.** The class comment of `GiftCard` calls this check a "pre-check" and `StoreInvoice` the "authoritative order validation"; on `POST /invoices` the only format rules for `payment_details` are the gift card ones, so a bank transfer or credit card whose details would fail this check isn't rejected there for its format. The two endpoints validate independently: passing this check doesn't make an order valid. _(source)_
- **OPTIONS:** `OPTIONS /payment/check` gives `204` with `Allow: POST` and no body. _(verified)_
- **XML:** `Accept: text/xml` returns XML for the `200` (`Controller::preferredFormat`); the `422` becomes a `302` as described above. _(verified)_
- **OpenAPI spec vs source:**
  - The spec documents only `200`; the code also answers `422` (and `302` without `Accept: application/json`). _(verified)_
  - The spec marks the request body as required, and its `PaymentRequest` has no required fields; the code requires nothing, and an empty body gives `200`. _(verified)_
  - The spec's example message `"Success status"` differs from the real `"Payment was successful"`. _(verified)_
  - `BuyNowPayLaterDetails.monthly_installments` is a string in the spec; the code validates `numeric`. _(source)_
  - The spec's per-method detail schemas have no required fields and no formats; the rules are only in the code. _(source)_
