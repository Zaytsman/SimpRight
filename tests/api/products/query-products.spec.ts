import { test, expect } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { ProductsClient } from '@api/clients/ProductsClient';
import type { Paginated } from '@api/dto/common';
import type { Product, ProductQueryBody } from '@api/dto/product';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/products/query-products.yml

type QueryRequest = {
  method: 'QUERY';
  path: '/products';
  headers: { 'Content-Type': string; Accept?: string };
  body: ProductQueryBody | string;
};

const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' } as const;

/** Any non-JSON text: the 415 scenarios only need a plain-text body. */
const PLAIN_TEXT_BODY = 'sort=name,asc';

/**
 * Sends QUERY /products and attaches the request and the response. A string body is sent as-is with the given
 * Content-Type; without an Accept header in `headers`, no `Accept: application/json` is sent.
 */
async function sendQuery(
  productsClient: ProductsClient,
  body: ProductQueryBody | string,
  headers: QueryRequest['headers'] = JSON_HEADERS
): Promise<{ request: QueryRequest; response: ApiResponse }> {
  const request: QueryRequest = { method: 'QUERY', path: '/products', headers, body };
  const response = await productsClient.queryList(body, { contentType: headers['Content-Type'], accept: headers.Accept ?? null });
  await attachJson('Query Products Request', request);
  await attachJson('Query Products Response', { status: response.status, headers: response.headers, body: response.body });
  return { request, response };
}

/** The checks of a "Verify the response status is 200." step; returns the parsed body. */
function expectQueryOk(request: QueryRequest, response: ApiResponse): Paginated<Product> {
  expect(response.status, assertMessage({ request, expected: 'Status 200', actual: response.status })).toBe(200);
  return JSON.parse(response.body) as Paginated<Product>;
}

test.describe('@products-api - Products API', () => {
  test('API-0015: QUERY list products returns a paginated list', async ({ productsClient }) => {
    let request: QueryRequest;
    let response: ApiResponse;
    let body: Paginated<Product>;

    await test.step('Send QUERY /products with Content-Type: application/json, Accept: application/json and an empty JSON object as the body.', async () => {
      ({ request, response } = await sendQuery(productsClient, {}));
    });

    await test.step('Verify the response status is 200.', async () => {
      body = expectQueryOk(request, response);
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

    await test.step('Verify per_page is 9 and data has at most 9 items.', async () => {
      expect(body.per_page, assertMessage({ request, expected: 'per_page is 9', actual: body.per_page })).toBe(9);
      expect(body.data.length, assertMessage({ request, expected: 'At most 9 items', actual: body.data.length })).toBeLessThanOrEqual(9);
    });
  });

  test('API-0016: QUERY list with sort returns the same products as the GET', async ({ productsService, productsClient }) => {
    const sort = 'name,asc';
    let getIds: string[] = [];
    let request: QueryRequest;
    let response: ApiResponse;
    let body: Paginated<Product>;

    await test.step('Send GET /products with sort=name,asc and keep the item ids in order.', async () => {
      const list = await productsService.list({ sort });
      await attachJson('List Products Request', { method: 'GET', path: '/products', query: { sort } });
      await attachJson('List Products Response', list);
      getIds = list.data.map((item) => item.id);
      expect(
        getIds.length,
        assertMessage({ request: { method: 'GET', path: '/products', query: { sort } }, expected: 'The GET returns items', actual: list.total })
      ).toBeGreaterThan(0);
    });

    await test.step('Send QUERY /products with Content-Type: application/json, Accept: application/json and the body { "sort": "name,asc" }.', async () => {
      ({ request, response } = await sendQuery(productsClient, { sort }));
    });

    await test.step('Verify the response status is 200.', async () => {
      body = expectQueryOk(request, response);
    });

    await test.step("Verify the QUERY response's item ids equal the GET response's item ids, in the same order.", async () => {
      const queryIds = body.data.map((item) => item.id);
      expect(queryIds, assertMessage({ request, expected: `The GET's ids in order: ${JSON.stringify(getIds)}`, actual: queryIds })).toEqual(getIds);
    });
  });

  test('API-0017: QUERY list without a JSON Content-Type is rejected with a JSON message', async ({ productsClient }) => {
    let request: QueryRequest;
    let response: ApiResponse;

    await test.step('Send QUERY /products with Content-Type: text/plain, Accept: application/json and a plain-text body.', async () => {
      ({ request, response } = await sendQuery(productsClient, PLAIN_TEXT_BODY, { 'Content-Type': 'text/plain', Accept: 'application/json' }));
    });

    await test.step('Verify the response status is 415.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 415', actual: response.status })).toBe(415);
    });

    await test.step('Verify the body\'s message is "QUERY requests must use Content-Type: application/json".', async () => {
      const body = JSON.parse(response.body) as { message?: string };
      expect(
        body.message,
        assertMessage({ request, expected: 'message is "QUERY requests must use Content-Type: application/json"', actual: body })
      ).toBe('QUERY requests must use Content-Type: application/json');
    });
  });

  test("API-0018: QUERY list without a JSON Content-Type returns an HTML error page when JSON isn't accepted", async ({ productsClient }) => {
    let request: QueryRequest;
    let response: ApiResponse;

    await test.step('Send QUERY /products with Content-Type: text/plain, a plain-text body and no Accept: application/json header.', async () => {
      ({ request, response } = await sendQuery(productsClient, PLAIN_TEXT_BODY, { 'Content-Type': 'text/plain' }));
    });

    await test.step('Verify the response status is 415.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 415', actual: response.status })).toBe(415);
    });

    await test.step('Verify the body is an HTML page, not JSON.', async () => {
      let isJson = true;
      try {
        JSON.parse(response.body);
      } catch {
        isJson = false;
      }
      const start = response.body.slice(0, 200);
      expect(isJson, assertMessage({ request, expected: 'The body is not JSON', actual: start })).toBe(false);
      expect(/<html[\s>]/i.test(response.body), assertMessage({ request, expected: 'The body is an HTML page (has an <html> element)', actual: start })).toBe(
        true
      );
    });
  });

  test('API-0019: QUERY list with an unknown sort column is not a server error', async ({ productsClient }) => {
    test.fail(true, 'Known issue: Returns 500 instead of a client error (or ignoring the column) for an unknown sort column.');
    let request: QueryRequest;
    let response: ApiResponse;

    await test.step('Send QUERY /products with Content-Type: application/json, Accept: application/json and the body { "sort": "no_such_column,asc" }.', async () => {
      ({ request, response } = await sendQuery(productsClient, { sort: 'no_such_column,asc' }));
    });

    await test.step('Verify the response status is not 500.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status is not 500', actual: response.status })).not.toBe(500);
    });
  });
});
