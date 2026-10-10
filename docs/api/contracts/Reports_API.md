# Reports API Documentation

The sales and customer reports of the Toolshop API: yearly, monthly and weekly sales figures, sales per country, the ten most purchased products and best selling categories, and the number of customers per country. Every report is a `GET` that needs an admin token and shares one rate limit of 60 requests per minute.

> Written on 2026-10-10 from the Laravel source (`sprint5/API`: `routes/api.php`, `ReportController`, `ReportService`, `RoleMiddleware`, `RouteServiceProvider`, `CachedAuthUserProvider`, `config/auth.php`, `app/Exceptions/Handler.php`, `Controller::preferredFormat`, the `InvoiceSeeder`, the console `Kernel` and `OrderUpdate` command, `tests/Feature/ReportTest.php`), the OpenAPI spec (`storage/api-docs/api-docs.json`, tag `Report`) and anonymous read-only calls to the live API (11 calls, no token). No token was available, so no `200` and no `403` was observed. Facts are tagged by origin.

## Base URL

`https://api.practicesoftwaretesting.com` (see `apiBaseUrl` in `src/envs/<ENV>.json`).

## Authentication

- Scheme: `Authorization: Bearer <JWT>`. Get a token with `POST /users/login` (see `Users_API.md`). _(source)_
- Every report endpoint needs a token whose user has the `admin` role: `ReportController` applies the `role:admin` middleware to all its actions. A customer token is rejected. _(source)_
- Without a token, every report endpoint returns `401` with `{ message: "Unauthorized" }`. _(verified)_ A malformed or expired token gives the same `401` (the JWT guard returns no user), which was verified on `DELETE /products/{productId}`, where the same `RoleMiddleware` is used (`Products_API.md`). _(source)_
- A token whose user isn't an admin gets `403` with `{ message: "Forbidden" }`. The role is read from the user record (cached by `CachedAuthUserProvider` for 10 minutes), not from the JWT's `role` claim, so a role change can take up to 10 minutes to apply. _(source)_
- The controller has no `auth:users` middleware, only `role:admin`. The checks of the `Authenticate` middleware (`Account disabled.` for a disabled account, `Unauthorized token usage` for a restricted two-factor token, see `Users_API.md`) are therefore not applied to the reports; the source shows no equivalent check. Suspected gap, not observed (needs a token). _(source)_
- **Rate limit:** the whole `/reports` group sits behind `throttle:reports`: 60 requests per minute per user id (the token's user), or per IP address when no valid token is sent. Every request counts, including `401` and `403` responses and `OPTIONS`, and all seven endpoints share one counter. See Error Handling for the `429`. _(source)_ The limit and the shared, decreasing counter were seen on anonymous calls to seven different report paths (`X-RateLimit-Limit: 60`, `X-RateLimit-Remaining` going 59, 58, ...). _(verified)_

## Endpoints Overview

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/reports/total-sales-of-years` | Total sales per year, for the current year and the given number of years before it | Admin |
| GET | `/reports/total-sales-per-country` | Total sales per billing country | Admin |
| GET | `/reports/top10-purchased-products` | The ten products that appear on the most invoice lines | Admin |
| GET | `/reports/top10-best-selling-categories` | The ten categories with the highest summed unit prices on invoice lines | Admin |
| GET | `/reports/customers-by-country` | Number of customers per country | Admin |
| GET | `/reports/average-sales-per-month` | Average invoice total and invoice count per month of a year | Admin |
| GET | `/reports/average-sales-per-week` | Average invoice total and invoice count per week of a year | Admin |

## Data required for successful requests

| Data | Needed by | Requirements |
|---|---|---|
| Admin token | every endpoint | A token from `POST /users/login` for a user whose `role` is `admin` (the configured admin of the test environment). A customer token gets `403`; no token gets `401`. |
| Request budget | every endpoint | At most 60 requests per minute per user (per IP without a token), shared by all seven endpoints. A test run that repeats report calls for the same admin counts against the same limit. |
| `COMPLETED` invoices | `total-sales-of-years`, `total-sales-per-country`, `average-sales-per-month`, `average-sales-per-week` (non-zero figures) | Only invoices with `status = COMPLETED` are counted. Right after the hourly re-seed every seeded invoice is `AWAITING_FULFILLMENT`; the `order:update` job (every 10 minutes) moves them one step per run (`AWAITING_SHIPMENT` or `ON_HOLD`, then `SHIPPED`, then `COMPLETED`), so figures stay zero for the first 30 minutes or so after a re-seed, and `bank-transfer` invoices stop at `ON_HOLD` and never complete. Tests must not assume non-zero values. _(source)_ |
| Invoice lines, products, categories | `top10-purchased-products`, `top10-best-selling-categories` | Counted over all invoices whatever their status, so seeded data fills these right after a re-seed. An empty database gives `[]`. _(source)_ |
| Customers | `customers-by-country` | Users with `role = user`; the seeded customers give at least one row. _(source)_ |
| A year with invoices | `average-sales-per-month`, `average-sales-per-week` (`year`) | Seeded invoices are dated at random days over the 5 years before the seeding, so the current year and the 5 years before it can have data. Any other year gives only zero rows. _(source)_ |

## Endpoints

### 1. Total sales of years

Returns the summed `total` of the `COMPLETED` invoices per year, from `current year - years` up to and including the current year, oldest first. Years without invoices are in the list with `total: 0`, so the list has `years + 1` items. _(source)_

**Endpoint:** `GET /reports/total-sales-of-years`

**Auth:** Bearer token, `admin` role _(source)_

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `years` | integer | No | How many years before the current one to include. Default `1` (the current and the previous year). `0` gives only the current year; a negative value gives `[]`. The code doesn't validate it. _(source)_ |

**Response:** `200 OK` _(source)_
```ts
TotalSalesOfYearsRow[]   // see Data Models; years + 1 items, ascending by year
```

The service's test asserts `200` and that every item has `year` and `total`. _(source)_

**Error Responses:**
- `401 Unauthorized`: no token, with `{ message: "Unauthorized" }`; seen with and without the `years` parameter, so the token is checked before the parameters _(verified)_; a malformed or expired token gives the same _(source)_
- `403 Forbidden`: the token's user isn't an admin; `{ message: "Forbidden" }` _(source)_
- `500 Internal Server Error`: `years` is not numeric (`?years=abc`, or an array `?years[]=1`); the controller computes `now()->year - $years` without validation and PHP 8 throws a `TypeError` for a non-numeric string; suspected bug, should be `422` or the value ignored. Not observed (needs an admin token) _(source)_

**Example:** illustrative values, in the year 2026
```http
GET /reports/total-sales-of-years?years=2
Authorization: Bearer <admin token>
Accept: application/json

200 OK
[
  { "year": 2024, "total": 0 },
  { "year": 2025, "total": 1234.5 },
  { "year": 2026, "total": 99 }
]
```

---

### 2. Total sales per country

Returns the summed invoice `total` of the `COMPLETED` invoices, grouped by `billing_country`. Only countries that have such invoices appear, so the list can be empty. _(source)_

**Endpoint:** `GET /reports/total-sales-per-country`

**Auth:** Bearer token, `admin` role _(source)_

**Query Parameters:** None

**Response:** `200 OK` _(source)_
```ts
TotalSalesPerCountryRow[]   // see Data Models; no fixed length, no explicit order
```

The service's test creates invoices for `The Netherlands` (100 and 150) and `USA` (200) and asserts the rows `{ billing_country: "The Netherlands", total_sales: 250 }` and `{ billing_country: "USA", total_sales: 200 }`. _(source)_

**Error Responses:**
- `401 Unauthorized`: no token, with `{ message: "Unauthorized" }` _(verified)_; a malformed or expired token gives the same _(source)_
- `403 Forbidden`: the token's user isn't an admin; `{ message: "Forbidden" }` _(source)_

---

### 3. Top 10 purchased products

Returns up to ten products by the number of invoice lines that reference a product with that name, highest first. It counts lines, not quantities, over invoices of every status, and groups by product name. _(source)_

**Endpoint:** `GET /reports/top10-purchased-products`

**Auth:** Bearer token, `admin` role _(source)_

**Query Parameters:** None

**Response:** `200 OK` _(source)_
```ts
TopPurchasedProductRow[]   // see Data Models; at most 10 items, descending by count
```

**Error Responses:**
- `401 Unauthorized`: no token, with `{ message: "Unauthorized" }` _(verified)_; a malformed or expired token gives the same _(source)_
- `403 Forbidden`: the token's user isn't an admin; `{ message: "Forbidden" }` _(source)_

---

### 4. Top 10 best selling categories

Returns up to ten categories with the highest sum of `unit_price` over the invoice lines of their products, highest first. The sum ignores quantity and discounts and covers invoices of every status. _(source)_

**Endpoint:** `GET /reports/top10-best-selling-categories`

**Auth:** Bearer token, `admin` role _(source)_

**Query Parameters:** None

**Response:** `200 OK` _(source)_
```ts
TopSellingCategoryRow[]   // see Data Models; at most 10 items, descending by total_earned
```

**Error Responses:**
- `401 Unauthorized`: no token, with `{ message: "Unauthorized" }` _(verified)_; a malformed or expired token gives the same _(source)_
- `403 Forbidden`: the token's user isn't an admin; `{ message: "Forbidden" }` _(source)_

---

### 5. Customers by country

Returns the number of users with the `user` role per `country`. Admins are not counted; disabled customers are. _(source)_

**Endpoint:** `GET /reports/customers-by-country`

**Auth:** Bearer token, `admin` role _(source)_

**Query Parameters:** None

**Response:** `200 OK` _(source)_
```ts
CustomersByCountryRow[]   // see Data Models; no fixed length, no explicit order
```

**Error Responses:**
- `401 Unauthorized`: no token, with `{ message: "Unauthorized" }` _(verified)_; a malformed or expired token gives the same _(source)_
- `403 Forbidden`: the token's user isn't an admin; `{ message: "Forbidden" }` _(source)_

---

### 6. Average sales per month

Returns, for each month of one year, the average `total` and the number of `COMPLETED` invoices. The list always has 12 items for the months 1 to 12; months without invoices have `average: 0` and `amount: 0`. _(source)_

**Endpoint:** `GET /reports/average-sales-per-month`

**Auth:** Bearer token, `admin` role _(source)_

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `year` | integer | No | The year to report on. Default: the current year. The spec says the default is `2022`. The code doesn't validate it. _(source)_ |

**Response:** `200 OK` _(source)_
```ts
AverageSalesPerMonthRow[]   // see Data Models; always 12 items, month 1 to 12
```

**Error Responses:**
- `401 Unauthorized`: no token, with `{ message: "Unauthorized" }` _(verified)_; a malformed or expired token gives the same _(source)_
- `403 Forbidden`: the token's user isn't an admin; `{ message: "Forbidden" }` _(source)_

---

### 7. Average sales per week

Returns, for each week of one year, the average `total` and the number of `COMPLETED` invoices. The list always has 52 items for the weeks 1 to 52; weeks without invoices have `average: 0` and `amount: 0`. _(source)_

**Endpoint:** `GET /reports/average-sales-per-week`

**Auth:** Bearer token, `admin` role _(source)_

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `year` | integer | No | The year to report on. Default: the current year. The spec says the default is `2022`. The code doesn't validate it. _(source)_ |

**Response:** `200 OK` _(source)_
```ts
AverageSalesPerWeekRow[]   // see Data Models; always 52 items, week 1 to 52
```

**Error Responses:**
- `401 Unauthorized`: no token, with `{ message: "Unauthorized" }` _(verified)_; a malformed or expired token gives the same _(source)_
- `403 Forbidden`: the token's user isn't an admin; `{ message: "Forbidden" }` _(source)_

## Data Models

The rows of the seven reports. `ReportController` builds the three yearly, monthly and weekly lists itself (numbers cast with `floatval`, gaps filled with zeros); the other four are the query results as the database returns them. _(source)_

```ts
interface TotalSalesOfYearsRow {
  year: number;
  total: number;          // sum of the totals of COMPLETED invoices; 0 for a year without any
}

interface TotalSalesPerCountryRow {
  billing_country: string;
  total_sales: string;    // SUM(total); not cast by the code, so the JSON type is what the database driver returns (the spec says string); not observed
}

interface TopPurchasedProductRow {
  name: string;           // product name
  count: number;          // number of invoice lines, not units
}

interface TopSellingCategoryRow {
  category_name: string;
  total_earned: string;   // SUM(unit_price) of the invoice lines; not cast by the code (the spec says string); not observed
}

interface CustomersByCountryRow {
  amount: number;         // number of customers
  country: string;
}

interface AverageSalesPerMonthRow {
  month: number;          // 1 to 12
  average: number;        // AVG(total) of the month's COMPLETED invoices, in currency units
  amount: number;         // COUNT(*) of those invoices
}

interface AverageSalesPerWeekRow {
  week: number;           // 1 to 52
  average: number;        // AVG(total) of the week's COMPLETED invoices
  amount: number;         // COUNT(*) of those invoices
}
```

## Enums

None.

## Error Handling

- Errors have the body `{ message: string }`. The role middleware builds `{ message: "Unauthorized" }` _(verified)_ and `{ message: "Forbidden" }` _(source)_ itself, so they are JSON whatever the `Accept` header. _(source)_
- `429 Too Many Requests`: more than 60 requests within a minute for the same user id (or IP address without a valid token), counted over all seven report endpoints together; `{ message: "Too many requests" }` from the global handler. The throttle runs before the role check, so an anonymous or non-admin caller can use up the limit and then gets `429` instead of `401` or `403`. The responses that pass the throttle carry `X-RateLimit-Limit: 60` and `X-RateLimit-Remaining` _(verified on `401`)_; the handler builds the `429` itself, so a `Retry-After` header is probably missing. Not observed on purpose (it needs more than 60 calls). _(source)_ Listed once here, not under every endpoint, because the seven endpoints share one counter and one test on any of them covers it.
- `405 Method Not Allowed`: any method other than `GET` and `OPTIONS` on a report path, e.g. `POST /reports/total-sales-of-years`; `{ message: "Method is not allowed for the requested route" }`, without an `Allow` header and without the rate-limit headers (no route matched, so the throttle doesn't run). Shared by every route, so it isn't listed per endpoint. _(verified)_
- There is no validation (`422`) on any report: the query parameters are read with `$request->get()` and used as they are. `404` can't happen either (the reports are aggregate queries without a lookup); the spec lists it on all seven. _(source)_
- Query-builder errors map through the global handler (`1062` to `409`, `1364` to `404`, any other to `500` with `{ message: "Something went wrong" }`). Nothing in the reports triggers one on purpose. _(source)_

## Notes

- **Cache:** every report is cached for 300 seconds (`Cache::remember` in `ReportService`, key per report and parameters, not per user). A new invoice, customer or status change shows up in the reports only after the entry expires, and all admins see the same data. A different `years` or `year` value has its own entry, so the first call with it is computed fresh. The hourly re-seed runs `cache:clear`. A test that changes data and then expects a changed report must allow for up to 5 minutes. _(source)_
- **Hourly re-seed:** the data is dropped and seeded again every hour (production environment), so values are only stable inside one hour; use shapes and invariants (list lengths, key names, ordering, zero fill) in assertions, not figures. _(source)_
- **Sales figures need completed orders:** the sales reports count only `COMPLETED` invoices, while the top 10 reports and the customer report ignore the status. After a re-seed the sales reports are all zero for roughly 30 minutes (see "Data required"), and `total-sales-per-country` is `[]`. Orders placed through the API (`POST /invoices`) advance the same way and need the same time. _(source)_
- **`average` and `amount` are not what the spec says:** the spec describes `average` as "Average number of sales" and `amount` as "Average sales amount". The code returns `average` = average invoice total and `amount` = number of invoices. The code wins in this contract. _(source)_
- **Weeks 0 and 53 are dropped:** the weekly query groups by MySQL `WEEK(invoice_date)` (mode 0: Sunday-first, values 0 to 53), but the response is built for the weeks 1 to 52 only, so invoices of the days before the year's first Sunday (week 0) and of week 53 are in no row. Suspected bug. Not observed. _(source)_
- **Top 10 figures are loose:** `top10-purchased-products` counts invoice lines, not quantities; `top10-best-selling-categories` sums `unit_price` without quantity, discounts or the invoice status, so the "best selling" ranking isn't revenue. Ties have no defined order. Suspected bugs. _(source)_
- **`years` semantics:** the spec calls it "Number of years" with default `1`; the response has `years + 1` items (the current year and `years` years before it). There is no upper bound, so a very large `years` builds a very long list. _(source)_
- **Query parameters from the body:** the code reads `years` and `year` with `$request->get()`, which also looks at a request body; a `GET` with a body is not meaningful here. Not tested. _(source)_
- **OPTIONS:** every report path answers `OPTIONS` with `204`, an empty body and `Allow: GET`, without a token (the route isn't behind the role middleware, only the throttle). Not in the spec. _(verified)_
- **XML:** with `Accept: text/xml`, a `200` is rendered as XML by `Controller::preferredFormat` instead of JSON. Not observed for reports (needs a token); the `401` and `403` stay JSON. _(source)_
- **Cache headers:** the `401` carries `Cache-Control: no-cache, private`. _(verified)_ The report routes have no cache middleware, so a `200` has no `max-age` or `ETag` of its own. _(source)_
- **Verified so far:** only the anonymous behaviour (`401` on all seven, `405`, `OPTIONS`, the rate-limit headers). Every `200` and `403` line, and the response shapes, come from the source and the spec and need an admin token to check.
- **OpenAPI spec vs source:**
  - `404` is listed on all seven operations; none can return it (see Error Handling).
  - `403` is missing on all seven: the role middleware returns it for a non-admin token. The spec only says "`Admin` role is required" in the description. `429` (the throttle) is missing too.
  - `average-sales-per-month` and `average-sales-per-week`: the spec says `year` defaults to `2022`; the code defaults to the current year. The descriptions of `average` and `amount` are swapped in effect (see above), and the weekly description "(1-52)" hides that weeks 0 and 53 are dropped.
  - `total-sales-per-country` and `top10-best-selling-categories`: the spec types `total_sales` and `total_earned` as strings with example `"1234"`; the code doesn't cast them, so the type depends on the database driver. The service's test compares `total_sales` with a number. Not observed.
  - `total-sales-of-years`: `years` is an integer with default `1` in both; the spec doesn't say that `years + 1` items come back, or that a non-numeric value fails.
  - The `401` response (`{ message: "Unauthorized" }`) matches the spec. _(verified)_
  _(source)_
