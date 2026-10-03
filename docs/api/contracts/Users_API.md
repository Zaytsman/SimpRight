# Users API Documentation

Customer accounts and authentication in the Toolshop API: login and tokens, registration, passwords, the current user's profile, and user administration.

> Built from the OpenAPI spec (Toolshop API 5.0.0), the Laravel source (`sprint5/API`) and read-only calls to the live API on 2026-10-01; facts are tagged by origin.

## Base URL

`https://api.practicesoftwaretesting.com` (see `apiBaseUrl` in `src/envs/<ENV>.json`).

## Authentication

- Scheme: `Authorization: Bearer <JWT>`. `POST /users/login` returns the token; it expires after 300 seconds (`JWT_TTL` defaults to 5 minutes) and can be renewed with `GET /users/refresh`. _(source)_
- The JWT carries a `role` claim: `admin` or `user`. _(source)_
- Public: `POST /users/login`, `POST /users/register`, `POST /users/forgot-password`, and `GET /users/refresh` (which reads the token itself). Every other endpoint needs a valid token (`auth:users` middleware in `UserController`); `GET /users` and `DELETE /users/{userId}` also need the `admin` role. _(source)_
- Without a token, or with a malformed, expired or logged-out token, protected endpoints return `401` with `{ message: "Unauthorized" }`. _(verified)_
- **Account state, shared by every endpoint with a token:** a disabled account (`enabled: false`) gets `403` with `{ message: "Account disabled." }` _(verified)_. The middleware caches the user for 60 seconds, so a change can take up to a minute to apply. _(source)_
- **Login lockout:** after 3 failed logins a non-admin account is locked, and `POST /users/login` returns `423` for it even with the right password, until `failed_login_attempts` is reset (a successful login doesn't get that far). Admin accounts are never locked. _(source)_

## Endpoints Overview

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/users/login` | Log in, get a token | None |
| POST | `/users/register` | Register a customer | None |
| POST | `/users/forgot-password` | Reset a password to `welcome02` | None |
| POST | `/users/change-password` | Change the current user's password | Any user |
| GET | `/users/me` | Current user's profile | Any user |
| GET | `/users/logout` | Invalidate the token | Any user |
| GET | `/users/refresh` | Get a new token | Token in header |
| GET | `/users` | List customers | Admin |
| GET | `/users/search` | Search customers | Any user |
| QUERY | `/users/search` | Search customers, criteria in a JSON body | Any user |
| GET | `/users/{userId}` | Get a user | Any user (own id) or admin |
| PUT | `/users/{userId}` | Update a user | Any user (own id) or admin |
| PATCH | `/users/{userId}` | Partially update a user | Any user (own id) or admin |
| DELETE | `/users/{userId}` | Delete a user | Admin |

## Data required for successful requests

| Data | Needed by | Requirements |
|---|---|---|
| Customer credentials | `POST /users/login` | An existing, enabled account that isn't locked (fewer than 3 failed logins in a row). Test users come from `testUsers` in `src/envs/<ENV>.json` and `.env`. |
| User token | Every endpoint marked "Any user" | From `POST /users/login`; valid for 300 seconds. |
| Admin token | `GET /users`, `DELETE /users/{userId}`; any user's id on `GET`/`PUT`/`PATCH /users/{userId}` | Token of a user whose `role` is `admin`. |
| User id (ULID) | `/users/{userId}` endpoints | Your own id from `GET /users/me`, or any id with an admin token. |
| Unique email | `POST /users/register`; `email` in `PUT`/`PATCH /users/{userId}` | Not used by any other account. |
| Strong password | `POST /users/register`, `POST /users/change-password` | At least 8 characters, upper and lower case, a number and a symbol, and not found in public data breaches (Laravel `Password::uncompromised()`). |
| Adult date of birth | `dob` in register, `PUT`, `PATCH` | Format `YYYY-MM-DD`, at least 18 years ago. |
| A user nobody references | `DELETE /users/{userId}` | A user with invoices, favorites or other references can't be deleted (`409`). |

## Endpoints

### 1. Login

Returns a JWT for the `Authorization: Bearer <token>` header. Accounts with two-factor auth (TOTP) get a restricted temporary token instead, which is exchanged for a full token by sending it back with the TOTP code. _(source)_

**Endpoint:** `POST /users/login`

**Auth:** None _(source)_

**Request Body:**
```ts
{
  email?: string;         // with password: the normal login
  password?: string;
  access_token?: string;  // with totp: the second step of a TOTP login
  totp?: string;
}
```
Send either `email` and `password`, or `access_token` and `totp`. Neither pair is validated as required; a body with neither gets `401`. _(source)_

**Response:** `200 OK` _(verified)_
```ts
{
  access_token: string;
  token_type: string;   // "bearer"
  expires_in: number;   // 300
}
```
For an account with TOTP enabled, the first step returns `200` with `{ message: "TOTP required"; requires_totp: true; access_token: string }` instead. _(source)_

**Error Responses:**
- `401 Unauthorized`: wrong email or password (or an email no account has), `{ error: "Unauthorized" }` _(verified)_; neither credential pair in the body, `{ error: "Invalid login request" }` _(verified)_; a non-restricted (full) token in the TOTP step, `{ error: "Unauthorized token usage" }` _(verified)_; a wrong TOTP code _(source)_
- `400 Bad Request`: TOTP step with an invalid `access_token`, `{ error: "Invalid or expired token" }` _(verified)_; the same for an expired one _(source)_
- `403 Forbidden`: right credentials, but the account is disabled; `{ error: "Account disabled" }` _(verified)_
- `423 Locked`: non-admin account with 3 or more failed logins; `{ error: "Account locked, too many failed attempts. Please contact the administrator." }` _(source)_

---

### 2. Register

Creates a customer account (role `user`). _(source)_

**Endpoint:** `POST /users/register`

**Auth:** None _(source)_

**Request Body:**
```ts
{
  first_name: string;       // max 40
  last_name: string;        // max 20
  email: string;            // max 256, unique
  password: string;         // see "Strong password" above
  address?: {
    street?: string;        // max 70
    house_number?: string | null;  // max 10
    city?: string;          // max 40
    state?: string;         // max 40
    country?: string;       // max 40
    postal_code?: string;   // max 10; must match the country's format when country is sent
  };
  phone?: string;           // max 24
  dob?: string;             // YYYY-MM-DD, at least 18 years ago
}
```
No text field may contain Unicode subscript or superscript characters. _(source)_

**Response:** `201 Created` _(verified)_
```ts
{
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  dob?: string;
  created_at: string;
  address: Address;
}
```
The created user as stored, so only the fields that were sent appear (plus `id`, `created_at` and `address`). _(source)_

**Error Responses:**
- `409 Conflict`: the only failing rule is the unique email; `{ email: ["A customer with this email address already exists."] }` _(source)_
- `422 Unprocessable Entity`: a required field is missing or a field fails its rule (also when the email is taken and another field fails too); body `{ <field>: string[] }` _(source)_

---

### 3. Forgot password

Sets the account's password to `welcome02`. No email confirmation or token is involved. _(source)_

**Endpoint:** `POST /users/forgot-password`

**Auth:** None _(source)_

**Request Body:**
```ts
{
  email: string;
}
```

**Response:** `200 OK` _(source)_
```ts
{ success: true }
```

**Error Responses:**
- `404 Not Found`: no `email` in the body (the `exists` rule is skipped and the lookup fails); `{ message: "Requested item not found" }` _(source)_
- `422 Unprocessable Entity`: no account with this email; framework default body `{ message: string; errors: { email: string[] } }` _(source)_

---

### 4. Change password

Changes the current user's password. _(source)_

**Endpoint:** `POST /users/change-password`

**Auth:** Bearer token, any role _(source)_

**Request Body:**
```ts
{
  current_password: string;
  new_password: string;               // see "Strong password" above
  new_password_confirmation: string;  // must equal new_password
}
```

**Response:** `200 OK` _(source)_
```ts
{ success: true }
```

**Error Responses:**
- `401 Unauthorized`: no token, or an invalid or expired one _(source)_
- `400 Bad Request`: `current_password` is wrong or missing, or `new_password` equals it; `{ success: false, message: string }` _(source)_
- `422 Unprocessable Entity`: `new_password` fails the password rules or doesn't match the confirmation; framework default body `{ message: string; errors: { new_password: string[] } }` _(source)_

---

### 5. Current user

Profile of the user the token belongs to. `role`, `enabled` and `failed_login_attempts` are returned only when the caller is an admin. _(verified)_

**Endpoint:** `GET /users/me`

**Auth:** Bearer token, any role _(source)_

**Response:** `200 OK` _(verified)_
```ts
User
```

**Error Responses:**
- `401 Unauthorized`: no token, or a malformed one; `{ message: "Unauthorized" }` _(verified)_

---

### 6. Logout

Invalidates (blacklists) the token. Later requests with it get `401`. _(source)_

**Endpoint:** `GET /users/logout`

**Auth:** Bearer token, any role _(source)_

**Response:** `200 OK` _(source)_
```ts
{ message: string }   // "Successfully logged out"
```

**Error Responses:**
- `401 Unauthorized`: no token _(verified)_; an invalid or already logged-out token gives the same _(source)_

---

### 7. Refresh token

Returns a new token for the one in the `Authorization` header and invalidates the old one. An expired token can still be refreshed within the refresh window (`JWT_REFRESH_TTL`, 60 minutes by default). This route has no auth middleware; the token is read by the handler. _(source)_

**Endpoint:** `GET /users/refresh`

**Auth:** Bearer token (read by the handler, not by middleware) _(source)_

**Response:** `200 OK` _(source)_
```ts
{
  access_token: string;
  token_type: string;   // "bearer"
  expires_in: number;
}
```

**Error Responses:**
- `401 Unauthorized`: the token is past the refresh window (`"Token has expired and can no longer be refreshed"`) or was invalidated by logout or an earlier refresh (`"Token is not valid"`) _(source)_
- `500 Internal Server Error`: no token, or a malformed one; `{ message: "Server Error" }`; suspected bug, should be 401 _(verified)_

---

### 8. List users

Lists customer accounts (role `user` only), 15 per page. Admin only. _(source)_

**Endpoint:** `GET /users`

**Auth:** Bearer token, `admin` role _(source)_

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `page` | integer | No | Page number, starting at 1 |

**Response:** `200 OK` _(source)_
```ts
{
  current_page: number;
  data: User[];
  from: number | null;
  last_page: number;
  per_page: number;
  to: number | null;
  total: number;
}
```

**Error Responses:**
- `401 Unauthorized`: no token _(verified)_
- `403 Forbidden`: the user isn't an admin; `{ message: "Forbidden" }` _(source)_

---

### 9. Search users

Searches customer accounts (role `user` only) by first name, last name, email and city. Any logged-in user can search (see Notes). Returns 15 per page. _(source)_

**Endpoint:** `GET /users/search`

**Auth:** Bearer token, any role _(source)_

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `q` | string | No | Search term. The spec marks it required; without it every customer matches. |
| `page` | integer | No | Page number, starting at 1 |

**Response:** `200 OK` _(source)_
```ts
{
  current_page: number;
  data: User[];
  from: number | null;
  last_page: number;
  per_page: number;
  to: number | null;
  total: number;
}
```
The spec documents a plain `User[]` array; the handler returns this paginated object. _(source)_

**Error Responses:**
- `401 Unauthorized`: no token _(verified)_

---

### 10. Search users (HTTP QUERY)

Same as `GET /users/search`, with the criteria in a JSON body. _(source)_

**Endpoint:** `QUERY /users/search`

**Auth:** Bearer token, any role _(source)_

**Request Body:**
```ts
{
  q?: string;
  page?: string;
}
```

**Response:** `200 OK` _(source)_
Same shape as `GET /users/search`, with the header `Accept-Query: application/json`. _(source)_

**Error Responses:**
- `401 Unauthorized`: no token (sent with `Content-Type: application/json`) _(verified)_
- `415 Unsupported Media Type`: `Content-Type` is not JSON; checked by route middleware before the token, so it applies without a token too _(source)_

---

### 11. Get user

Returns a user. A non-admin can only get their own record. _(source)_

**Endpoint:** `GET /users/{userId}`

**Auth:** Bearer token; own id, or any id with the `admin` role _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `userId` | string | Yes | User ULID |

**Response:** `200 OK` _(source)_
```ts
User
```

**Error Responses:**
- `401 Unauthorized`: no token _(verified)_
- `404 Not Found`: no user with this id, or a non-admin asks for another user's id; `{ error: string }` _(source)_

---

### 12. Update user

Updates a user's profile. A non-admin can only update their own record; only an admin can send `role`. `password` is ignored (use change-password). _(source)_

**Endpoint:** `PUT /users/{userId}`

**Auth:** Bearer token; own id, or any id with the `admin` role _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `userId` | string | Yes | User ULID |

**Request Body:**
```ts
{
  first_name: string;       // max 40
  last_name: string;        // max 20
  email: string;            // max 256
  address: {
    street: string;         // max 70
    city: string;           // max 40
    country: string;        // max 40
    house_number?: string | null;  // max 10
    state?: string | null;  // max 40
    postal_code?: string | null;   // max 10
  };
  phone?: string | null;    // 7 to 24 of: digits, spaces, ( ) + - .
  dob?: string;             // YYYY-MM-DD, at least 18 years ago
  role?: string;            // admin only
}
```

**Response:** `200 OK` _(source)_
```ts
{ success: boolean }
```

**Error Responses:**
- `401 Unauthorized`: no token, or an invalid or expired one _(source)_
- `403 Forbidden`: a non-admin updates another user (`"You can only update your own data."`) or sends `role` (`"Only admins can update the role."`); also, as suspected bugs, an unknown id (should be 404) and an email already used by another account (should be 409/422, and the body leaks the SQL error); body `{ error: string }` _(source)_
- `422 Unprocessable Entity`: a required field is missing or a field fails its rule; body `{ <field>: string[] }` _(source)_

---

### 13. Partially update user

Updates only the validated fields that are sent. A non-admin can only patch their own record. _(source)_

**Endpoint:** `PATCH /users/{userId}`

**Auth:** Bearer token; own id, or any id with the `admin` role _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `userId` | string | Yes | User ULID |

**Request Body:**
```ts
{
  first_name?: string;
  last_name?: string;
  email?: string;
  address?: {
    street?: string;
    house_number?: string | null;
    city?: string;
    state?: string | null;
    country?: string;
    postal_code?: string | null;
  };
  phone?: string | null;
  dob?: string;
  enabled?: boolean;
  failed_login_attempts?: number;
  totp_enabled?: boolean;
  totp_secret?: string | null;
  totp_verified_at?: string | null;
}
```
The same length and format rules as `PUT` apply. `role` has no rule, so it's dropped silently, even for admins. _(source)_

**Response:** `200 OK` _(source)_
```ts
{ success: true }
```

**Error Responses:**
- `401 Unauthorized`: no token, or an invalid or expired one _(source)_
- `403 Forbidden`: a non-admin patches another user; also, as suspected bugs, an unknown id (should be 404) and an email already used by another account; body `{ error: string }` _(source)_
- `422 Unprocessable Entity`: a sent field fails its rule (e.g. `phone` with letters, `dob` under 18) _(source)_

---

### 14. Delete user

Deletes a user. Admin only. _(source)_

**Endpoint:** `DELETE /users/{userId}`

**Auth:** Bearer token, `admin` role _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `userId` | string | Yes | User ULID |

**Response:** `204 No Content` _(verified)_

**Error Responses:**
- `401 Unauthorized`: no token, or an invalid or expired one _(source)_
- `403 Forbidden`: the user isn't an admin; `{ message: "Forbidden" }` _(source)_
- `409 Conflict`: the user is referenced elsewhere (invoices, favorites); `{ success: false, message: "Seems like this customer is used elsewhere." }` _(source)_
- `500 Internal Server Error`: no user with this id; `{ error: string }`; suspected bug, should be 404 _(source)_

---

## Data Models

### User

As returned by `/users/me`, `/users/{userId}`, the lists and search. _(source)_

```ts
interface User {
  id: string;               // ULID
  provider: string | null;  // social login provider
  first_name: string;
  last_name: string;
  phone: string | null;
  dob: string | null;       // YYYY-MM-DD
  email: string;
  totp_enabled: boolean;
  created_at: string;       // "YYYY-MM-DD HH:mm:ss"
  address: Address;
  // only when the caller is an admin:
  role?: string;            // "admin" | "user"
  enabled?: boolean;
  failed_login_attempts?: number;
}
```

### Address

```ts
interface Address {
  street: string | null;
  house_number: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
}
```

## Enums

- `role`: `admin`, `user`. Registration always creates `user`. _(source)_
- `token_type`: `bearer`. _(source)_

## Error Handling

- Errors from middleware and the global handler (`app/Exceptions/Handler.php`) have the body `{ message: string }`, e.g. `"Unauthorized"`, `"Forbidden"`, `"Requested item not found"`, `"Method is not allowed for the requested route"`, `"Server Error"`. _(verified)_
- `UserController` builds its own errors as `{ error: string }` (login, get, update, patch, delete) or `{ success: false, message: string }` (change-password, delete conflicts). _(source)_
- Validation by form requests (register, `PUT`, `PATCH`) returns `{ <field>: string[] }`, with `409` when only uniqueness rules failed and `422` otherwise (`BaseFormRequest`). Inline validation (forgot-password, change-password) returns Laravel's default `{ message: string; errors: { <field>: string[] } }` with `422`. _(source)_
- `405 Method Not Allowed`: any method a path has no route for, e.g. `QUERY /users/me`; `{ message: "Method is not allowed for the requested route" }`. Not listed per endpoint. _(verified)_
- Framework errors are JSON only when the request sends `Accept: application/json`; otherwise Laravel may render HTML (and `422` from inline validation becomes a redirect). _(source)_

## Notes

- **Path collisions:** `/users/{userId}` also matches words such as `login` or `register` for the methods those paths don't define, e.g. `GET /users/login` is "get user `login`" and needs a token. `OPTIONS /users/me` answers `Allow: DELETE, GET, PATCH, PUT` for the same reason. _(verified)_
- **OPTIONS:** every users path answers `OPTIONS` with `204` and an `Allow` header. Not in the spec. _(verified)_
- **Search is open to every logged-in user:** `GET`/`QUERY /users/search` has no role check, so any customer can list other customers' names, emails and cities. Suspected privacy bug. _(source)_
- **Self-service account flags:** `PATCH /users/{userId}` validates and saves `enabled`, `failed_login_attempts` and the `totp_*` fields for the user's own record, so a customer can change them. Suspected bug. _(source)_
- **Age check bug:** the register rule meant to reject customers older than 75 (`"Customer must be younger than 75 years old."`) subtracts 75 years from a date that already had 18 subtracted, so it only rejects birth dates more than 93 years ago. _(source)_
- **Forgot password** resets any account's password to `welcome02` without a token; don't call it for shared test accounts. _(source)_
- **Breach check:** register and change-password check the new password against the Have I Been Pwned service (`uncompromised()`), so they depend on that service. _(source)_
- **Spec vs source:**
  - `POST /users/login`: the spec lists no error codes; the handler returns `400`, `401`, `403` and `423`.
  - `POST /users/register` and `POST /users/forgot-password`: the spec lists `400`, `401` and `403`, which these public handlers can't return; it omits register's `422` and forgot-password's `404` and `422`.
  - `PUT /users/{userId}`: the spec marks `password` required; the handler ignores it. The spec's `409` can't happen (no uniqueness rule; a duplicate email gives `403`).
  - `GET /users/search`: the spec says it returns an array and searches first name, last name and city; the handler returns a paginated object and also searches email.
  - `GET /users` and `GET /users/refresh`: the spec lists `400`, which the source doesn't produce; refresh's no-token `500` isn't in the spec.
  - `DELETE /users/{userId}`: the spec lists `404`; the handler returns `500` for an unknown id.
  - The spec's `UserResponse` always includes `enabled` and `failed_login_attempts`; the API returns them to admins only.
  _(source)_
