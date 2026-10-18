import { test, expect, expectIncludesIds, expectSubCategoriesOf, takeTreeItemIdsBySlugs, JSON_QUERY_HEADERS, sendQueryAndAttach, type QueryHeaders, type QueryRequestRecord } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { CategoriesClient } from '@api/clients/CategoriesClient';
import type { CategoryTree, CategoryTreeQueryBody } from '@api/dto/category';
import { TestConstants } from '@data/TestConstants';
import { expectAcceptQuery, expectMessage, expectStatus, parseJson } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/categories/query-categories-tree.yml

type QueryTreeRequestInfo = QueryRequestRecord<CategoryTreeQueryBody>;

/** Sends QUERY /categories/tree and attaches the request and the response. A string body is sent as-is with the given Content-Type. */
async function sendQueryTree(
  categoriesClient: CategoriesClient,
  body: CategoryTreeQueryBody | string,
  headers: QueryHeaders = JSON_QUERY_HEADERS
): Promise<{ request: QueryTreeRequestInfo; response: ApiResponse }> {
  return sendQueryAndAttach('Query Category Tree', '/categories/tree', body, headers, (sent, options) => categoriesClient.queryTree(sent, options));
}

test.describe('@categories-api - Categories API', () => {
  test('API-0183: QUERY category tree filtered by a top-level slug returns only that category', async ({ categoriesClient }) => {
    const slug = TestConstants.categories.powerTools;
    let request: QueryTreeRequestInfo;
    let response: ApiResponse;
    let body: CategoryTree[];

    await test.step(
      'Send QUERY /categories/tree with Content-Type: application/json, Accept: application/json and the body { "by_category_slug": "power-tools" }.',
      async () => {
        ({ request, response } = await sendQueryTree(categoriesClient, { by_category_slug: slug }));
      }
    );

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
      body = parseJson<CategoryTree[]>(request, response);
    });

    await test.step('Verify the Accept-Query response header is application/json.', async () => {
      expectAcceptQuery(request, response);
    });

    await test.step('Verify the body has exactly one item, whose slug is power-tools and whose parent_id is null.', async () => {
      const summary = body.map((item) => ({ slug: item.slug, parent_id: item.parent_id }));
      expect(summary, assertMessage({ request, expected: `Exactly one item: slug "${slug}", parent_id null`, actual: body })).toEqual([{ slug, parent_id: null }]);
    });

    await test.step("Verify the item's sub_categories is non-empty and every sub-category's parent_id equals the item's id.", async () => {
      const item = body[0]!;
      expect(item.sub_categories.length, assertMessage({ request, expected: 'sub_categories is non-empty', actual: item.sub_categories })).toBeGreaterThan(0);
      expectSubCategoriesOf(request, item);
    });
  });

  test('API-0184: QUERY category tree with an empty body returns the seeded top-level categories', async ({ categoriesService, categoriesClient }) => {
    let request: QueryTreeRequestInfo;
    let response: ApiResponse;

    const ids = await takeTreeItemIdsBySlugs(
      categoriesService,
      TestConstants.categories.topLevelSlugs,
      'Send GET /categories/tree and keep the ids of the items whose slugs are hand-tools, power-tools and other.'
    );

    await test.step(
      'Send QUERY /categories/tree with Content-Type: application/json, Accept: application/json and an empty JSON object as the body.',
      async () => {
        ({ request, response } = await sendQueryTree(categoriesClient, {}));
      }
    );

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's item ids include those ids.", async () => {
      expectIncludesIds(request, JSON.parse(response.body), ids);
    });
  });

  test('API-0185: QUERY category tree without a JSON Content-Type returns 415', async ({ categoriesClient }) => {
    let request: QueryTreeRequestInfo;
    let response: ApiResponse;

    await test.step('Send QUERY /categories/tree with Content-Type: text/plain, Accept: application/json and a plain-text body.', async () => {
      ({ request, response } = await sendQueryTree(categoriesClient, `by_category_slug=${TestConstants.categories.handTools}`, {
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

  test('API-0186: QUERY category tree with by_category_slug as an array returns 422', async ({ categoriesClient }) => {
    test.fail(true, 'Known issue BUG-016: Returns 500 instead of 422 when by_category_slug is sent as an array.');
    let request: QueryTreeRequestInfo;
    let response: ApiResponse;

    await test.step(
      'Send QUERY /categories/tree with Content-Type: application/json, Accept: application/json and the body { "by_category_slug": ["x"] }.',
      async () => {
        ({ request, response } = await sendQueryTree(categoriesClient, { by_category_slug: ['x'] }));
      }
    );

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });
  });
});
