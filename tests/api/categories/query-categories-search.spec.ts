import { test, expectSlugsInclude, JSON_QUERY_HEADERS, sendQueryAndAttach, type QueryHeaders, type QueryRequestRecord } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { CategoriesClient } from '@api/clients/CategoriesClient';
import type { CategorySearchQueryBody } from '@api/dto/category';
import { TestConstants } from '@data/TestConstants';
import { expectAcceptQuery, expectItemNamesContain, expectMessage, expectStatus } from '@utils/apiChecks';

// Scenarios: test-scenarios/api/categories/query-categories-search.yml

type QuerySearchRequestInfo = QueryRequestRecord<CategorySearchQueryBody>;

/** Sends QUERY /categories/search and attaches the request and the response. A string body is sent as-is with the given Content-Type. */
async function sendQuerySearch(
  categoriesClient: CategoriesClient,
  body: CategorySearchQueryBody | string,
  headers: QueryHeaders = JSON_QUERY_HEADERS
): Promise<{ request: QuerySearchRequestInfo; response: ApiResponse }> {
  return sendQueryAndAttach('Query Search', '/categories/search', body, headers, (sent, options) => categoriesClient.querySearch(sent, options));
}

test.describe('@categories-api - Categories API', () => {
  test('API-0197: QUERY search returns only matching categories', async ({ categoriesClient }) => {
    const { term, slugs } = TestConstants.categories.shortSearch;
    let request: QuerySearchRequestInfo;
    let response: ApiResponse;

    await test.step('Send QUERY /categories/search with Content-Type: application/json, Accept: application/json and the body { "q": "saw" }.', async () => {
      ({ request, response } = await sendQuerySearch(categoriesClient, { q: term }));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the Accept-Query response header is application/json.', async () => {
      expectAcceptQuery(request, response);
    });

    await test.step('Verify the body is a non-empty array and every item\'s name contains "saw" (case-insensitive).', async () => {
      expectItemNamesContain(request, JSON.parse(response.body), term);
    });

    await test.step("Verify the body's slugs include hand-saw and saw.", async () => {
      expectSlugsInclude(request, JSON.parse(response.body), slugs);
    });
  });

  test('API-0198: QUERY search with an empty body returns the seeded categories', async ({ categoriesClient }) => {
    let request: QuerySearchRequestInfo;
    let response: ApiResponse;

    await test.step(
      'Send QUERY /categories/search with Content-Type: application/json, Accept: application/json and an empty JSON object as the body.',
      async () => {
        ({ request, response } = await sendQuerySearch(categoriesClient, {}));
      }
    );

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's slugs include hand-tools, hammer and saw.", async () => {
      expectSlugsInclude(request, JSON.parse(response.body), TestConstants.categories.searchSeededSlugs);
    });
  });

  test('API-0199: QUERY search without a JSON Content-Type returns 415', async ({ categoriesClient }) => {
    let request: QuerySearchRequestInfo;
    let response: ApiResponse;

    await test.step('Send QUERY /categories/search with Content-Type: text/plain, Accept: application/json and a plain-text body.', async () => {
      ({ request, response } = await sendQuerySearch(categoriesClient, `q=${TestConstants.categories.shortSearch.term}`, {
        'Content-Type': 'text/plain',
        Accept: 'application/json',
      }));
    });

    await test.step('Verify the response status is 415.', async () => {
      expectStatus(request, response, 415);
    });

    await test.step('Verify the body\'s message is "QUERY requests must use Content-Type: application/json".', async () => {
      expectMessage(request, response, 'QUERY requests must use Content-Type: application/json');
    });
  });

  test('API-0200: QUERY search with q as an array returns 422', async ({ categoriesClient }) => {
    test.fail(true, 'Known issue BUG-017: Returns 500 instead of 422 when q is sent as an array.');
    let request: QuerySearchRequestInfo;
    let response: ApiResponse;

    await test.step('Send QUERY /categories/search with Content-Type: application/json, Accept: application/json and the body { "q": ["x"] }.', async () => {
      ({ request, response } = await sendQuerySearch(categoriesClient, { q: ['x'] }));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });
  });
});
