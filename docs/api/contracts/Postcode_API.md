# Postcode API Documentation

The address auto-fill of the Toolshop checkout (the spec's tag is `Postcode`): one public endpoint that returns a street, city and state for a country, a postcode and an optional house number. On the deployed API the answer is not a real address lookup: a local Faker driver makes up a plausible address from the country and the postcode, the same every time. The endpoint also rejects a postcode whose shape doesn't fit the country. The checkout and the registration use the same format check (see Notes).

> Written on 2026-10-10 from the Laravel source (`sprint5/API`: `routes/api.php`, `PostcodeController`, `app/Services/Postcode/` (`PostcodeService`, `PostcodeFormat`, `FakerPostcodeDriver`, `HttpPostcodeDriver`, `PostcodeLookupResult`), `config/services.php`, `app/Exceptions/Handler.php`, `app/Http/Kernel.php`, `app/Rules/AddressMatchesCountry.php`, `StoreCustomer`, `tests/Feature/PostcodeLookupTest.php`), the OpenAPI spec (`storage/api-docs/api-docs.json`, tag `Postcode`) and 29 read-only `GET` calls to the live API without a token. No `OPTIONS`, write method or `X-Postcode-Lookup-Url` header was sent. Facts are tagged by origin.

## Base URL

`https://api.practicesoftwaretesting.com` (see `apiBaseUrl` in `src/envs/<ENV>.json`).

## Authentication

- None. The route is outside every auth group and has no middleware of its own: no token is needed. _(verified)_ (every call of the live checks was made without an `Authorization` header)
- There are no roles and no account-state checks on this endpoint. _(source)_

## Endpoints Overview

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/postcode-lookup` | Look up street, city and state for a country, postcode and optional house number | None |

## Data required for successful requests

| Data | Needed by | Requirements |
|---|---|---|
| `country` | `GET /postcode-lookup` | A non-empty string of at most 40 characters. Any string passes: it isn't checked against a list of countries. A two-letter code from the table in Enums (`NL`, `US`, ...) gets a postcode format check and a locale-specific address; anything else (`ZZ`, `Netherlands`) gets no format check and a US-style address. _(verified)_ |
| `postcode` | `GET /postcode-lookup` | A non-empty string of at most 10 characters. For a country with a known format (Enums) it must match that format, e.g. `1011AB` or `1011 AB` for `NL`, `1010` for `AT`, `90210` for `US`. _(verified)_ |
| `house_number` | `GET /postcode-lookup` (optional) | A string of at most 10 characters, not checked for content (`ABCDEFGHIJ` passes). Omit it, or send it empty, to get a generated one. _(verified)_ |

## Endpoints

### 1. Look up an address by postcode

Returns an address for the given country and postcode. The locality (`street`, `city`, `state`) depends only on the country and the postcode (case-insensitive), not on the house number, so the same input always gives the same locality. `house_number` is echoed when sent and generated otherwise. `country` and `postcode` come back in upper case. _(verified)_

**Endpoint:** `GET /postcode-lookup`

**Auth:** None _(verified)_

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `country` | string | Yes | Country code, such as `NL`. At most 40 characters (41 gives `422`). _(verified)_ |
| `postcode` | string | Yes | Postcode. At most 10 characters (11 gives `422`); must fit the country's format when the country has a known one. _(verified)_ |
| `house_number` | string | No | House number. At most 10 characters (11 gives `422`). An empty value counts as omitted. _(verified)_ |

**Headers:**

| Header | Required | Description |
|---|---|---|
| `Accept` | No | Send `application/json` to get a JSON `422` for a missing or invalid parameter. Without it (no header, or `*/*`) that failure is a `302` redirect (see the error responses). The `200` and the format `422` are JSON whatever the header. _(verified)_ |
| `X-Postcode-Lookup-Url` | No | A URL that replaces the lookup backend for this request. Read only when the API doesn't run with `APP_ENV=production`; the deployed API does (`GET /status` reports `"environment": "production"`), so the header is ignored there. Not sent in any live check. See Notes ("Lookup URL override") for the details and the risk. _(source)_ |

**Response:** `200 OK` _(verified)_
```ts
{
  street: string;
  house_number: string;   // the request's house_number, or a generated number from 1 to 250 (as a string)
  city: string;
  state: string;          // "" when the country's locale has no states (FR, GB and JP gave "")
  country: string;        // the request's country, in upper case
  postcode: string;       // the request's postcode, in upper case, otherwise as sent
}
```

All six keys are always present and are strings. Non-ASCII text is returned as `\uXXXX` escapes in the JSON (`JP` gives Japanese street and city names). _(verified)_ The service's own tests assert `200`, the six keys and `country: "NL"` for `NL` / `1011AB` / `5`, the same `city` and `state` for house numbers `5` and `99`, and `422` for `AT` / `1011AB`. _(source)_

**Error Responses:**
- `422 Unprocessable Entity`: a query parameter fails validation: `country` or `postcode` is missing or empty, `country` or `postcode` or `house_number` is not a string (`country[]=NL`), or a value is longer than its limit. With `Accept: application/json` the body is Laravel's default `{ message: string; errors: { <field>: string[] } }`, e.g. `{ "message": "The country field is required. (and 1 more error)", "errors": { "country": ["The country field is required."], "postcode": ["The postcode field is required."] } }`; the validation sees all three parameters at once, and `message` is the first error plus a count _(verified)_
- `422 Unprocessable Entity`: the postcode doesn't fit the country's format (`AT` with `1011AB`, `NL` with `1011`). The body is `{ message: "The postal code format is not valid for the selected country." }`, without `errors`, and it is JSON with or without `Accept` _(verified)_
- `302 Found`: a parameter that fails validation (case 1 above), sent without `Accept: application/json` (no `Accept` header, or `Accept: */*`). The framework treats the request as a browser form and redirects, with `Location: https://api.practicesoftwaretesting.com` and an HTML body, instead of answering `422`; framework default for a request that doesn't expect JSON _(verified)_
- `502 Bad Gateway`: the lookup backend answered with an error status. The body is `{ message: "Postcode lookup failed with status <upstream status>" }`. Only reachable when the API runs with the HTTP driver (`POSTCODE_LOOKUP_DRIVER=http`) or, outside production, with the `X-Postcode-Lookup-Url` header; the deployed API uses the Faker driver and ignores the header, so this can't be triggered there _(source)_

**Example:**
```http
GET /postcode-lookup?country=NL&postcode=1011AB&house_number=5
Accept: application/json

200 OK
{
  "street": "Autarboulevard",
  "house_number": "5",
  "city": "Stroe",
  "state": "Groningen",
  "country": "NL",
  "postcode": "1011AB"
}
```

The same request without `house_number` returns the same `street`, `city` and `state` and `"house_number": "147"`, the number generated for `NL` / `1011AB`. _(verified)_

## Data Models

### PostcodeLookupResult

The response body of `GET /postcode-lookup`: `PostcodeLookupResult::toArray()` with six string properties. _(source)_

```ts
interface PostcodeLookupResult {
  street: string;
  house_number: string;
  city: string;
  state: string;
  country: string;
  postcode: string;
}
```

## Enums

Countries the endpoint knows by their two-letter code. The format check trims the code and ignores its case; the locale lookup ignores case but doesn't trim. A country that isn't listed gets no format check and the `en_US` locale. _(source)_

- **Format check** (`PostcodeFormat::PATTERNS`, 27 countries): a postcode that doesn't match is rejected with `422`. The postcode is trimmed before the match, the letters of a pattern accept both cases, and `\s?` is one optional whitespace character.
- **Locale** (`FakerPostcodeDriver::COUNTRY_TO_LOCALE`, 26 countries): picks the Faker locale for `street`, `city` and `state`. `AL` has a format but no locale, so an `AL` address is made in `en_US` (a US-style city and state, seen for `AL` / `1001`). _(verified)_

| Country | Postcode format | Faker locale |
|---|---|---|
| `AL` | 4 digits | none (`en_US`) |
| `AT` | 4 digits | `de_AT` |
| `AU` | 4 digits | `en_AU` |
| `BE` | 4 digits | `nl_BE` |
| `BR` | `\d{5}-?\d{3}` (5 digits, optional dash, 3 digits) | `pt_BR` |
| `CA` | letter, digit, letter, optional whitespace, digit, letter, digit | `en_CA` |
| `CH` | 4 digits | `de_CH` |
| `CN` | 6 digits | `zh_CN` |
| `CZ` | 3 digits, optional whitespace, 2 digits | `cs_CZ` |
| `DE` | 5 digits | `de_DE` |
| `DK` | 4 digits | `da_DK` |
| `ES` | 5 digits | `es_ES` |
| `FI` | 5 digits | `fi_FI` |
| `FR` | 5 digits | `fr_FR` |
| `GB` | `[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}` (e.g. `SW1A 1AA`) | `en_GB` |
| `IE` | `[A-Za-z]\d{2}\s?[A-Za-z\d]{4}` | `en_IE` |
| `IT` | 5 digits | `it_IT` |
| `JP` | `\d{3}-?\d{4}` (e.g. `100-0001`) | `ja_JP` |
| `NL` | `\d{4}\s?[A-Za-z]{2}` (e.g. `1011AB`, `1011 AB`) | `nl_NL` |
| `NO` | 4 digits | `nb_NO` |
| `NZ` | 4 digits | `en_NZ` |
| `PL` | `\d{2}-\d{3}` | `pl_PL` |
| `PT` | `\d{4}` with an optional `-\d{3}` | `pt_PT` |
| `RU` | 6 digits | `ru_RU` |
| `SE` | 3 digits, optional whitespace, 2 digits | `sv_SE` |
| `TR` | 5 digits | `tr_TR` |
| `US` | `\d{5}` with an optional `-\d{4}` (e.g. `90210-1234`) | `en_US` |

Observed live: `NL` (`1011AB`, `1011 AB`, `1011` rejected), `AT` (`1011AB` rejected), `FR` (`75001`), `JP` (`100-0001`), `GB` (`SW1A 1AA`), `US` (`90210-1234`) and `AL` (`1001`). The other rows are from the source only. _(verified)_

## Error Handling

- Parameter validation uses `$request->validate(...)` in the controller, not a form request, so the `422` body is Laravel's default `{ message, errors }`, not the flat `{ <field>: string[] }` map of the `BaseFormRequest` areas. _(source)_ Seen with `Accept: application/json`. _(verified)_
- Without `Accept: application/json` (no header, or `*/*`), that validation failure is a `302` redirect with an HTML body. The API's own handler (`app/Exceptions/Handler.php`) doesn't change it; the same redirect is documented for `POST /payment/check` (see `Payment_API.md`). Laravel builds the `Location` from the request's `Referer` header when there is one and from the site root otherwise (the root was seen, with no `Referer`). _(verified)_
- The format `422` is built by hand in the controller (`response()->json(..., 422)`), so it is `{ message }` only and doesn't depend on `Accept`. _(verified)_
- The order of the checks: parameter validation first, then the format check, then the lookup. The format check runs only when validation passes, so a request with a missing `postcode` and `country=AT` gets the validation `422`, and a request with all parameters present and a wrong shape gets the format `422`. _(source)_
- `405 Method Not Allowed`: any method other than `GET` (and `OPTIONS`) on `/postcode-lookup`, e.g. `POST`; `{ message: "Method is not allowed for the requested route" }`. Shared by every route, so it isn't listed under the endpoint; not tried here (only `GET` was allowed). _(source)_
- Responses carry `Cache-Control: no-cache, private` and `Content-Type: application/json` (the `302` has `text/html; charset=utf-8`). _(verified)_
- No authentication errors (`401`, `403`) can occur: the route has no auth middleware. _(source)_

## Notes

- **The deployed API uses the Faker driver.** The driver comes from `services.postcode.driver` (`POSTCODE_LOOKUP_DRIVER`, default `faker`; `http` fetches `<POSTCODE_LOOKUP_URL>/lookup` with a 5-second timeout). Evidence that the live API runs the Faker driver: the same input gives the same body on every call; a request without `house_number` gets a made-up number (`147`), which the HTTP driver wouldn't do; and the data is locale-shaped (Dutch street and city names with Dutch provinces for `NL`, US names for `ZZ`). The `http` driver and the `502` can't be observed on the deployed API. _(verified)_
- **Deterministic by input.** The Faker generator is seeded with `crc32(lower-case("<country>|<postcode>"))`, so the locality is the same for `NL`/`nl` and `1011AB`/`1011ab` (seen), and the generated house number (when `house_number` is omitted) is the same too (seen: `147` on two calls, one with an empty `house_number`). Results could change only if the Faker data or version changes, so tests should compare two calls of the same input with each other, or with a value recorded in the test, and be ready to refresh it. _(verified)_
- **Spacing changes the address.** The seed uses the postcode exactly as sent, so `1011AB` and `1011 AB` are both valid for `NL` but give different cities (`Stroe` and `Wezuperbrug`, seen). _(verified)_
- **Leading whitespace is accepted and echoed.** The format check trims the postcode, but the lookup and the response don't: `%201011AB` gave `200` with `"postcode": " 1011AB"` and yet another city. The same applies to a country with leading or trailing whitespace (`" NL"` passes the `NL` format check but gets an `en_US` address and `" NL"` back; read from the source, not tried). Suspected bug (inconsistent trimming); low impact. _(verified)_
- **No country list.** `country` is any string up to 40 characters: `ZZ` and a 40-character string gave `200` with US-style data, and `Netherlands` (a name, not a code) gave `200` with `"country": "NETHERLANDS"`, no format check and an `en_US` address (a US state such as `Utah`). The response's `country` is the input in upper case, not a normalized code. _(verified)_ Possibly intended ("exotic countries are never spuriously rejected" is the comment in `PostcodeFormat`), but a caller can't tell a made-up country from a real one.
- **Locale quirks.** `AL` has a postcode format but no Faker locale, so it gets `en_US` data (verified). `state` is `""` for locales without a state list (`FR`, `GB`, `JP` seen; `NL` and `US` return one). _(verified)_
- **House number.** It never changes the locality. It is echoed verbatim when it is non-empty (no format check, and not trimmed), otherwise it is a number from 1 to 250 generated from the same seed. An empty `house_number=` is the same as omitting it (`ConvertEmptyStringsToNull`). _(verified)_
- **Limits are on the raw strings.** `country` 40, `postcode` 10 and `house_number` 10 characters: the limits are inclusive (40 and 10 characters passed) and one more gives `422`. _(verified)_
- **Lookup URL override (`X-Postcode-Lookup-Url`).** Outside production the controller reads this header and, when its value passes PHP's `FILTER_VALIDATE_URL`, replaces the driver with the HTTP driver, which calls `<header value>/lookup` with `country`, `postcode` and `house_number` as query parameters and returns the `street`, `city` and `state` of the JSON it receives. The controller restricts neither scheme nor host, so on a non-production deployment (the default `.env.example` has `APP_ENV=local`) any caller can make the server fetch an arbitrary URL and read parts of the answer: a server-side request forgery risk. The code guards it only with `!App::environment('production')`, and its own comment says so. Not exploitable on the deployed API (`environment: production` per `GET /status`), and deliberately not sent in any live check. A failing override target is the only way to get `502` there. _(source)_
- **Upstream failures that aren't `502`.** Only a `RuntimeException` is mapped to `502`, raised when the upstream answers with an error status. A connection failure or timeout of the HTTP client isn't caught by that branch as far as the code shows (the exception class comes from the framework, not read here), and an unknown driver name or a missing `POSTCODE_LOOKUP_URL` throws `InvalidArgumentException` (a `500` from configuration). None of these can be triggered on the deployed API. _(source)_
- **Same format check elsewhere.** `PostcodeFormat::matches` is also used by registration (`POST /users/register`: `address.postal_code` must fit `address.country`, with the message "The postal code format is not valid for the selected country.") and by the invoice rules (`AddressMatchesCountry` on `billing_country` of `POST /invoices` and `POST /invoices/guest`, see `Invoices_API.md`). The invoice rule goes further: it runs this lookup (without a house number) and requires the billing city and state to equal the lookup's, ignoring case, and it accepts the request when the lookup backend fails. So this endpoint is the source of the city and state a checkout accepts. _(source)_
- **OPTIONS:** `routes/api.php` defines `OPTIONS /postcode-lookup` with the shared `$respondOptions` handler, which gives `204` with an `Allow` header built from the routes that match the path (so `Allow: GET`) and no body. Not in the spec and not tried here (only `GET` was allowed). _(source)_
- **XML:** `Accept: text/xml` has no effect: the controller returns `response()->json(...)` and doesn't use `Controller::preferredFormat`, so the body stays JSON with `Content-Type: application/json`. _(verified)_
- **Rate limiting:** no throttle middleware is applied to the route (the `api` group is empty). _(source)_
- **Caching:** the route has no cache middleware; each call is computed (cheaply) and carries `Cache-Control: no-cache, private`. _(verified)_
- **OpenAPI spec vs source and live API:**
  - The spec lists `422` with the shared `UnprocessableEntityResponse`, which has no body; the live API has two bodies (`{ message, errors }` and `{ message }`) and, without `Accept: application/json`, a `302` (see Error Responses), which the spec doesn't mention. _(verified)_
  - The spec's `502` ("Upstream lookup failure") matches the code but can't be reached on the deployed API. _(source)_
  - The spec's `200` schema has no `required` list; the code always returns all six strings. _(verified)_
  - The spec doesn't document the `X-Postcode-Lookup-Url` header or the `OPTIONS` route. _(source)_
  - The parameters, their types, requirements and `maxLength` values (40, 10, 10) match the code. _(source)_
