# Messages API Documentation

The contact form of the Toolshop API (the spec's tag is `Contact`): a visitor, guest or logged-in, sends a message to the shop, an admin reads every message and replies to it, and the status of a message moves between `NEW`, `IN_PROGRESS` and `RESOLVED`. This area lists and reads messages, sends a message, replies to a message, attaches a file to a message (a stub that stores nothing) and sets a message's status. `POST /messages` and the file attachment are open to everyone; the other four endpoints need a token.

> Written on 2026-10-10 from the Laravel source (`sprint5/API`: `routes/api.php`, `ContactController`, `ContactService`, the `StoreContact`/`StoreContactReply` form requests, the `ContactRequests` and `ContactRequestReply` models and their migrations, `Authenticate`, `AssignGuard`, `PaginateMiddleware`, `BaseFormRequest`, `app/Exceptions/Handler.php`, `tests/Feature/ContactTest.php`), the OpenAPI spec (`storage/api-docs/api-docs.json`, tag `Contact`) and read-only calls to the live API (`GET`, `OPTIONS`, requests without a token that the API rejects, and file uploads that the API rejects with `400`). **No token was available**, so no response of a logged-in user was seen (not the list, not one message, not a reply, not a status change), and no message was created, changed or attached: the success shapes below come from the source only. Facts are tagged by origin.

## Base URL

`https://api.practicesoftwaretesting.com` (see `apiBaseUrl` in `src/envs/<ENV>.json`).

## Authentication

- Scheme: `Authorization: Bearer <JWT>` from `POST /users/login` (see `Users_API.md`). The token expires after 300 seconds. _(source)_
- `ContactController` applies the `auth:users` middleware to every action except `send` (`POST /messages`) and `attachFile` (`POST /messages/{messageId}/attach-file`). So `GET /messages`, `GET /messages/{messageId}`, `POST /messages/{messageId}/reply` and `PUT /messages/{messageId}/status` need a token; the other two need none. _(source)_
- Without a token, or with a malformed token, the four protected endpoints return `401` with `{ message: "Unauthorized" }`, as JSON with or without `Accept: application/json`; the token is checked before the id and the body. _(verified)_ (seen for all four) An expired or logged-out token gives the same `401`. _(source)_
- A restricted token (the intermediate token of the two-factor login flow, with the `restricted` claim) gets `401` with `{ message: "Unauthorized token usage" }` on the protected endpoints. _(source)_
- **There is no role check on any endpoint** (`RoleMiddleware` isn't applied here). The JWT's `role` claim (`admin` or `user`) only changes what `GET /messages` and `GET /messages/{messageId}` return: an admin reads every message, any other user only the messages whose `user_id` is theirs. Replying to a message and setting its status are open to every logged-in user, whatever the message's owner (see Notes). _(source)_
- `POST /messages` reads the token optionally: with a valid token the message gets the token's `user_id`; without one, or with a token that doesn't validate, it is a guest message with `user_id` unset. The account-state check below doesn't run there. _(source)_
- **Account state, shared by the four protected endpoints:** a disabled account (`enabled: false`) gets `403` with `{ message: "Account disabled." }`. The middleware caches the user for 60 seconds, so a change can take up to a minute to apply. It is not documented per endpoint. _(source)_

## Endpoints Overview

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/messages` | List messages (paginated), own or all for an admin | Any logged-in user |
| POST | `/messages` | Send a contact message (guest or logged-in) | None (token optional) |
| GET | `/messages/{messageId}` | Get one message with its sender and replies | Any logged-in user (own message) or admin |
| POST | `/messages/{messageId}/reply` | Add a reply to a message and set it to `IN_PROGRESS` | Any logged-in user |
| POST | `/messages/{messageId}/attach-file` | Check a file for a message (nothing is stored) | None |
| PUT | `/messages/{messageId}/status` | Set a message's status | Any logged-in user |

## Data required for successful requests

| Data | Needed by | Requirements |
|---|---|---|
| Access token | `GET /messages`, `GET /messages/{messageId}`, `POST .../reply`, `PUT .../status` | A token from `POST /users/login` for an enabled account. To read a message, use the sender's token or an admin token; to see every message, an admin token. |
| Message id (ULID) | every endpoint with `{messageId}` | The `id` returned by `POST /messages`, or listed in `data[]` by `GET /messages`. A guest's message can be read only by an admin (its `user_id` is null). Only `PUT .../status` answers `404` for an unknown id (see Notes). |
| Subject and message text | `POST /messages` | `subject` (at most 120 characters) and `message` (at most 250), both required, without the characters U+2070 to U+209F. |
| Reply text | `POST .../reply` | `message`, a string of at most 250 characters, without the characters U+2070 to U+209F. |
| Status value | `PUT .../status` | One of `NEW`, `IN_PROGRESS`, `RESOLVED` (see Enums), in upper case. `ON_HOLD`, which the spec lists, is rejected. |
| A file | `POST .../attach-file` | A multipart form field named `file`: an empty file (0 bytes) with the extension `txt`. Anything else is rejected with `400`. |

## Endpoints

### 1. List messages

Returns a page of contact messages, newest `created_at` first, 15 per page. An admin gets every message, each with its sender (`user`, `null` for a guest message); any other user gets only the messages whose `user_id` is theirs, without the `user` relation. There is no filter or search. _(source)_

**Endpoint:** `GET /messages`

**Auth:** Any logged-in user; a non-admin gets only their own messages _(source)_

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `page` | integer | No | Page number, starting at 1 _(spec)_ |

**Response:** `200 OK` _(source)_
```ts
{
  current_page: number;
  data: ContactMessageListItem[];   // see Data Models
  from: number | null;
  last_page: number;
  per_page: number;                 // 15 (the paginator's default, no explicit size in the code)
  to: number | null;
  total: number;
}
```

`PaginateMiddleware` removes `first_page_url`, `links`, `last_page_url`, `next_page_url`, `prev_page_url` and `path` from the paginator's output. An empty list is `200` with `data: []`. The service's tests assert the `data[]` item structure (`id`, `user_id`, `email`, `subject`, `message`, `created_at`) for an admin and for a customer. _(source)_ Invalid `page` values and pages past the end are handled by the framework's paginator (read as page 1, and an empty `data`); not observed. _(source)_

**Error Responses:**
- `401 Unauthorized`: no token, or a malformed token, with `{ message: "Unauthorized" }` _(verified)_; an expired token gives the same _(source)_

**Example:** `GET /messages?page=1` with an admin token returns the 15 newest messages of all users and guests.

---

### 2. Send message

Stores a contact message with status `NEW`. Guests and logged-in users can send one. With a valid token the message gets the token's `user_id` and shows up in that user's list; without a token it has no owner. The deployed API runs with `APP_ENV=production` (`GET /status` reports `"environment": "production"`), so no email is queued: the service queues the mail only when the environment is `local`. _(source)_

**Endpoint:** `POST /messages`

**Auth:** None; a valid token is optional and links the message to its user _(source)_

**Request Body:**
```ts
{
  name?: string;      // at most 120 in the validation, but the column holds 60 (see Notes)
  email?: string;     // valid email, at most 256; the spec says "required when not authenticated", the code doesn't require it
  subject: string;    // required, at most 120
  message: string;    // required, at most 250
}
```

Each text field must not contain subscript or superscript characters (U+2070 to U+209F). `subject` and `message` must be strings. `email` has `sometimes`, not `nullable`: omit it rather than sending `null` or `""` (the global `ConvertEmptyStringsToNull` middleware turns `""` into `null`); by Laravel's rules a `null` email fails the `email` rule, which is not verified. Unknown keys such as `first_name` and `last_name` (the service's tests send them) are ignored, because they are not in the model's `fillable` list; but the validated and unvalidated `fillable` keys `user_id`, `parent_id` and `status` are read from the body (see Notes). _(source)_

**Response:** `200 OK` _(source)_
```ts
ContactMessage   // see Data Models: the created message, not { success: true } as the spec says
```

The service's tests assert `200` and the keys `id`, `email`, `subject`, `message`, `created_at` for a guest, plus `user_id` for a logged-in user. The spec documents `{ success: boolean }`. _(source)_

**Error Responses:**
- `422 Unprocessable Entity`: a field fails validation: `subject` or `message` is missing, empty or not a string; a field is longer than its limit; `email` is not a valid email; a field has subscript or superscript characters. The body is a map of field to messages without a wrapper (`BaseFormRequest`), e.g. `{ subject: ["The subject field is required."] }`, and it is JSON whatever the `Accept` header _(source)_
- `500 Internal Server Error`: `name` has 61 to 120 characters (the validation allows 120, the `contact_requests.name` column is `varchar(60)` and the database runs in strict mode), or the body has a `parent_id` key (a `fillable` attribute that has no column), or a guest sends a `user_id` longer than 26 characters; the database error maps to `{ message: "Something went wrong" }`; suspected bug, should be `422` or ignored _(source)_

**Example:**
```http
POST /messages
Content-Type: application/json
Accept: application/json

{ "name": "Jane Doe", "email": "jane@example.test", "subject": "Return", "message": "I would like to return a hammer." }

200 OK
{ "id": "01JMSG00123456789ABCDEFGH", "name": "Jane Doe", "email": "jane@example.test", "subject": "Return", "message": "I would like to return a hammer.", "status": "NEW", "created_at": "2026-10-10 10:00:00" }
```

---

### 3. Get message

Returns one message with its sender and its replies (each reply with its author). An admin can read any message; any other user only their own. _(source)_

**Endpoint:** `GET /messages/{messageId}`

**Auth:** Any logged-in user; a non-admin gets only their own messages (`user_id` = the token's user) _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `messageId` | string (ULID) | Yes | The message's id (named `{id}` in the route) |

**Response:** `200 OK` _(source)_
```ts
ContactMessageDetail   // see Data Models
```

The service's tests assert `200` and the keys `id`, `user_id`, `email`, `subject`, `message`, `created_at` for an admin reading a guest message and for a customer reading their own. _(source)_

A message that doesn't exist, or that a non-admin doesn't own, is **not** a `404`: the service's `first()` returns `null` and the controller answers `200` with that empty value (a JSON body that is empty, probably `[]` after `PaginateMiddleware`; not observed, as it needs a token). Suspected bug, the spec documents `404`. _(source)_

**Error Responses:**
- `401 Unauthorized`: no token, or a malformed token, with `{ message: "Unauthorized" }`; the token is checked before the id (an id that can't exist also gives `401`) _(verified)_

---

### 4. Reply to message

Adds a reply to a message and sets the message to `IN_PROGRESS` first, whatever its current status. The reply's author is the token's user. There is no role check and no ownership check, so any logged-in user can reply to any message (see Notes). _(source)_

**Endpoint:** `POST /messages/{messageId}/reply`

**Auth:** Any logged-in user; no role or ownership check _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `messageId` | string (ULID) | Yes | The message's id (named `{id}` in the route) |

**Request Body:**
```ts
{
  message: string;   // required, at most 250, without U+2070 to U+209F
}
```

Only `message` is read (`$request->all(['message'])`). The spec's request body is the contact form (`name`, `email`, `subject`, `message`, with `subject` required); the code needs and uses only `message`. _(source)_

**Response:** `201 Created` _(source)_
```ts
ContactReply   // see Data Models
```

The service's test asserts `201` and the keys `message` and `created_at`; the spec says `200`, with the author in `user`, which the created model doesn't carry. _(source)_

**Error Responses:**
- `401 Unauthorized`: no token, or a malformed token, with `{ message: "Unauthorized" }`; checked before the body and the id _(verified)_
- `422 Unprocessable Entity`: `message` is missing, empty, not a string, longer than 250 characters or has subscript or superscript characters. The body is a map of field to messages without a wrapper, e.g. `{ message: ["The message field is required."] }` (asserted by the service's tests). The validation runs before the lookup, so an unknown id with an invalid body gives `422` _(source)_
- `500 Internal Server Error`: no message with this id exists; nothing checks it, and the insert breaks the foreign key `contact_request_replies.message_id`, which the handler maps to `{ message: "Something went wrong" }`; suspected bug, should be `404` _(source)_

**Example:**
```http
POST /messages/01JMSG00123456789ABCDEFGH/reply
Authorization: Bearer <token>
Content-Type: application/json

{ "message": "We have started the return." }

201 Created
{ "message": "We have started the return.", "id": "01JREPLY0123456789ABCDEFG", "created_at": "2026-10-10 10:05:00" }
```

---

### 5. Attach file to message

Checks a file uploaded for a message. The service only validates the upload and logs it: **nothing is stored and the message id is never looked up**, so the call answers the same for an unknown id. The only upload that succeeds is an empty `.txt` file. Needs no token. _(source)_

**Endpoint:** `POST /messages/{messageId}/attach-file`

**Auth:** None _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `messageId` | string (ULID) | Yes | The message's id (named `{id}` in the route); not checked for existence |

**Request Body:**

`multipart/form-data` with one file field (`$request->file('file')`, so one file per request):

```ts
{
  file: File;   // required; must be 0 bytes and have the extension "txt"
}
```

The checks run in this order and the first failure is returned alone: no file; a file that isn't empty (a file with a wrong extension and content gets this message); an extension other than `txt`. The extension comparison is case-sensitive (`TXT` is rejected). _(source)_

**Response:** `200 OK` _(source)_
```ts
{
  success: boolean;   // true
}
```

The service's test asserts the exact body `{ success: true }` for an empty `log.txt`. Not observed live (it would be a successful upload). _(source)_

**Error Responses:**
- `400 Bad Request`: the upload is rejected, with `{ errors: string[] }` holding one message: `"No file attached."` (no `file` part) _(verified)_; `"Currently we only allow empty files."` (a 1-byte `.txt` file, and also a 1-byte `.pdf`) _(verified)_; `"The file extension is incorrect, we only accept txt files."` (an empty `.pdf` file) _(verified)_

**Example:**
```http
POST /messages/01JMSG00123456789ABCDEFGH/attach-file
Content-Type: multipart/form-data; boundary=...

--...
Content-Disposition: form-data; name="file"; filename="note.pdf"

(empty)
--...--

400 Bad Request
{ "errors": ["The file extension is incorrect, we only accept txt files."] }
```

---

### 6. Update message status

Sets the status of a message to `NEW`, `IN_PROGRESS` or `RESOLVED`. There is no state machine: any status can be set from any other, including the same one. There is no role check and no ownership check. _(source)_

**Endpoint:** `PUT /messages/{messageId}/status`

**Auth:** Any logged-in user; no role or ownership check _(source)_

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `messageId` | string (ULID) | Yes | The message's id (named `{id}` in the route) |

**Request Body:**
```ts
{
  status: MessageStatus;   // required; NEW, IN_PROGRESS or RESOLVED (see Enums)
}
```

The spec doesn't mark `status` required and lists `ON_HOLD` among the values; the inline validation (`required|in:NEW,IN_PROGRESS,RESOLVED`) requires it and rejects `ON_HOLD`. _(source)_

**Response:** `200 OK` _(source)_
```ts
{
  success: boolean;   // true
}
```

The service's test asserts `200` and the exact body `{ success: true }` for `RESOLVED`. _(source)_

**Error Responses:**
- `401 Unauthorized`: no token, or a malformed token, with `{ message: "Unauthorized" }`; checked before the body and the id _(verified)_
- `404 Not Found`: no message with this id (`findOrFail`), with `{ message: "Requested item not found" }` from the global handler. The validation runs first, so an unknown id with an invalid body gives `422` _(source)_
- `422 Unprocessable Entity`: `status` is missing or not one of the allowed values (`ON_HOLD`, a lower-case value). The inline validation returns Laravel's default `{ message: string; errors: { status: string[] } }` (framework default, not the `BaseFormRequest` shape), and only with `Accept: application/json`; the service's test asserts `422` with an error on `status` for a missing and a wrong value _(source)_

**Example:**
```http
PUT /messages/01JMSG00123456789ABCDEFGH/status
Authorization: Bearer <token>
Content-Type: application/json

{ "status": "RESOLVED" }

200 OK
{ "success": true }
```

## Data Models

### ContactMessage

The body of `POST /messages`: the model as it was created, not reloaded from the database, so only the attributes that were set are present (an omitted `name` or `email` isn't in the body). `updated_at` is hidden. _(source)_

```ts
interface ContactMessage {
  id: string;            // ULID
  user_id?: string;      // only when the sender was logged in
  name?: string;
  email?: string;
  subject: string;
  message: string;
  status: MessageStatus; // always "NEW" on creation, whatever the body says
  created_at: string;    // "YYYY-MM-DD HH:mm:ss"
}
```

### ContactMessageListItem

An item of `data[]` in `GET /messages`. A row from the database, so the nullable columns are present. _(source)_

```ts
interface ContactMessageListItem {
  id: string;
  user_id: string | null;       // null for guest messages
  name: string | null;
  email: string | null;
  subject: string;
  message: string;
  status: MessageStatus;
  created_at: string;
  user?: User | null;           // admin callers only; null for guest messages
}
```

### ContactMessageDetail

Returned by `GET /messages/{messageId}`, for an admin and for the owner alike. _(source)_

```ts
interface ContactMessageDetail {
  id: string;
  user_id: string | null;
  name: string | null;
  email: string | null;
  subject: string;
  message: string;
  status: MessageStatus;
  created_at: string;
  user: User | null;            // the sender; see Users_API.md. role, enabled and failed_login_attempts only for an admin caller
  replies: ContactReplyDetail[];
}

interface ContactReplyDetail {
  id: string;
  message: string;
  created_at: string;
  user: User;                   // the reply's author, with the same fields as above (see Notes)
}
```

### ContactReply

Returned by `POST /messages/{messageId}/reply`: the created model without relations. `message_id`, `user_id` and `updated_at` are hidden. _(source)_

```ts
interface ContactReply {
  id: string;
  message: string;
  created_at: string;
}
```

### User

The `user` objects embedded in messages and replies are the user model of `Users_API.md` (`id`, `first_name`, `last_name`, `email`, `phone`, `dob`, `address`, `provider`, `totp_enabled`, `created_at`, and `role`, `enabled`, `failed_login_attempts` only when the caller is an admin). _(source)_

## Enums

- `MessageStatus`: `NEW` (the status of a new message), `IN_PROGRESS` (set by a reply), `RESOLVED`. The database column is an enum of these three values, and the status endpoint accepts exactly these. The spec's request schema also lists `ON_HOLD`, which is rejected with `422`. _(source)_
- Role claim in the token: `admin`, `user`. Only `admin` changes what the read endpoints return. _(source)_

## Error Handling

- Errors from the auth middleware and the global handler (`app/Exceptions/Handler.php`) have the body `{ message: string }`: `"Unauthorized"` _(verified)_, `"Unauthorized token usage"`, `"Account disabled."`, `"Requested item not found"` (a `findOrFail` miss), `"Something went wrong"` (a database error), `"Method is not allowed for the requested route"` _(verified)_, `"Resource not found"` (an unknown path). _(source)_
- The attachment check has its own body, `{ errors: string[] }` with `400`. _(verified)_
- Validation errors have two shapes. The form requests (`POST /messages`, `POST .../reply`) return a map of field to messages without a wrapper, `{ <field>: string[] }`, with `422` (`BaseFormRequest`), as JSON whatever the `Accept` header. The inline validation (`PUT .../status`) returns Laravel's default `{ message: string; errors: { <field>: string[] } }` with `422`, and without `Accept: application/json` a redirect instead (framework default, not observed). _(source)_
- A database error maps through the handler: `1062` to `409` `{ message: "Duplicate Entry" }`, `1364` to `404` `{ message: "Something went wrong" }`, anything else to `500` `{ message: "Something went wrong" }`. A foreign key violation (a reply to an unknown message) and a too long value reach the last branch. No `409` is reachable on a messages endpoint (no unique rule or index). _(source)_
- `405 Method Not Allowed`: any method a path has no route for, e.g. `DELETE /messages` (seen) or `GET /messages/{messageId}/status`; `{ message: "Method is not allowed for the requested route" }`. Shared by every route, so it isn't listed per endpoint. _(verified)_
- Every `401` is JSON even without `Accept: application/json` (the middleware builds it itself). _(verified)_

## Notes

- **Status and replies are open to every logged-in user:** `POST /messages/{messageId}/reply` and `PUT /messages/{messageId}/status` have no role check and no ownership check (`RoleMiddleware` is not applied to the controller). A customer can reply to, or resolve, any other customer's or guest's message, as the tests' admin does. The spec's only requirement is `apiAuth`. Suspected missing authorization. _(source)_
- **Unknown message ids:** `GET /messages/{messageId}` answers `200` with an empty body for an unknown or foreign id (the spec says `404`); `POST .../reply` answers `500`; `POST .../attach-file` doesn't look the id up at all (`400` for a bad file, `200` for an empty `.txt`, for any id; the `400` was seen for an id that can't exist); only `PUT .../status` answers `404`. Suspected bugs, inconsistent. _(source)_
- **A guest can attribute a message to any user:** `POST /messages` passes the whole request body to `ContactRequests::create`, and `user_id` is `fillable`; the service overwrites it only when a token is sent. A guest can send `user_id` of another user, and the message then shows in that user's `GET /messages` (there is no foreign key on `contact_requests.user_id`). The same body can carry `parent_id`, which has no column and gives `500`. Suspected bug. _(source)_
- **`name` limit mismatch:** the validation allows 120 characters, the column is `varchar(60)`, so a name of 61 to 120 characters passes validation and then fails in the database with `500`. The spec also says 120. Suspected bug. Not reproduced (needs writes). _(source)_
- **`email` isn't required for guests:** the spec describes it as "required when not authenticated"; the rules only have `sometimes|email`. A guest message with no email and no name is accepted, so its sender can't be reached. In the `local` environment the service would fail on such a message (it reads the email of the logged-in user, who doesn't exist); the live API runs in `production`. _(source)_
- **Replies reopen messages:** a reply sets the status to `IN_PROGRESS` before it is saved, so replying to a `RESOLVED` message reopens it, and a reply to an unknown id first runs an update that changes no row. Replies don't send any mail. _(source)_
- **Reply authors are exposed:** `GET /messages/{messageId}` loads `replies.user` for non-admin callers too, and the user model's `toArray` hides only `role`, `enabled` and `failed_login_attempts` (and the address parts that are re-added under `address`). A customer reading their message gets the reply author's (an admin's) email, name, phone, date of birth and address. Suspected privacy issue; not observed (needs a token). _(source)_
- **Status values and transitions:** a new message is `NEW`; `POST .../reply` sets `IN_PROGRESS`; `PUT .../status` sets any of the three values from any status. No transition is refused, and nothing else (replies, attachments) reads the status. The status can't be set on creation (`status` is overwritten with `NEW`). _(source)_
- **Attachments are a stub:** the file is validated and discarded, so there is no download endpoint and no attachment in any message response. The "one file per message" limit isn't enforced: one `file` field is read per request, and nothing is remembered between requests. _(source)_
- **No filter, search or sort:** `GET /messages` takes only `page`; the order is `created_at` descending, 15 per page. There is no `status` filter. _(source)_
- **OPTIONS:** `routes/api.php` defines `OPTIONS` for every messages path (the shared `$respondOptions` handler: `204` with an `Allow` header built from the routes that match the path). Seen: `/messages` answers `Allow: GET, POST`, `/messages/{messageId}` answers `Allow: GET`, `/messages/{messageId}/status` answers `Allow: PUT`. Not in the spec. _(verified)_
- **XML:** with `Accept: text/xml`, the JSON responses are rendered as XML (`Controller::preferredFormat`). _(source)_
- **Cache headers:** the messages routes have no cache middleware; the responses seen carry `Cache-Control: no-cache, private`. _(verified)_
- **Rate limiting:** no throttle is applied to the messages routes. _(source)_
- **No seeded messages:** none of the seeders creates a contact message, so the table holds only what callers created since the last re-seed; the hourly re-seed (`migrate:fresh --seed`, see `liveApi.transient` in the profile) empties it, and an id from before the re-seed is gone afterwards. A test must create its own message and can't rely on a seeded one. _(source)_
- **OpenAPI spec vs source:**
  - Path parameter: the spec names it `{messageId}`; the routes call it `{id}`.
  - `POST /messages`: the spec's `200` body is `{ success }`; the handler returns the created message. The spec lists `404`, which can't happen, and omits `422`. `email` "required when not authenticated" isn't enforced.
  - `POST /messages/{messageId}/attach-file`: the spec lists only `200` and `404`; the handler returns `400` with `{ errors }` (seen) and never `404`. The `file` part is marked optional in the spec; without it the API answers `400`.
  - `GET /messages`: the spec's `404` can't happen (an empty result is `200`).
  - `GET /messages/{messageId}`: the spec's `404` isn't returned (an empty `200` instead). The spec's `anyOf` of `ContactResponse` and `ContactResponseAuthenticated` doesn't show that the body also has `user` and `replies`.
  - `POST /messages/{messageId}/reply`: the spec documents the contact form as the request body and a `200` response with `user`; the code reads only `message`, returns `201` and no `user`. The spec's `404` is `500` in the code, and `422` is missing.
  - `PUT /messages/{messageId}/status`: the spec lists `ON_HOLD` as a value (rejected with `422`) and no `required` or `422`; the operation's description lists only the three accepted values. Its `404` matches.
  - Every operation lists `405`, which is the framework-wide response (see Error Handling).
  _(source)_
