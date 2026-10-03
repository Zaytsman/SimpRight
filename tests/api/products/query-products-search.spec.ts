import { test, expect } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { ProductsClient } from '@api/clients/ProductsClient';
import type { Paginated } from '@api/dto/common';
import type { Product, ProductSearchQueryBody } from '@api/dto/product';
import { TestConstants } from '@data/TestConstants';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/products/query-products-search.yml

type QuerySearchRequest = {
  method: 'QUERY';
  path: '/products/search';
  headers: { 'Content-Type': string; Accept?: string };
  body: ProductSearchQueryBody | string;
};

const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' } as const;

/** Any non-JSON text: the 415 scenario only needs a plain-text body. */
const PLAIN_TEXT_BODY = 'q=pliers';

/**
 * Sends QUERY /products/search and attaches the request and the response. A string body is sent as-is with the given
 * Content-Type; without an Accept header in `headers`, no `Accept: application/json` is sent.
 */
async function sendQuerySearch(
  productsClient: ProductsClient,
  body: ProductSearchQueryBody | string,
  headers: QuerySearchRequest['headers'] = JSON_HEADERS
): Promise<{ request: QuerySearchRequest; response: ApiResponse }> {
  const request: QuerySearchRequest = { method: 'QUERY', path: '/products/search', headers, body };
  const response = await productsClient.querySearch(body, { contentType: headers['Content-Type'], accept: headers.Accept ?? null });
  await attachJson('Query Search Request', request);
  await attachJson('Query Search Response', { status: response.status, headers: response.headers, body: response.body });
  return { request, response };
}

/** The checks of a "Verify the response status is 200." step; returns the parsed body. */
function expectQuerySearchOk(request: QuerySearchRequest, response: ApiResponse): Paginated<Product> {
  expect(response.status, assertMessage({ request, expected: 'Status 200', actual: response.status })).toBe(200);
  return JSON.parse(response.body) as Paginated<Product>;
}

test.describe('@products-api - Products API', () => {
  test('API-0030: QUERY search returns only matching products', async ({ productsClient }) => {
    const term = TestConstants.products.searchTerm;
    let request: QuerySearchRequest;
    let response: ApiResponse;
    let body: Paginated<Product>;

    await test.step('Send QUERY /products/search with Content-Type: application/json, Accept: application/json and the body { "q": "pliers" }.', async () => {
      ({ request, response } = await sendQuerySearch(productsClient, { q: term }));
    });

    await test.step('Verify the response status is 200.', async () => {
      body = expectQuerySearchOk(request, response);
    });

    await test.step('Verify the Accept-Query response header is application/json.', async () => {
      const acceptQuery = response.headers['accept-query'];
      expect(acceptQuery, assertMessage({ request, expected: 'Accept-Query: application/json', actual: response.headers })).toBe('application/json');
    });

    await test.step('Verify the body has current_page, data, from, last_page, per_page, to and total.', async () => {
      for (const field of ['current_page', 'data', 'from', 'last_page', 'per_page', 'to', 'total'] as const) {
        expect(field in body, assertMessage({ request, expected: `Body has "${field}"`, actual: Object.keys(body) })).toBe(true);
      }
    });

    await test.step('Verify data is not empty and every item\'s name contains "pliers" (case-insensitive).', async () => {
      expect(body.data.length, assertMessage({ request, expected: 'data is not empty', actual: body.data.length })).toBeGreaterThan(0);
      for (const product of body.data) {
        expect(
          product.name.toLowerCase(),
          assertMessage({ request, expected: `Product name should contain "${term}" (case-insensitive)`, actual: product.name })
        ).toContain(term);
      }
    });
  });

  test('API-0031: QUERY search without a term returns an empty page', async ({ productsClient }) => {
    let request: QuerySearchRequest;
    let response: ApiResponse;
    let body: Paginated<Product>;

    await test.step('Send QUERY /products/search with Content-Type: application/json, Accept: application/json and an empty JSON object as the body.', async () => {
      ({ request, response } = await sendQuerySearch(productsClient, {}));
    });

    await test.step('Verify the response status is 200.', async () => {
      body = expectQuerySearchOk(request, response);
    });

    await test.step('Verify data is an empty array.', async () => {
      expect(
        Array.isArray(body.data) && body.data.length === 0,
        assertMessage({ request, expected: 'data is an empty array', actual: body.data })
      ).toBe(true);
    });
  });

  test('API-0032: QUERY search without a JSON Content-Type is rejected', async ({ productsClient }) => {
    let request: QuerySearchRequest;
    let response: ApiResponse;

    await test.step('Send QUERY /products/search with Content-Type: text/plain, Accept: application/json and a plain-text body.', async () => {
      ({ request, response } = await sendQuerySearch(productsClient, PLAIN_TEXT_BODY, { 'Content-Type': 'text/plain', Accept: 'application/json' }));
    });

    await test.step('Verify the response status is 415.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 415', actual: response.status })).toBe(415);
    });
  });

  test('API-0072: QUERY search page 2 returns the same products as the GET', async ({ productsService, productsClient }) => {
    /** Matches more than 9 seeded product names (hammer, pliers, screwdriver...), so page 2 has items. */
    const term = 'er';
    let getIds: string[] = [];
    let request: QuerySearchRequest;
    let response: ApiResponse;
    let body: Paginated<Product>;

    await test.step('Send GET /products/search with q=er and page=2 and keep the item ids in order.', async () => {
      await attachJson('Search Products Request', { method: 'GET', path: '/products/search', query: { q: term, page: 2 } });
      const list = await productsService.search(term, 2);
      await attachJson('Search Products Response', list);
      getIds = list.data.map((item) => item.id);
    });

    await test.step('Send QUERY /products/search with Content-Type: application/json, Accept: application/json and the body { "q": "er", "page": "2" }.', async () => {
      ({ request, response } = await sendQuerySearch(productsClient, { q: term, page: '2' }));
    });

    await test.step('Verify the response status is 200.', async () => {
      body = expectQuerySearchOk(request, response);
    });

    await test.step('Verify data is not empty.', async () => {
      expect(body.data.length, assertMessage({ request, expected: 'data is not empty', actual: body.total })).toBeGreaterThan(0);
    });

    await test.step('Verify current_page is 2.', async () => {
      expect(body.current_page, assertMessage({ request, expected: 'current_page is 2', actual: body.current_page })).toBe(2);
    });

    await test.step("Verify the QUERY response's item ids equal the GET response's item ids, in the same order.", async () => {
      const queryIds = body.data.map((item) => item.id);
      expect(queryIds, assertMessage({ request, expected: `The GET's ids in order: ${JSON.stringify(getIds)}`, actual: queryIds })).toEqual(getIds);
    });
  });
});
