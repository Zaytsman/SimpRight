import { test, expect, sendAndAttach } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { ImagesClient } from '@api/clients/ImagesClient';
import type { ProductImage } from '@api/dto/product';
import { describeAccept, expectContentType, expectMessage, expectSomeItems, expectStatus, parseJson } from '@utils/apiChecks';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/images/get-images.yml

type ImagesRequest = { method: 'GET'; path: string; query?: string; accept: string; ifNoneMatch?: string };

/** The keys every image record has (the contract's ProductImage), each a string. */
const IMAGE_KEYS = ['id', 'by_name', 'by_url', 'source_name', 'source_url', 'file_name', 'title'] as const;
const CACHE_CONTROL = 'max-age=120, public';

/** Sends GET /images with `imagesClient` (no token) and attaches the request and the response. */
async function sendList(
  imagesClient: ImagesClient,
  options: { query?: string; accept?: string | null; ifNoneMatch?: string } = {}
): Promise<{ request: ImagesRequest; response: ApiResponse }> {
  const request: ImagesRequest = {
    method: 'GET',
    path: '/images',
    ...(options.query ? { query: options.query } : {}),
    accept: describeAccept(options.accept),
    ...(options.ifNoneMatch !== undefined ? { ifNoneMatch: options.ifNoneMatch } : {}),
  };
  const response = await imagesClient.list(options);
  await attachJson('List Images Request', request);
  await attachJson('List Images Response', { status: response.status, headers: response.headers, body: response.body });
  return { request, response };
}

/** The checks of a "Verify the Cache-Control response header is "max-age=120, public"." step. */
function expectCacheControl(request: unknown, response: ApiResponse): void {
  expect(response.headers['cache-control'], assertMessage({ request, expected: `Cache-Control is "${CACHE_CONTROL}"`, actual: response.headers })).toBe(CACHE_CONTROL);
}

/** The checks of a "Verify the body is a non-empty (JSON) array." step; returns the parsed body. */
function expectNonEmptyArray(request: unknown, response: ApiResponse): ProductImage[] {
  let body: unknown;
  try {
    body = JSON.parse(response.body);
  } catch {
    body = undefined;
  }
  expect(
    Array.isArray(body) && body.length > 0,
    assertMessage({ request, expected: 'The body is a non-empty JSON array', actual: response.body.slice(0, 500) })
  ).toBe(true);
  return body as ProductImage[];
}

/** The XML document without its declaration (`<?xml version="1.0"?>`) and the whitespace around it. */
function xmlDocument(body: string): string {
  return body.trim().replace(/^<\?xml[^?]*\?>/, '').trim();
}

test.describe('@images-api - Images API', () => {
  test('API-0336: List images returns every image record', async ({ imagesClient }) => {
    let request: ImagesRequest;
    let response: ApiResponse;
    let images: ProductImage[];

    await test.step('Send GET /images without an Authorization header.', async () => {
      ({ request, response } = await sendList(imagesClient));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the body is a non-empty array.', async () => {
      images = expectNonEmptyArray(request, response);
    });

    await test.step('Verify every item has the keys id, by_name, by_url, source_name, source_url, file_name and title, each a string.', async () => {
      expectSomeItems(request, images, 'images');
      for (const image of images) {
        for (const key of IMAGE_KEYS) {
          expect(typeof image[key], assertMessage({ request, expected: `Item ${image.id} has the key "${key}" as a string`, actual: image })).toBe('string');
        }
      }
    });

    await test.step("Verify the items' ids are unique.", async () => {
      const ids = images.map((image) => image.id);
      const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
      expect(duplicates, assertMessage({ request, expected: 'No id appears twice', actual: { duplicates, count: ids.length } })).toEqual([]);
    });

    await test.step('Verify the Content-Type response header is application/json.', async () => {
      expectContentType(request, response, 'application/json');
    });

    await test.step('Verify the Cache-Control response header is "max-age=120, public".', async () => {
      expectCacheControl(request, response);
    });

    await test.step('Verify the response has an ETag header.', async () => {
      const etag = response.headers['etag'];
      expect(typeof etag === 'string' && etag.length > 0, assertMessage({ request, expected: 'An ETag header', actual: response.headers })).toBe(true);
    });
  });

  test('API-0337: List images ignores pagination, filter and sort parameters', async ({ imagesClient, imagesService }) => {
    let plain: ProductImage[];
    let request: ImagesRequest;
    let response: ApiResponse;

    await test.step('Send GET /images and take the body as the plain list.', async () => {
      await attachJson('List Images Request', { method: 'GET', path: '/images', accept: 'application/json' });
      plain = await imagesService.list();
      await attachJson('List Images Response', plain);
    });

    await test.step('Send GET /images with page=2, per_page=5, q=zzzz and sort=title.', async () => {
      ({ request, response } = await sendList(imagesClient, { query: 'page=2&per_page=5&q=zzzz&sort=title' }));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the body equals the plain list (same items, same order).', async () => {
      const body = parseJson<ProductImage[]>(request, response);
      expect(body, assertMessage({ request, expected: `The plain list (${plain.length} items, same order)`, actual: Array.isArray(body) ? body.map((image) => image.id) : body })).toEqual(
        plain
      );
    });
  });

  test('API-0338: List images with Accept text/xml returns XML', async ({ imagesClient }) => {
    let request: ImagesRequest;
    let response: ApiResponse;
    let document: string;

    await test.step('Send GET /images with the header Accept: text/xml.', async () => {
      ({ request, response } = await sendList(imagesClient, { accept: 'text/xml' }));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the Content-Type response header is "text/xml; charset=utf-8".', async () => {
      expectContentType(request, response, 'text/xml; charset=utf-8');
    });

    await test.step('Verify the body is an XML document whose root element is response and which contains at least one item element.', async () => {
      document = xmlDocument(response.body);
      expect(
        /^<response>[\s\S]*<\/response>$/.test(document),
        assertMessage({ request, expected: 'The root element is <response>', actual: response.body.slice(0, 500) })
      ).toBe(true);
      expect(/<item>[\s\S]*?<\/item>/.test(document), assertMessage({ request, expected: 'At least one <item> element', actual: response.body.slice(0, 500) })).toBe(
        true
      );
    });

    await test.step('Verify the first item element has the child elements id, by_name, by_url, source_name, source_url, file_name and title.', async () => {
      const firstItem = /<item>([\s\S]*?)<\/item>/.exec(document)?.[1] ?? '';
      for (const key of IMAGE_KEYS) {
        // A child element is <key>...</key>, or <key/> when empty.
        const child = new RegExp(`<${key}>[\\s\\S]*?</${key}>|<${key}\\s*/>`);
        expect(child.test(firstItem), assertMessage({ request, expected: `The first <item> has a <${key}> child element`, actual: firstItem })).toBe(true);
      }
    });
  });

  test('API-0339: List images with Accept application/xml returns JSON', async ({ imagesClient }) => {
    let request: ImagesRequest;
    let response: ApiResponse;

    await test.step('Send GET /images with the header Accept: application/xml.', async () => {
      ({ request, response } = await sendList(imagesClient, { accept: 'application/xml' }));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the Content-Type response header is application/json.', async () => {
      expectContentType(request, response, 'application/json');
    });

    await test.step('Verify the body is a non-empty JSON array.', async () => {
      expectNonEmptyArray(request, response);
    });
  });

  test('API-0340: List images without an Accept header returns JSON', async ({ imagesClient }) => {
    let request: ImagesRequest;
    let response: ApiResponse;

    await test.step('Send GET /images without an Accept header.', async () => {
      // Approved reading: "without an Accept header" = the client sets none; Playwright's request API then sends its
      // default Accept (any type), so the API never sees a request without the header.
      ({ request, response } = await sendList(imagesClient, { accept: null }));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the Content-Type response header is application/json.', async () => {
      expectContentType(request, response, 'application/json');
    });

    await test.step('Verify the body is a non-empty JSON array.', async () => {
      expectNonEmptyArray(request, response);
    });
  });

  test('API-0341: A path under /images other than /images returns 404', async ({ imagesClient }) => {
    const segment = '00000000000000000000000000';
    const request = { method: 'GET', path: `/images/${segment}` };
    let response: ApiResponse;

    await test.step('Send GET /images/00000000000000000000000000.', async () => {
      ({ response } = await sendAndAttach('Get Image Path', request, () => imagesClient.getByPath(segment)));
    });

    await test.step('Verify the response status is 404.', async () => {
      expectStatus(request, response, 404);
    });

    await test.step('Verify the body\'s message is "Resource not found".', async () => {
      expectMessage(request, response, 'Resource not found');
    });
  });

  test('API-0342: List images with a matching If-None-Match returns 304', async ({ imagesClient }) => {
    test.fail(true, 'Known issue BUG-046: Returns 200 instead of 304 when If-None-Match carries the ETag of a compressed response.');
    let etag = '';
    let request: ImagesRequest;
    let response: ApiResponse;

    await test.step('Send GET /images and take the ETag response header.', async () => {
      const first = await sendList(imagesClient);
      expectStatus(first.request, first.response, 200);
      etag = first.response.headers['etag'] ?? '';
      expect(Boolean(etag), assertMessage({ request: first.request, expected: 'The response has an ETag header', actual: first.response.headers })).toBe(true);
    });

    await test.step('Send GET /images with the If-None-Match header set to that ETag.', async () => {
      ({ request, response } = await sendList(imagesClient, { ifNoneMatch: etag }));
    });

    await test.step('Verify the response status is 304.', async () => {
      expectStatus(request, response, 304);
    });

    await test.step('Verify the body is empty.', async () => {
      expect(response.body, assertMessage({ request, expected: 'An empty body', actual: response.body.slice(0, 500) })).toBe('');
    });

    await test.step("Verify the ETag response header equals the first response's ETag.", async () => {
      expect(response.headers['etag'], assertMessage({ request, expected: `ETag is ${etag}`, actual: response.headers })).toBe(etag);
    });

    await test.step('Verify the Cache-Control response header is "max-age=120, public".', async () => {
      expectCacheControl(request, response);
    });
  });
});
