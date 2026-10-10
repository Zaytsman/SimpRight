# Invoices API Documentation

The orders of the Toolshop API: a checkout turns a cart into an invoice with a payment. This area lists, searches and reads invoices, downloads their PDF, creates invoices (for a logged-in user or a guest), and updates an invoice's billing address or status. Every endpoint needs a token except `POST /invoices/guest`.

> Written on 2026-10-10 from the Laravel source (`sprint5/API`: `routes/api.php`, `InvoiceController`, `InvoiceService`, the `StoreInvoice`/`PatchInvoice` form requests, the `Invoice`, `Invoiceline`, `Payment` and `Download` models and their migrations, `Authenticate`, `HandleQueryMethod`, `app/Exceptions/Handler.php`, the `InvoiceGenerate`, `CreateInvoicePDF` and `OrderUpdate` jobs, `tests/Feature/InvoiceTest.php`), the OpenAPI spec (`storage/api-docs/api-docs.json`, tag `Invoice`) and read-only calls to the live API without a token (`GET` and `QUERY` only). No token was available, so no response of a logged-in user was seen and no invoice was created or changed. Facts are tagged by origin.

## Base URL

`https://api.practicesoftwaretesting.com` (see `apiBaseUrl` in `src/envs/<ENV>.json`).

## Authentication

- Scheme: `Authorization: Bearer <JWT>` from `POST /users/login` (see `Users_API.md`). The token expires after 300 seconds. _(source)_
- Every invoice endpoint except `POST /invoices/guest` needs a valid token: `InvoiceController` applies the `auth:users` middleware to all actions but `storeGuest`. _(source)_
- Without a token, or with a malformed token, the endpoints return `401` with `{ message: "Unauthorized" }`. _(verified)_ (seen for the five `GET` endpoints and `QUERY /invoices/search`; the write endpoints share the same middleware _(source)_) An expired or logged-out token gives the same `401`. _(source)_
- A restricted token (the intermediate token of the two-factor login flow, with the `restricted` claim) gets `401` with `{ message: "Unauthorized token usage" }`. _(source)_
- There is no role middleware. The JWT's `role` claim (`admin` or `user`) changes only what the read endpoints return: an admin's list, search and read cover every invoice, any other user's cover only their own invoices (`user_id` = the token's user). _(source)_
- **Account state, shared by every protected endpoint:** a disabled account (`enabled: false`) gets `403` with `{ message: "Account disabled." }`. The middleware caches the user for 60 seconds, so a change can take up to a minute to apply. _(source)_
- Ownership is checked inconsistently: `GET /invoices/{invoiceId}`, the list and the search are limited to the caller's invoices (admin: all), `PUT` and `PATCH /invoices/{invoiceId}` are limited to the caller's own invoices even for an admin, and the status update and both PDF endpoints check nothing (see Notes). _(source)_

## Endpoints Overview

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/invoices` | List invoices (paginated), own or all for an admin | Any logged-in user |
| GET | `/invoices/search` | Search invoices by number, billing street or status | Any logged-in user |
| QUERY | `/invoices/search` | Search invoices, criteria in a JSON body | Any logged-in user |
| GET | `/invoices/{invoiceId}` | Get one invoice with its lines and payment | Any logged-in user (own invoice) or admin |
| GET | `/invoices/{invoice_number}/download-pdf` | Download the generated PDF of an invoice | Any logged-in user |
| GET | `/invoices/{invoice_number}/download-pdf-status` | Get the generation status of an invoice's PDF | Any logged-in user |
| PUT | `/invoices/{invoiceId}/status` | Set the status (and status message) of an invoice | Any logged-in user |
| POST | `/invoices` | Create an invoice and its payment from a cart | Any logged-in user |
| POST | `/invoices/guest` | Create an invoice and its payment from a cart, as a guest | None |
| PUT | `/invoices/{invoiceId}` | Update an invoice of the caller | Any logged-in user (own invoice) |
| PATCH | `/invoices/{invoiceId}` | Partially update an invoice of the caller | Any logged-in user (own invoice) |

## Data required for successful requests

| Data | Needed by | Requirements |
|---|---|---|
| Access token | every endpoint except `POST /invoices/guest` | A token from `POST /users/login` for an enabled account. A customer token sees only that customer's invoices; an admin token sees all. |
| Invoice id (ULID) | `GET`, `PUT`, `PATCH /invoices/{invoiceId}`, `PUT /invoices/{invoiceId}/status` | The `id` returned by `POST /invoices` or listed in `data[]` by `GET /invoices`. For `GET`, `PUT` and `PATCH` it must belong to the caller (admin: any, for `GET` only). |
| Invoice number | `GET /invoices/{invoice_number}/download-pdf` and `.../download-pdf-status` | The `invoice_number` field of an invoice (`INV-<year><6 digits>`, e.g. `INV-2022000002`), not its id. |
| A generated PDF | `.../download-pdf` (`200`) | The PDF is made by a scheduled job (every minute) after the invoice exists, so a new invoice has none for a minute or more; until then the status endpoint answers `400` and the download `404`. |
| Cart id (ULID) | `POST /invoices`, `POST /invoices/guest` (`cart_id`) | The `id` of an existing cart (`POST /carts`, see `Carts_API.md`) with at least one item, or the invoice has no lines and a total of 0. The cart isn't deleted by the checkout. |
| Payment method and details | `POST /invoices`, `POST /invoices/guest`, `PUT /invoices/{invoiceId}` | `payment_method` is one of the Enums below, and `payment_details` (the key must be present) carries the fields of that method (see Data Models). A gift card needs a 16-character card number and a 4-character code on `POST /invoices` and `PUT`. |
| A consistent billing address | `POST /invoices`, `POST /invoices/guest`, `PUT /invoices/{invoiceId}` | For a country with a known postcode format (for example `NL`, `AT`, `US`), `billing_postal_code` must match it, and `billing_city` and `billing_state` must be those that `GET /postcode-lookup` (no contract yet) returns for the country and postcode. Without a postal code, nothing is cross-checked. |
| Guest identity | `POST /invoices/guest` | `guest_email` (a valid email), `guest_first_name` and `guest_last_name`. |
| Valid status | `PUT /invoices/{invoiceId}/status` | One of the invoice statuses in the Enums below. |

## Endpoints

### 1. List invoices

Returns a page of invoices, newest `invoice_date` first, 15 per page. An admin gets every invoice (guest invoices included); any other user gets only the invoices whose `user_id` is theirs. Each item has its lines (with a slim product and its image) and the payment method. _(source)_

**Endpoint:** `GET /invoices`

**Auth:** Any logged-in user _(source)_

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `page` | integer | No | Page number, starting at 1 _(spec)_ |

**Response:** `200 OK` _(source)_
```ts
{
  current_page: number;
  data: InvoiceSummary[];   // see Data Models
  from: number | null;
  last_page: number;
  per_page: number;         // 15 (the paginator's default, no explicit size in the code)
  to: number | null;
  total: number;
}
```

`PaginateMiddleware` removes `first_page_url`, `links`, `meta`, `last_page_url`, `next_page_url`, `prev_page_url` and `path` from the paginator's output. The service's tests assert `current_page` and `data`, and that a customer sees only their own invoices. An empty list is `200` with `data: []`. _(source)_

**Error Responses:**
- `401 Unauthorized`: no token, or a malformed token, with `{ message: "Unauthorized" }` _(verified)_; an expired token gives the same _(source)_

---

### 2. Search invoices

Searches the invoices visible to the caller (own, or all for an admin) with a `LIKE '%q%'` on `invoice_number`, `billing_street` and `status`. Same page shape and ordering as the list. _(source)_

**Endpoint:** `GET /invoices/search`

**Auth:** Any logged-in user _(source)_

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `q` | string | No | Search phrase. The spec marks it required; the code doesn't, and without it the pattern is `%%`, which matches every invoice visible to the caller. `%` and `_` in `q` aren't escaped. _(source)_ |
| `page` | integer | No | Page number, starting at 1 _(spec)_ |

**Response:** `200 OK` _(source)_
```ts
{
  current_page: number;
  data: InvoiceSummary[];   // see Data Models
  from: number | null;
  last_page: number;
  per_page: number;
  to: number | null;
  total: number;
}
```

**Error Responses:**
- `401 Unauthorized`: no token, or a malformed token, with `{ message: "Unauthorized" }` _(verified)_

**Example:** `GET /invoices/search?q=INV-2026&page=1`

---

### 3. Search invoices (HTTP QUERY)

Same as `GET /invoices/search`, but the criteria are sent as a JSON body (RFC 10008 `QUERY` method). The `query.body` middleware merges the body keys into the query string, so the results equal the `GET` with the same parameters. The response carries the header `Accept-Query: application/json`. _(source)_ The header was seen on the `401` of this endpoint. _(verified)_

**Endpoint:** `QUERY /invoices/search`

**Auth:** Any logged-in user _(source)_

**Request Body:**
```ts
{
  q?: string;      // search phrase; the spec marks it required
  page?: string;   // page number
}
```

**Response:** `200 OK` _(source)_
Same shape as `GET /invoices/search`.

**Error Responses:**
- `401 Unauthorized`: no token, with `Content-Type: application/json`; `{ message: "Unauthorized" }` _(verified)_
- `500 Internal Server Error`: the request has a non-JSON `Content-Type` (`text/plain`) or no body; the live API answers with an empty `text/html` body, even without a token, and with or without `Accept: application/json`; suspected bug, the source aborts with `415` (next line) _(verified)_
- `415 Unsupported Media Type`: `Content-Type` is not JSON; `HandleQueryMethod` aborts with `QUERY requests must use Content-Type: application/json` before the token is checked. Not seen on 2026-10-10 (see the `500` above and Notes) _(source)_

**Example:**
```http
QUERY /invoices/search
Authorization: Bearer <token>
Content-Type: application/json
Accept: application/json

{ "q": "INV-2026" }
```

---

### 4. Get invoice

Returns one invoice with its lines (each with the product, its image, category and brand) and its payment with the payment details. _(source)_

**Endpoint:** `GET /invoices/{invoiceId}`

**Auth:** Any logged-in user; a non-admin gets only their own invoices (`user_id` = the token's user) _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `invoiceId` | string (ULID) | Yes | The invoice's id (named `{id}` in the route) |

**Response:** `200 OK` _(source)_
```ts
Invoice   // see Data Models
```

The service's tests assert `200` and the invoice's `id` for the owner and for an admin. _(source)_

**Error Responses:**
- `401 Unauthorized`: no token, or a malformed token, with `{ message: "Unauthorized" }`; the token is checked before the id (an id that can't exist also gives `401`) _(verified)_
- `404 Not Found`: no invoice with this id, or, for a non-admin, an invoice of another user (`findOrFail` on the user-scoped query); `{ message: "Requested item not found" }` from the global handler _(source)_

---

### 5. Download invoice PDF

Downloads the PDF generated for an invoice number. The path value is the invoice's number (for example `INV-2022000002`), not its id. A scheduled job generates the files (see Notes). _(source)_

**Endpoint:** `GET /invoices/{invoice_number}/download-pdf`

**Auth:** Any logged-in user; the invoice's owner isn't checked _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `invoice_number` | string | Yes | The invoice's `invoice_number` (named `{id}` in the route) |

**Response:** `200 OK` _(source)_

The body is the PDF file, not JSON, with `Content-Disposition: attachment; filename=<invoice_number>.pdf` (asserted by the service's test). The spec describes it as an `InvoiceResponse` JSON object. _(source)_

**Error Responses:**
- `401 Unauthorized`: no token, or a malformed token, with `{ message: "Unauthorized" }`; checked before the number is looked up _(verified)_
- `404 Not Found`: no file `invoices/<invoice_number>.pdf` exists (an unknown number, or a PDF that isn't generated yet); `{ message: "Document not created. Try again later." }` _(source)_

---

### 6. Get PDF generation status

Returns the status of the PDF job for an invoice number, from the `downloads` table. _(source)_

**Endpoint:** `GET /invoices/{invoice_number}/download-pdf-status`

**Auth:** Any logged-in user; the invoice's owner isn't checked _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `invoice_number` | string | Yes | The invoice's `invoice_number` (named `{id}` in the route) |

**Response:** `200 OK` _(source)_
```ts
{
  status: DownloadStatus;   // INITIATED, IN_PROGRESS or COMPLETED (see Enums)
}
```

The service's test asserts `200` and `status: "COMPLETED"` for a finished download. _(source)_

**Error Responses:**
- `401 Unauthorized`: no token, or a malformed token, with `{ message: "Unauthorized" }` _(verified)_
- `400 Bad Request`: no download exists for this number (it isn't started yet, or the number is unknown), with `{ status: "NOT_INITIATED" }`; the spec lists `404` instead _(source)_

---

### 7. Update invoice status

Sets the `status` and/or `status_message` of an invoice. Any logged-in user can do it for any invoice (see Notes). _(source)_

**Endpoint:** `PUT /invoices/{invoiceId}/status`

**Auth:** Any logged-in user; the invoice's owner isn't checked _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `invoiceId` | string (ULID) | Yes | The invoice's id (named `{id}` in the route) |

**Request Body:**
```ts
{
  status?: InvoiceStatus;        // see Enums; not required by the validation
  status_message?: string | null; // 5 to 50 characters, or null
}
```

Nothing is required: a body without these keys passes the validation. The inline validation runs on `status` and `status_message` only, but the whole request body is passed to the update query, so other keys are written too, or break the query (see Notes). _(source)_

**Response:** `200 OK` _(source)_
```ts
{
  success: boolean;   // true
}
```

The service's test asserts `200` and `{ success: true }` for a valid status and message. _(source)_

**Error Responses:**
- `401 Unauthorized`: no token, or a malformed token, with `{ message: "Unauthorized" }` _(source)_
- `404 Not Found`: no invoice with this id, or the update changed no row; `{ message: "Invoice not found" }` (the handler tests the number of changed rows, see Notes) _(source)_
- `422 Unprocessable Entity`: `status` is not one of the allowed values, or `status_message` is not a string of 5 to 50 characters. The body is Laravel's default `{ message: string; errors: { <field>: string[] } }` (framework default, not the `BaseFormRequest` shape), and with `Accept: application/json` only _(source)_
- `500 Internal Server Error`: the body has a key that is not a column of `invoices`; the raw request body goes into the update query and the database error is not a validation error; suspected bug, should be `422` or the key ignored _(source)_

**Example:**
```http
PUT /invoices/01JINVOICE0123456789ABCDEF/status
Authorization: Bearer <token>
{ "status": "ON_HOLD", "status_message": "Waiting for the bank" }

200 OK
{ "success": true }
```

---

### 8. Create invoice

Creates an invoice for the user of the token from a cart, with one line per cart item, the totals and the payment, and queues the checkout email and the stock update. `user_id` comes from the token and `invoice_date` is set to the current time (a sent `invoice_date` is validated but not used). _(source)_

**Endpoint:** `POST /invoices`

**Auth:** Any logged-in user _(source)_

**Request Body:**
```ts
{
  payment_method: PaymentMethod;     // see Enums
  payment_details: PaymentDetails;   // the key must be present; fields depend on the method (see Data Models)
  billing_street: string;            // max 70
  billing_city: string;              // max 40
  billing_state?: string;            // max 40; the spec marks it required
  billing_country: string;           // max 40, e.g. "NL"; checked against the postal code, city and state
  billing_postal_code?: string;      // max 10; the spec marks it required
  invoice_date?: string;             // Y-m-d; accepted, but the invoice gets the current time
  cart_id: string;                   // required; an existing cart
}
```

The text fields must not contain subscript or superscript characters (U+2070 to U+209F). For `payment_method: "gift-card"`, `payment_details.gift_card_number` must be 16 letters or digits and `payment_details.validation_code` 4 letters or digits. The other methods' details have no validation rules. _(source)_

**Response:** `201 Created` _(source)_
```ts
InvoiceCreated   // see Data Models
```

The service's tests assert `201` for each payment method; the spec says `200`. _(source)_

**Error Responses:**
- `401 Unauthorized`: no token, or a malformed token, with `{ message: "Unauthorized" }` _(source)_
- `404 Not Found`: `cart_id` is not an existing cart, with `{ message: "Requested item not found" }`; the invoice row has been created by then and stays (see Notes). A required column missing from `payment_details` (for example `bank_name`) is mapped by the global handler to `404` with `{ message: "Something went wrong" }`; suspected bug, should be `422` _(source)_
- `422 Unprocessable Entity`: a field fails validation: a required field is missing, `payment_method` is not allowed, a field is too long or has subscript/superscript characters, the gift card number or code has the wrong format, or the address doesn't match the country (`billing_country` carries the message). The body is a map of field to messages without a wrapper (`BaseFormRequest`), e.g. `{ billing_country: ["The billing country does not match the entered address. ..."] }` or `{ "payment_details.gift_card_number": [...] }` _(source)_
- `500 Internal Server Error`: `payment_details` is `null` or an empty string (the gift card rules turn this into `422`), or, for a method other than `cash-on-delivery`, has a key that is not a column of the method's table or a value longer than its column; the invoice row has been created by then; suspected bug, should be `422` _(source)_

**Example:**
```http
POST /invoices
Authorization: Bearer <token>
{
  "payment_method": "cash-on-delivery",
  "payment_details": {},
  "billing_street": "Stephansplatz 1",
  "billing_city": "Wien",
  "billing_country": "AT",
  "cart_id": "01JCART00123456789ABCDEFGH"
}

201 Created
{ "id": "01JINVOICE0123456789ABCDEF", "user_id": "01JUSER00123456789ABCDEFG", "invoice_number": "INV-2026000001", "total": 20.5, ... }
```

---

### 9. Create guest invoice

Same as `POST /invoices`, without a token: the invoice has `user_id: null`, so only an admin can read it afterwards. The guest's email and names are used for the checkout email only; they are not stored on the invoice. _(source)_

**Endpoint:** `POST /invoices/guest`

**Auth:** None _(source)_

**Request Body:**
```ts
{
  payment_method: PaymentMethod;     // see Enums
  payment_details: PaymentDetails;   // the key must be present; see Data Models
  billing_street: string;            // max 70
  billing_city: string;              // max 40
  billing_state?: string;            // max 40
  billing_country: string;           // max 40; checked against the postal code, city and state
  billing_postal_code?: string;      // max 10
  invoice_date?: string;             // Y-m-d; accepted, but the invoice gets the current time
  cart_id: string;                   // required; an existing cart
  guest_email: string;               // valid email, max 255
  guest_first_name: string;          // max 255
  guest_last_name: string;           // max 255
}
```

The validation is inline in the controller: it has the same rules as `POST /invoices` for the shared fields but no subscript/superscript check and no gift card format check. The spec doesn't mark the three `guest_*` fields required; the code does. _(source)_

**Response:** `201 Created` _(source)_
```ts
InvoiceCreated   // see Data Models
```

The spec says `200`. _(source)_

**Error Responses:**
- `404 Not Found`: `cart_id` is not an existing cart, with `{ message: "Requested item not found" }`; the invoice row has been created by then. A required column missing from `payment_details` gives `404` with `{ message: "Something went wrong" }`, as on `POST /invoices` _(source)_
- `422 Unprocessable Entity`: a field fails validation. The body is Laravel's default `{ message: string; errors: { <field>: string[] } }`, not the `BaseFormRequest` map of `POST /invoices`, and with `Accept: application/json` only _(source)_
- `500 Internal Server Error`: `payment_details` is `null` or has an unknown key or a too long value, as on `POST /invoices`; suspected bug _(source)_

---

### 10. Update invoice

Updates an invoice of the caller. The body is validated like a new invoice (so the payment and cart fields are required although they aren't used), then every `fillable` key of the body is written to the invoice. The invoice must belong to the token's user: an admin can't update other users' invoices either. _(source)_

**Endpoint:** `PUT /invoices/{invoiceId}`

**Auth:** Any logged-in user; only the invoice's owner _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `invoiceId` | string (ULID) | Yes | The invoice's id (named `{id}` in the route) |

**Request Body:**
```ts
{
  payment_method: PaymentMethod;     // required by the validation, not stored
  payment_details: PaymentDetails;   // the key must be present, not stored; gift card format rules apply
  billing_street: string;            // max 70
  billing_city: string;              // max 40
  billing_state?: string;            // max 40
  billing_country: string;           // max 40; checked against the postal code, city and state
  billing_postal_code?: string;      // max 10
  invoice_date?: string;             // Y-m-d
  cart_id: string;                   // required by the validation, not stored
}
```

The validation is `StoreInvoice`, the rules of `POST /invoices`. Beyond the validated fields, the model's `fillable` list also lets the body set `user_id`, `invoice_number`, `subtotal`, `total`, `additional_discount_percentage`, `additional_discount_amount`, `eco_discount_percentage` and `eco_discount_amount` without any check (see Notes). _(source)_

**Response:** `200 OK` _(source)_
```ts
{
  success: boolean;   // true
}
```

**Error Responses:**
- `401 Unauthorized`: no token, or a malformed token, with `{ message: "Unauthorized" }` _(source)_
- `404 Not Found`: no invoice with this id owned by the token's user (`firstOrFail`); `{ message: "Requested item not found" }` _(source)_
- `422 Unprocessable Entity`: a field fails validation, as on `POST /invoices`; the validation runs before the lookup, so an unknown id with an invalid body gives `422`. A map of field to messages without a wrapper _(source)_

---

### 11. Partially update invoice

Updates the billing address or the date of an invoice of the caller. Only the validated keys are written. _(source)_

**Endpoint:** `PATCH /invoices/{invoiceId}`

**Auth:** Any logged-in user; only the invoice's owner _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `invoiceId` | string (ULID) | Yes | The invoice's id (named `{id}` in the route) |

**Request Body:**
```ts
{
  billing_street?: string;        // max 70
  billing_city?: string;          // max 40
  billing_state?: string;         // max 40
  billing_country?: string;       // max 40; no address-versus-country check here
  billing_postal_code?: string;   // max 10
  invoice_date?: string;          // Y-m-d
  cart_id?: string;               // validated and then ignored (not fillable)
}
```

Every field is `sometimes`: an empty body is valid and changes nothing. The spec's `InvoiceRequest` marks the payment fields and the cart id required; the code doesn't. _(source)_

**Response:** `200 OK` _(source)_
```ts
{
  success: boolean;   // true
}
```

The service's test patches `billing_street` and asserts `200`, `{ success: true }` and the stored value. _(source)_

**Error Responses:**
- `401 Unauthorized`: no token, or a malformed token, with `{ message: "Unauthorized" }` _(source)_
- `404 Not Found`: no invoice with this id owned by the token's user (`firstOrFail`); `{ message: "Requested item not found" }` _(source)_
- `422 Unprocessable Entity`: a field is not a string, is too long, has subscript/superscript characters, or `invoice_date` is not `Y-m-d`; a map of field to messages without a wrapper. Validated before the lookup _(source)_

## Data Models

### InvoiceSummary

An item of `data[]` in `GET /invoices` and the search endpoints. The query selects only the listed columns, so `created_at`, `status_message` and the eco discount fields are not in it. _(source)_

```ts
interface InvoiceSummary {
  id: string;                          // ULID
  user_id: string | null;              // null for guest invoices
  invoice_number: string;              // INV-<year><6 digits>
  invoice_date: string;
  status: InvoiceStatus;
  subtotal: number | null;
  total: number | null;
  billing_street: string;
  billing_city: string;
  billing_state: string | null;
  billing_country: string;
  billing_postal_code: string | null;
  additional_discount_percentage: number | null;
  additional_discount_amount: number | null;
  invoicelines: InvoiceSummaryLine[];
  payment: { payment_method: PaymentMethod } | null;   // the details are not loaded in lists
}

interface InvoiceSummaryLine {
  id: string;
  invoice_id: string;
  product_id: string;
  unit_price: number;
  quantity: number;
  discount_percentage: number | null;
  discounted_price: number | null;
  product: {
    id: string;
    name: string;
    price: number;
    co2_rating: string;
    in_stock: boolean;                 // see Notes
    is_eco_friendly: boolean;
    product_image: { id: string; by_name: string; by_url: string; source_name: string; source_url: string; file_name: string; title: string };
  };
}
```

### Invoice

Returned by `GET /invoices/{invoiceId}`. `updated_at` and `document` are hidden. _(source)_

```ts
interface Invoice {
  id: string;                          // ULID
  user_id: string | null;              // null for guest invoices
  invoice_number: string;              // INV-<year><6 digits>, e.g. INV-2022000002
  invoice_date: string;
  billing_street: string;
  billing_city: string;
  billing_state: string | null;
  billing_country: string;
  billing_postal_code: string | null;
  additional_discount_percentage: number | null;
  additional_discount_amount: number | null;
  eco_discount_percentage: number | null;   // 5 when more than half of the items have CO2 rating A or B, else 0
  eco_discount_amount: number | null;
  subtotal: number | null;
  total: number | null;
  status: InvoiceStatus;
  status_message: string | null;
  created_at: string;
  invoicelines: InvoiceLine[];
  payment: Payment | null;
}

interface InvoiceLine {
  id: string;
  invoice_id: string;
  product_id: string;
  unit_price: number;
  quantity: number;
  discount_percentage: number | null;
  discounted_price: number | null;      // see Notes: probably returned as a string
  product: {
    id: string;
    name: string;
    description: string;
    price: number;
    co2_rating: string;
    is_rental: boolean;
    in_stock: boolean;                  // see Notes
    is_eco_friendly: boolean;
    product_image: { id: string; by_name: string; by_url: string };
    category: { id: string; name: string };
    brand: { id: string; name: string };
  };
}

interface Payment {
  payment_method: PaymentMethod;
  payment_details: PaymentDetails | null;   // the stored details, with their own `id`
}
```

### InvoiceCreated

Returned by `POST /invoices` and `POST /invoices/guest`: the `Invoice` model as the service built it, without relations. `status` and `status_message` are database defaults the model doesn't reload, so they are probably missing. Not observed (needs writes). _(source)_

```ts
interface InvoiceCreated {
  id: string;
  user_id: string | null;
  invoice_number: string;
  invoice_date: string;
  billing_street: string;
  billing_city: string;
  billing_state?: string;
  billing_country: string;
  billing_postal_code?: string;
  subtotal: number;
  total: number;
  additional_discount_percentage: number;
  additional_discount_amount: number;
  eco_discount_percentage: number;
  eco_discount_amount: number;
  created_at: string;
}
```

### PaymentDetails

The fields of `payment_details` per payment method. Column limits come from the migrations; a longer value gives `500`. `@type` is dropped from the details before they are saved. _(source)_

```ts
type PaymentDetails =
  | { bank_name: string; account_name: string; account_number: string }                          // bank-transfer (70, 70, 40)
  | { credit_card_number: string; expiration_date: string; cvv: string; card_holder_name: string } // credit-card (40, 10, 10, 70)
  | { monthly_installments: string }                                                              // buy-now-pay-later (40)
  | { gift_card_number: string; validation_code: string }                                         // gift-card (16 and 4 alphanumeric characters on POST /invoices and PUT)
  | {};                                                                                           // cash-on-delivery
```

## Enums

- `PaymentMethod`: `bank-transfer`, `cash-on-delivery`, `credit-card`, `buy-now-pay-later`, `gift-card` _(source)_
- `InvoiceStatus`: `AWAITING_FULFILLMENT` (the default of a new invoice), `ON_HOLD`, `AWAITING_SHIPMENT`, `SHIPPED`, `COMPLETED` _(source)_
- `DownloadStatus`: `INITIATED`, `IN_PROGRESS`, `COMPLETED`; `NOT_INITIATED` is what the status endpoint reports (with `400`) when no download row exists _(source)_

## Error Handling

- Errors from the auth middleware and the global handler (`app/Exceptions/Handler.php`) have the body `{ message: string }`: `"Unauthorized"` _(verified)_, `"Requested item not found"` (a `findOrFail` miss), `"Something went wrong"` (a database error), `"Method is not allowed for the requested route"` _(source)_. The controller's own errors are `{ message: "Invoice not found" }`, `{ message: "Document not created. Try again later." }` and `{ status: "NOT_INITIATED" }`. _(source)_
- Validation errors have two shapes. The form requests (`POST /invoices`, `PUT` and `PATCH /invoices/{invoiceId}`) return a map of field to messages without a wrapper, `{ <field>: string[] }`, with `422` (`BaseFormRequest`). The inline validation (`POST /invoices/guest`, `PUT /invoices/{invoiceId}/status`) returns Laravel's default `{ message: string; errors: { <field>: string[] } }` with `422`, and without `Accept: application/json` a redirect instead (framework default). _(source)_
- A database error maps through the handler: `1062` to `409` `{ message: "Duplicate Entry" }`, `1364` (a NOT NULL column without a value) to `404` `{ message: "Something went wrong" }`, anything else to `500` `{ message: "Something went wrong" }`. No `409` is reachable on an invoice endpoint (no unique rule or index). _(source)_
- `405 Method Not Allowed`: any method a path has no route for, e.g. `QUERY /invoices`; `{ message: "Method is not allowed for the requested route" }`. Shared by every route, so it isn't listed per endpoint. _(verified)_
- Every `401` is JSON even without `Accept: application/json` (the middleware builds it itself). _(verified)_

## Notes

- **Status update has no ownership check and writes any column:** `PUT /invoices/{invoiceId}/status` runs `Invoice::where('id', $id)->update($request->all())`. There is no `user_id` condition, so any logged-in user can set the status of any invoice. A query-builder update bypasses `fillable`, so any other key in the body (`total`, `user_id`, ...) is written too, and an unknown key makes the query fail with `500`. Suspected bugs. _(source)_
- **Status update `404` on an unchanged row:** the handler answers `404 "Invoice not found"` when the number of changed rows is 0. The query adds `updated_at`, so re-sending the same values within the same second (updated_at has second resolution) can report `404` for an invoice that exists. Suspected bug; not reproduced (needs writes). _(source)_
- **Status changes by itself:** the scheduled `order:update` job (every 10 minutes) moves `AWAITING_FULFILLMENT` to `AWAITING_SHIPMENT` (or to `ON_HOLD` for `bank-transfer`), `AWAITING_SHIPMENT` to `SHIPPED` and `SHIPPED` to `COMPLETED`, so a test that checks a status right after setting it can race the job. _(source)_
- **PDF files:** nothing generates a PDF when an invoice is created. The scheduled `invoice:generate` command (every minute) creates a `downloads` row (`INITIATED`) for each invoice without a file and queues `CreateInvoicePDF` (`IN_PROGRESS`, then `COMPLETED`); the queue worker also runs every minute. The hourly re-seed deletes all PDFs and download rows. _(source)_
- **PDF endpoints skip ownership:** `download-pdf` and `download-pdf-status` look the file or row up by invoice number only, so any logged-in user can download any invoice's PDF if they know its number (numbers are sequential). Suspected bug. _(source)_
- **`PUT` mass assignment:** the update writes every `fillable` key of the body: `user_id`, `invoice_number`, `subtotal`, `total` and the discount amounts are not validated. A caller can change the total of their invoice or move it to another user. Suspected bug. `PATCH` writes only the validated keys. _(source)_
- **`PUT` needs a whole new invoice body:** `payment_method`, `payment_details` and `cart_id` are required (and the gift card and address rules run) although none of them is stored. `PATCH` is the endpoint for a partial change. _(source)_
- **Orphan invoices:** `POST /invoices` and `POST /invoices/guest` create the invoice row before reading the cart and before saving the payment, with no transaction. An unknown `cart_id`, or a payment that fails (`404` or `500` above), leaves an invoice without lines or payment. Suspected bug. _(source)_
- **Empty cart:** a cart without items is accepted: the invoice has no lines and a total of 0. The cart is not deleted afterwards, so the same cart can be invoiced again. _(source)_
- **Guest invoices:** `user_id` is `null`, `guest_email`, `guest_first_name` and `guest_last_name` aren't stored (not `fillable`), and the checks of `POST /invoices` that aren't in the inline rules (gift card format, subscript/superscript characters) are skipped. _(source)_
- **Totals:** `subtotal` sums `quantity * (discounted_price or unit_price)` per line; `additional_discount_amount` is the cart's `additional_discount_percentage` of it; `eco_discount_percentage` is 5 when more than half of the items have CO2 rating `A` or `B`, applied after the additional discount. `total` = subtotal minus both. _(source)_
- **Products inside invoices:** the invoice queries don't select `stock`, so `in_stock` is probably always `false` (`null` for an admin token) while `is_eco_friendly` is correct. The `Invoiceline` casts name `discount_price` instead of `discounted_price`, so `discounted_price` is probably not cast to a number. Both are suspected and not observed (needs a token). _(source)_
- **`created_at`:** `Invoice` redeclares `$hidden` and `$casts` without the `BaseModel` entries, so `created_at` is returned (not hidden) and its format is Eloquent's default, not `Y-m-d H:i:s` as in the spec's example. Not observed. _(source)_
- **QUERY with a non-JSON content type:** the source aborts with `415`, and `GET`/`QUERY` on `/products/search` documents the same `415` as verified on 2026-10-01 (`Products_API.md`). On 2026-10-10 the live API answered `500` with an empty `text/html` body for `QUERY /invoices/search` (four calls: `text/plain` with a body, with and without `Accept`, and no body, twice) and for `QUERY /products/search` without a body (one call). Possibly a deployment change; not determined. _(verified)_
- **OPTIONS:** `routes/api.php` defines `OPTIONS` for every invoice path (the shared `$respondOptions` handler, `204` with an `Allow` header). Not called live. _(source)_
- **XML:** with `Accept: text/xml`, the JSON responses are rendered as XML (`Controller::preferredFormat`). The PDF download is a file either way. _(source)_
- **Cache headers:** the invoice routes have no cache middleware; the `401` responses carry `Cache-Control: no-cache, private`. _(verified)_
- **Routes that overlap:** `GET /invoices/search` is declared before `GET /invoices/{id}`, so `search` is not read as an id. `GET /invoices/guest` (no such endpoint) is read as invoice id `guest`. _(source)_
- **OpenAPI spec vs source:**
  - Path parameters: the spec names them `{invoiceId}` (show, `PUT`, `PATCH`, status) and `{invoice_number}` (both PDF endpoints); the routes call all of them `{id}`. The two PDF endpoints take the invoice number, not the id, and the spec's example `1` is neither.
  - `POST /invoices` and `POST /invoices/guest`: the spec documents `200`; the handlers return `201` (asserted by the service's tests).
  - `InvoiceRequest`: the spec requires `billing_state` and `billing_postal_code` on every operation; the code requires neither. For `PATCH`, the spec requires all fields, the code none. `payment_details` is an object in the spec; the code only needs the key to be present.
  - `POST /invoices/guest`: the spec doesn't mark `guest_email`, `guest_first_name` and `guest_last_name` required; the code does. The spec's `422` matches, and it has no `401`, which matches the code.
  - `GET /invoices`, `GET /invoices/search` and `QUERY /invoices/search`: the spec's `404` can't happen (an empty result is `200`). The spec marks `q` required on the `GET` and in the `QUERY` body; the code doesn't.
  - `GET /invoices/{invoice_number}/download-pdf` and `.../download-pdf-status`: the spec describes a `200` `InvoiceResponse` for both; the first returns a PDF file and the second `{ status }`. The status endpoint returns `400` for an unknown number; the spec lists `404`, which only the PDF endpoint returns.
  - `PUT /invoices/{invoiceId}/status`: the spec has no `required` on the body, which matches the code. Its `404` and `422` match.
  - `InvoiceResponse` lacks `payment`, `eco_discount_percentage` and `eco_discount_amount`, which the code returns. Its `status_message` example is `""`; the column is nullable.
  - Every operation except the `QUERY` lists `405`, which is the framework-wide response (see Error Handling).
  _(source)_
