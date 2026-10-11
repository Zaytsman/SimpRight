import { test, expect, expectNamesContain, takeSeededBrandIds, expectIncludesBrandIds } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { BrandsClient } from '@api/clients/BrandsClient';
import type { BrandSearchQueryBody } from '@api/dto/brand';
import { TestConstants } from '@data/TestConstants';
import { expectMessage, expectStatus } from '@utils/apiChecks';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/brands/query-brands-search.yml

type QuerySearchRequest = {
  method: 'QUERY';
  path: '/brands/search';
  headers: { 'Content-Type': string; Accept: string };
  body: BrandSearchQueryBody | string;
};

const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' } as const;

/** Sends QUERY /brands/search and attaches the request and the response. A string body is sent as-is with the given Content-Type. */
async function sendQuerySearch(
  brandsClient: BrandsClient,
  body: BrandSearchQueryBody | string,
  headers: QuerySearchRequest['headers'] = JSON_HEADERS
): Promise<{ request: QuerySearchRequest; response: ApiResponse }> {
  const request: QuerySearchRequest = { method: 'QUERY', path: '/brands/search', headers, body };
  const response = await brandsClient.querySearch(body, { contentType: headers['Content-Type'], accept: headers.Accept });
  await attachJson('Query Search Request', request);
  await attachJson('Query Search Response', { status: response.status, headers: response.headers, body: response.body });
  return { request, response };
}

test.describe('@brands-api - Brands API', () => {
  test('API-0160: QUERY search returns only matching brands', async ({ brandsClient }) => {
    const term = TestConstants.brands.searchTerm;
    let request: QuerySearchRequest;
    let response: ApiResponse;

    await test.step('Send QUERY /brands/search with Content-Type: application/json, Accept: application/json and the body { "q": "forge" }.', async () => {
      ({ request, response } = await sendQuerySearch(brandsClient, { q: term }));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the Accept-Query response header is application/json.', async () => {
      expect(response.headers['accept-query'], assertMessage({ request, expected: 'Accept-Query: application/json', actual: response.headers })).toBe(
        'application/json'
      );
    });

    await test.step('Verify the body is a non-empty array and every item\'s name contains "forge" (case-insensitive).', async () => {
      expectNamesContain(request, JSON.parse(response.body), term);
    });
  });

  test('API-0161: QUERY search with an empty body returns the seeded brands', async ({ brandsService, brandsClient }) => {
    let request: QuerySearchRequest;
    let response: ApiResponse;

    const seededIds = await takeSeededBrandIds(brandsService);

    await test.step(
      'Send QUERY /brands/search with Content-Type: application/json, Accept: application/json and an empty JSON object as the body.',
      async () => {
        ({ request, response } = await sendQuerySearch(brandsClient, {}));
      }
    );

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the body includes both seeded brand ids.', async () => {
      expectIncludesBrandIds(request, JSON.parse(response.body), seededIds);
    });
  });

  test('API-0162: QUERY search without a JSON Content-Type returns 415', async ({ brandsClient }) => {
    let request: QuerySearchRequest;
    let response: ApiResponse;

    await test.step('Send QUERY /brands/search with Content-Type: text/plain, Accept: application/json and a plain-text body.', async () => {
      ({ request, response } = await sendQuerySearch(brandsClient, `q=${TestConstants.brands.searchTerm}`, { 'Content-Type': 'text/plain', Accept: 'application/json' }));
    });

    await test.step('Verify the response status is 415.', async () => {
      expectStatus(request, response, 415);
    });

    await test.step('Verify the body\'s message is "QUERY requests must use Content-Type: application/json".', async () => {
      expectMessage(request, response, 'QUERY requests must use Content-Type: application/json');
    });
  });

  test('API-0163: QUERY search with q as an array returns 422', async ({ brandsClient }) => {
    test.fail(true, 'Known issue BUG-011: Returns 500 instead of 422 when q is sent as an array.');
    let request: QuerySearchRequest;
    let response: ApiResponse;

    await test.step('Send QUERY /brands/search with Content-Type: application/json, Accept: application/json and the body { "q": ["x"] }.', async () => {
      ({ request, response } = await sendQuerySearch(brandsClient, { q: ['x'] }));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });
  });
});
