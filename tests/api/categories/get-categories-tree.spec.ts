import { test, expect, expectSlugsInclude, expectSubCategoriesOf, sendAndAttach } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { CategoriesClient } from '@api/clients/CategoriesClient';
import type { CategoryTree } from '@api/dto/category';
import { TestConstants } from '@data/TestConstants';
import { CategoryFactory } from '@data/factories/CategoryFactory';
import { expectEmptyArray, expectSomeItems, expectStatus, parseJson } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/categories/get-categories-tree.yml

type TreeRequestInfo = { method: 'GET'; path: '/categories/tree'; query: { by_category_slug?: string | string[] } };

/** Sends GET /categories/tree (no `by_category_slug` when `bySlug` is undefined) and attaches the request and the response. */
async function sendTree(categoriesClient: CategoriesClient, bySlug?: string | string[]): Promise<{ request: TreeRequestInfo; response: ApiResponse }> {
  const request: TreeRequestInfo = { method: 'GET', path: '/categories/tree', query: bySlug === undefined ? {} : { by_category_slug: bySlug } };
  return sendAndAttach('Category Tree', request, () => categoriesClient.tree(bySlug));
}

test.describe('@categories-api - Categories API', () => {
  test('API-0178: Category tree returns the top-level categories with their sub-categories', { tag: '@smoke' }, async ({ categoriesClient }) => {
    let request: TreeRequestInfo;
    let response: ApiResponse;
    let body: CategoryTree[];

    await test.step('Send GET /categories/tree.', async () => {
      ({ request, response } = await sendTree(categoriesClient));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
      body = parseJson<CategoryTree[]>(request, response);
    });

    await test.step("Verify the body is a non-empty array and every item's parent_id is null.", async () => {
      expect(Array.isArray(body) && body.length > 0, assertMessage({ request, expected: 'The body is a non-empty array', actual: body })).toBe(true);
      const withParent = body.filter((item) => item.parent_id !== null);
      expect(withParent, assertMessage({ request, expected: "Every item's parent_id is null", actual: withParent })).toEqual([]);
    });

    await test.step("Verify the body's slugs include hand-tools, power-tools and other.", async () => {
      expectSlugsInclude(request, body, TestConstants.categories.topLevelSlugs);
    });

    await test.step("Verify every item has a sub_categories array, and every sub-category's parent_id equals its item's id.", async () => {
      expectSomeItems(request, body, 'The body');
      for (const item of body) expectSubCategoriesOf(request, item);
    });
  });

  test('API-0179: Category tree filtered by a top-level slug returns only that category', async ({ categoriesClient }) => {
    const slug = TestConstants.categories.handTools;
    let request: TreeRequestInfo;
    let response: ApiResponse;
    let body: CategoryTree[];

    await test.step('Send GET /categories/tree with by_category_slug=hand-tools.', async () => {
      ({ request, response } = await sendTree(categoriesClient, slug));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
      body = parseJson<CategoryTree[]>(request, response);
    });

    await test.step('Verify the body has exactly one item, whose slug is hand-tools and whose parent_id is null.', async () => {
      const summary = body.map((item) => ({ slug: item.slug, parent_id: item.parent_id }));
      expect(summary, assertMessage({ request, expected: `Exactly one item: slug "${slug}", parent_id null`, actual: body })).toEqual([{ slug, parent_id: null }]);
    });

    await test.step("Verify the item's sub_categories is non-empty, includes the slug hammer, and every sub-category's parent_id equals the item's id.", async () => {
      const item = body[0]!;
      expect(
        item.sub_categories.length,
        assertMessage({ request, expected: 'sub_categories is non-empty', actual: item.sub_categories })
      ).toBeGreaterThan(0);
      expectSlugsInclude(request, item.sub_categories, [TestConstants.categories.hammer]);
      expectSubCategoriesOf(request, item);
    });
  });

  test("API-0180: Category tree filtered by a sub-category's slug returns an empty array", async ({ categoriesClient }) => {
    let request: TreeRequestInfo;
    let response: ApiResponse;

    await test.step('Send GET /categories/tree with by_category_slug=hammer.', async () => {
      ({ request, response } = await sendTree(categoriesClient, TestConstants.categories.hammer));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the body is an empty array.', async () => {
      expectEmptyArray(request, response);
    });
  });

  test('API-0181: Category tree filtered by an unknown slug returns an empty array', async ({ categoriesClient }) => {
    let request: TreeRequestInfo;
    let response: ApiResponse;

    await test.step('Send GET /categories/tree with by_category_slug set to a unique slug that no category has.', async () => {
      ({ request, response } = await sendTree(categoriesClient, CategoryFactory.slug()));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the body is an empty array.', async () => {
      expectEmptyArray(request, response);
    });
  });

  test('API-0182: Category tree with by_category_slug as an array returns 422', async ({ categoriesClient }) => {
    test.fail(true, 'Known issue BUG-016: Returns 500 instead of 422 when by_category_slug is sent as an array.');
    let request: TreeRequestInfo;
    let response: ApiResponse;

    await test.step('Send GET /categories/tree with by_category_slug as an array (by_category_slug[]=x).', async () => {
      ({ request, response } = await sendTree(categoriesClient, ['x']));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });
  });
});
