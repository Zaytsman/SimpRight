# Images API Documentation

The product images of the Toolshop API: one public, read-only endpoint that lists every image record. Products reference an image through `product_image_id` and return it as `product_image` (see `Products_API.md`).

> Written on 2026-10-10 from the Laravel source (`sprint5/API`: `routes/api.php`, `ImageController`, the `ProductImage` model and its migration, `Controller::preferredFormat`, `app/Http/Kernel.php`, `PaginateMiddleware`, `app/Exceptions/Handler.php`, `tests/Feature/ImageTest.php`), the OpenAPI spec (`storage/api-docs/api-docs.json`, tag `Image`) and read-only calls to the live API (`GET`, `HEAD` and `OPTIONS` without a token; nothing was written). Facts are tagged by origin.

## Base URL

`https://api.practicesoftwaretesting.com` (see `apiBaseUrl` in `src/envs/<ENV>.json`).

## Authentication

- None. `GET /images` has no auth middleware; the only middleware on the route is `cache.headers`. _(source)_ It answered `200` without a token. _(verified)_
- There are no roles and no account-state checks on this area. _(source)_

## Endpoints Overview

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/images` | List all product images | None |

## Data required for successful requests

| Data | Needed by | Requirements |
|---|---|---|
| Nothing | `GET /images` | No token, id or parameter is needed. |
| Image id (ULID) | `POST /products` and `PUT`/`PATCH /products/{productId}` (`product_image_id`, see `Products_API.md`) | An `id` from this list. This API has no way to create, read or delete a single image. |

## Endpoints

### 1. List images

Returns every row of the `product_images` table as a JSON array. The list is not paginated, filtered or sorted by the API: `index()` returns `ProductImage::all()`. _(source)_ An empty table gives `[]`. _(source)_

**Endpoint:** `GET /images`

**Auth:** None _(verified)_

**Query Parameters:** None

The endpoint declares no query parameters. `?page=2&per_page=5&q=zzzz&sort=title` returned the same 53 items as the plain call, byte for byte. _(verified)_

**Response:** `200 OK` _(verified)_
```ts
ProductImage[]   // see Data Models
```

The live list had 53 items with unique ids. The count depends on the seeded data (the demo site re-seeds every hour), so a test shouldn't hard-code it. _(verified)_ The service's test asserts `200` and, for each item, the keys `id`, `by_name`, `by_url`, `source_name`, `source_url`, `file_name` and `title`. _(source)_

**Response headers:** _(verified)_
- `Cache-Control: max-age=120, public`
- `ETag: "<md5 of the body>"` (a different value for the JSON and the XML rendering)
- `Content-Type: application/json`

**Conditional request:** sending the `ETag` back in `If-None-Match` gives `304 Not Modified` with an empty body and the same `Cache-Control` and `ETag` headers. _(verified)_

**Error Responses:**
- `304 Not Modified`: the request's `If-None-Match` matches the current `ETag` of the response (the `cache.headers:public;max_age=120;etag` middleware). A success-class answer rather than an error, listed because it is a distinct status that tests can check. _(verified)_

The endpoint has no error responses of its own: there is no auth, no input and no lookup that can fail. The OpenAPI spec lists `404` and `405` on it; neither can come from `GET /images` (see Notes). _(source)_

**Example:**
```http
GET /images
Accept: application/json

200 OK
Cache-Control: max-age=120, public
ETag: "bbb5b3c3be55d7921d8a8de7b0c91d90"
Content-Type: application/json

[
  {
    "id": "01M4JJDDDNHWRKHWHJZJJGNKGT",
    "by_name": "<photographer>",
    "by_url": "<photographer page URL>",
    "source_name": "<site name>",
    "source_url": "<source URL>",
    "file_name": "<name>.avif",
    "title": "<image title>"
  }
]
```

## Data Models

### ProductImage

One item of the list; the same shape as `product_image` in the product responses of `Products_API.md`. `created_at` and `updated_at` exist in the table but are hidden by `BaseModel`, and the live items have no timestamps. _(source)_ _(verified)_

```ts
interface ProductImage {
  id: string;           // ULID (26 characters)
  by_name: string;      // author of the image
  by_url: string;       // link to the author
  source_name: string;  // site the image came from
  source_url: string;   // link to the source page
  file_name: string;    // the image's file name; .avif in the live data
  title: string;        // image title
}
```

The six text columns are `varchar(220)` and nullable in the migration, so a record could carry `null` for any of them. All 53 live items had all six as non-empty strings. _(source)_ _(verified)_

## Error Handling

- Errors from the global handler (`app/Exceptions/Handler.php`) have the body `{ message: string }`. _(source)_
- `404 Not Found`: any path under `/images` other than `/images` itself has no route (there is no `/images/{imageId}`), e.g. `GET /images/00000000000000000000000000` returns `{ message: "Resource not found" }`. _(verified)_ This is the router's `NotFoundHttpException`, not an image lookup. _(source)_
- `405 Method Not Allowed`: a method `/images` has no route for (`POST`, `PUT`, `PATCH`, `DELETE`, `QUERY`) gets `{ message: "Method is not allowed for the requested route" }`. Shared by every route, so it isn't listed on the endpoint; not called live, because the brief allowed no write methods. _(source)_

## Notes

- **No pagination, filtering or sorting:** `GET /images` has no parameters. The response always contains every image, and unknown query parameters are ignored. _(verified)_ The `PaginateMiddleware` that every route passes through only strips pagination link fields from JSON bodies; a plain array has none. _(source)_
- **Cache headers:** the route uses the `cache.headers:public;max_age=120;etag` middleware: `Cache-Control: max-age=120, public` plus an `ETag`, and `304` for a matching `If-None-Match`. _(verified)_ `HEAD /images` answers `200` with the same `Cache-Control`. _(verified)_ The controller itself reads the table directly, with no application cache. _(source)_
- **Accept-dependent body:** `Controller::preferredFormat` renders XML only when the `Accept` header contains the substring `text/xml`. _(source)_ With `Accept: text/xml` the response is `200` with `Content-Type: text/xml; charset=utf-8` and a body of the form `<response><item><id>…</id><by_name>…</by_name>…</item>…</response>`: one `<item>` per image with the same seven child elements. `Accept: application/json`, no `Accept` header (`*/*`) and `Accept: application/xml` all give the JSON array with `Content-Type: application/json`. _(verified)_
- **OPTIONS:** `OPTIONS /images` answers `204` with an empty body and `Allow: GET`. The header is computed from the routes that match the path and leaves out `HEAD` and `OPTIONS`; the response has `Cache-Control: no-cache, private` instead of the cache middleware's headers. Not in the spec. _(verified)_
- **CORS:** `GET` and `OPTIONS` responses carry `Access-Control-Allow-Origin: *` (global `HandleCors`, all paths and origins allowed). _(verified)_
- **OpenAPI spec vs source and live API:**
  - The spec lists `404` ("Requested item not found") and `405` on `GET /images`. The handler can't return either: `ProductImage::all()` doesn't throw, an empty table is `200` with `[]`, and `GET` is the allowed method. The `404` the live API gives for `/images/<anything>` has a different message (`Resource not found`) and belongs to another path. _(source)_
  - `ImageResponse` lists the same seven properties as the live items; the spec marks none as required, and the live items always had all of them. _(verified)_
  - The spec documents only `application/json`; `Accept: text/xml` also works (see above). _(verified)_
  - The spec doesn't list `OPTIONS /images` or the `304` conditional response. _(verified)_
