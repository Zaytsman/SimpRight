import { test, takeSeededBrandIds, expectIncludesBrandIds, JSON_QUERY_HEADERS, sendQueryAndAttach, type QueryHeaders, type QueryRequestRecord } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { BrandsClient } from '@api/clients/BrandsClient';
import type { BrandSearchQueryBody } from '@api/dto/brand';
import { TestConstants } from '@data/TestConstants';
import { expectAcceptQuery, expectItemNamesContain, expectMessage, expectStatus, parseJson } from '@utils/apiChecks';

// Scenarios: test-scenarios/api/brands/query-brands-search.yml

type QuerySearchRequest = QueryRequestRecord<BrandSearchQueryBody>;

/** Sends QUERY /brands/search and attaches the request and the response. A string body is sent as-is with the given Content-Type. */
async function sendQuerySearch(
  brandsClient: BrandsClient,
  body: BrandSearchQueryBody | string,
  headers: QueryHeaders = JSON_QUERY_HEADERS
): Promise<{ request: QuerySearchRequest; response: ApiResponse }> {
  return sendQueryAndAttach('Query Search', '/brands/search', body, headers, (sent, options) => brandsClient.querySearch(sent, options));
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
      expectAcceptQuery(request, response);
    });

    await test.step('Verify the body is a non-empty array and every item\'s name contains "forge" (case-insensitive).', async () => {
      expectItemNamesContain(request, parseJson(request, response), term);
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
      expectIncludesBrandIds(request, parseJson(request, response), seededIds);
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
