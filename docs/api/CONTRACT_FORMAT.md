# API contract format

The coverage reporter measures tests against **API contracts**: markdown files, one per API area, in the contract folder (`docDir`, default `docs/api/contracts`). This file is the specification of that format. The reporter's parser, the `validate` command and the `api-contract-writer` agent (`/write-api-contracts`) all follow it.

> This is a copy of the specification shipped with the optional coverage package (`@zaytsman/playwright-api-coverage`), which owns the parser. When the package's format changes, update this file in the same change. The `npx playwright-api-coverage` commands below need the package; without it, contracts can still be written by hand or by the agent, but not validated.

Check a folder of contracts at any time with:

```bash
npx playwright-api-coverage validate docs/api/contracts
```

It prints every endpoint with the parameters, body fields and status codes the reporter will measure, then any problems, each with its file and line. It exits with 1 when there are errors; `--strict` also fails on warnings, and `--json` prints the result as JSON.

## What the parser reads

Only these parts are measured. Everything else in the file is free text for people, and is ignored.

| Part | Syntax | Notes |
|---|---|---|
| Service name | The first `# <Name> API Documentation` heading | "API Documentation" is stripped. Without an H1, the file name is used (`Order_History_API.md` → "Order History"). Each file needs its own name. |
| Endpoint | A `### <n>. <Title>` section containing `` **Endpoint:** `METHOD /path` `` | The section ends at the next `###` or `##` heading. Methods: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS and QUERY. |
| Path | `/products/{productId}` or `/products/:productId` | Relative to the API base URL, starting with `/`. Both parameter spellings are the same endpoint. Paths ending in `/health` are skipped. |
| Path parameters | `**Path Parameters:**` + a table or list | Parameters in the path that aren't listed are added automatically, as required. |
| Query parameters | `**Query Parameters:**` + a table or list, or `None` | Measured: which parameters the tests send. |
| Request body | `**Request Body:**` + a ` ```ts ` or ` ```json ` block | Measured: which fields the tests send. In TypeScript, `field?:` is optional; in a JSON sample every key counts as required, so prefer TypeScript. |
| Success response | `` **Response:** `200 OK` ``, optionally followed by a code block with the response shape | One success status per endpoint. The block belongs to the response only if it comes before the next `**Label:**`. |
| Error responses | `**Error Responses:**` + a list or table | The status code must start the list item or table row (`` - `404 Not Found`: ... ``, `\| 404 \| Not Found \| ... \|`). Numbers elsewhere in the line or in prose are ignored. Codes below 300 are ignored here; put the success status in `**Response:**`. |
| Endpoints Overview | A `## Endpoints Overview` table: `\| Method \| Path \| Description \|` | An endpoint listed here without a `###` section is still measured, with a default `200` only (the validator warns about it). |
| Base URL | `## Base URL` followed by a `` `url` `` | Informational. |

### Parameter tables and lists

A table needs a header with a parameter column (`Parameter`, `Name` or `Field`); `Type`, `Required` and `Description` columns are optional. A parameter is required when its Required cell contains `yes`, `true` or `required`.

```md
| Parameter | Type | Required | Description |
|---|---|---|---|
| `q` | string | Yes | Search term |
| `page` | integer | No | Page number, starting at 1 |
```

A list item is `` - `name` (type, required|optional): description ``:

```md
- `page` (number, optional): Page number
- `role` (string, required): Filter by role
```

## Minimal endpoint

````md
# Products API Documentation

### 1. Update product

Replaces a product. Admin only.

**Endpoint:** `PUT /products/{productId}`

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `productId` | string | Yes | Product ULID |

**Request Body:**
```ts
{
  name: string;
  price: number;
  description?: string;
}
```

**Response:** `200 OK`
```ts
{
  success: boolean;
}
```

**Error Responses:**
- `401 Unauthorized`: no or expired token
- `404 Not Found`: no product with this id
- `422 Unprocessable Entity`: a field fails validation

---
````

## Full document layout

For contracts written as reference documentation (as the `api-contract-writer` agent does), use this order. The `##` sections other than the endpoints are free text and are never measured.

1. `# <Service> API Documentation`, then one or two sentences on what the API area does.
2. `## Base URL`: the URL, and where tests configure it.
3. `## Authentication`: the scheme, header, how to get a token, and which roles exist.
4. `## Endpoints Overview`: a `| Method | Path | Description | Auth |` table of every endpoint in the file. The first three columns must be in this order.
5. `## Data required for successful requests`: a `| Data | Needed by | Requirements |` table of what a caller must have before a request can succeed: tokens and roles, IDs that must exist, valid enum values, unique values such as emails.
6. `## Endpoints`: one `### <n>. <Title>` section per endpoint, as above, separated by `---`. Add a worked example request and response where it helps, under a label such as `**Example:**`, after the response block.
7. `## Data Models`: the shared shapes (`Product`, `Brand`) that responses refer to. Subsections here may use `###`, but must never contain an `**Endpoint:**` line.
8. `## Enums`: allowed values.
9. `## Error Handling`: the error body shape shared by all endpoints, and validation-error details.
10. `## Notes`: anything a tester should know: rate limits, pagination, quirks, known bugs.

### Where each fact came from

A contract is only as good as its facts. Mark how each status code and each non-obvious behaviour is known by ending the line with one of these tags:

| Tag | Meaning |
|---|---|
| `_(verified)_` | Observed against the running API. |
| `_(source)_` | Read in the service's source code, not observed. |
| `_(spec)_` | Taken from the OpenAPI spec only. |

```md
**Error Responses:**
- `401 Unauthorized`: no or expired token _(verified)_
- `404 Not Found`: no product with this id _(verified)_
- `422 Unprocessable Entity`: `price` is not a number _(source)_
```

The tags don't change what is measured. `validate` counts the status codes by tag ("Status codes by origin: 12 verified, 40 source, 3 spec, 0 untagged"), so a team can see how much of a contract is confirmed and search for `_(source)_` and `_(spec)_` to find what still needs checking.
