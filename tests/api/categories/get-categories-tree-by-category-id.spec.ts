import { test, expect, createCategory, takeCategoryBySlug, expectSubCategoriesOf, PARENT_CREATE_STEP, CHILD_CREATE_STEP, sendAndAttach } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { CategoriesClient } from '@api/clients/CategoriesClient';
import type { CategoryTree } from '@api/dto/category';
import { TestConstants } from '@data/TestConstants';
import { expectMessage, expectStatus, parseJson } from '@utils/apiChecks';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/categories/get-categories-tree-by-category-id.yml

type GetCategoryRequestInfo = { method: 'GET'; path: string };

/** Sends GET /categories/tree/{categoryId} and attaches the request and the response. */
async function sendGetCategory(categoriesClient: CategoriesClient, categoryId: string): Promise<{ request: GetCategoryRequestInfo; response: ApiResponse }> {
  const request: GetCategoryRequestInfo = { method: 'GET', path: `/categories/tree/${categoryId}` };
  return sendAndAttach('Get Category', request, () => categoriesClient.getTreeById(categoryId));
}

test.describe('@categories-api - Categories API', () => {
  test('API-0187: Get top-level category returns 200 with its sub-categories', async ({ categoriesService, categoriesClient }) => {
    let request: GetCategoryRequestInfo;
    let response: ApiResponse;
    let body: CategoryTree;

    const listed = await takeCategoryBySlug(
      categoriesService,
      TestConstants.categories.handTools,
      'Send GET /categories and take the id, name and slug of the category whose slug is hand-tools.'
    );

    await test.step('Send GET /categories/tree/{categoryId} with that id.', async () => {
      ({ request, response } = await sendGetCategory(categoriesClient, listed.id));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
      body = parseJson<CategoryTree>(request, response);
    });

    await test.step("Verify the body's id, name and slug equal the list item's and its parent_id is null.", async () => {
      expect(
        { id: body.id, name: body.name, slug: body.slug, parent_id: body.parent_id },
        assertMessage({ request, expected: `The list item's id, name and slug, parent_id null: ${JSON.stringify(listed)}`, actual: body })
      ).toEqual({ id: listed.id, name: listed.name, slug: listed.slug, parent_id: null });
    });

    await test.step("Verify the body's sub_categories is non-empty and every sub-category's parent_id equals the body's id.", async () => {
      expect(body.sub_categories?.length, assertMessage({ request, expected: 'sub_categories is non-empty', actual: body.sub_categories })).toBeGreaterThan(0);
      expectSubCategoriesOf(request, body);
    });
  });

  test('API-0188: Get sub-category returns 200 with its parent_id and no sub-categories', async ({ categoriesService, categoriesClient }) => {
    let request: GetCategoryRequestInfo;
    let response: ApiResponse;
    let body: CategoryTree;

    const listed = await takeCategoryBySlug(
      categoriesService,
      TestConstants.categories.hammer,
      'Send GET /categories and take the id, name, slug and parent_id of the category whose slug is hammer.'
    );

    await test.step('Send GET /categories/tree/{categoryId} with that id.', async () => {
      ({ request, response } = await sendGetCategory(categoriesClient, listed.id));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
      body = parseJson<CategoryTree>(request, response);
    });

    await test.step("Verify the body's id, name, slug and parent_id equal the list item's.", async () => {
      expect(
        { id: body.id, name: body.name, slug: body.slug, parent_id: body.parent_id },
        assertMessage({ request, expected: `The list item's id, name, slug and parent_id: ${JSON.stringify(listed)}`, actual: body })
      ).toEqual({ id: listed.id, name: listed.name, slug: listed.slug, parent_id: listed.parent_id });
    });

    await test.step("Verify the body's sub_categories is an empty array.", async () => {
      expect(body.sub_categories, assertMessage({ request, expected: 'sub_categories is an empty array', actual: body.sub_categories })).toEqual([]);
    });
  });

  test('API-0189: Get category with an unknown id returns 404', async ({ categoriesClient }) => {
    let request: GetCategoryRequestInfo;
    let response: ApiResponse;

    await test.step('Send GET /categories/tree/{categoryId} with a well-formed ULID that no category has.', async () => {
      ({ request, response } = await sendGetCategory(categoriesClient, TestConstants.categories.unknownId));
    });

    await test.step('Verify the response status is 404.', async () => {
      expectStatus(request, response, 404);
    });

    await test.step('Verify the body\'s message is "Requested item not found".', async () => {
      expectMessage(request, response, 'Requested item not found');
    });
  });

  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0190: Get category lists a sub-category created after the category was read', async ({ adminCategoriesService, categoriesService, cleanup }) => {
      let after: CategoryTree;

      // Cleanup runs newest first: the sub-category is deleted before its parent.
      const parent = await createCategory(adminCategoriesService, cleanup, PARENT_CREATE_STEP);
      test.fail(true, 'Known issue BUG-020: Returns the cached category without a sub-category created after the category was first read.');

      await test.step("Send GET /categories/tree/{categoryId} with the parent's id.", async () => {
        const before = await categoriesService.getTreeById(parent.id);
        await attachJson('Get Category Request', { method: 'GET', path: `/categories/tree/${parent.id}` });
        await attachJson('Get Category Response', before);
      });

      const child = await createCategory(adminCategoriesService, cleanup, CHILD_CREATE_STEP, { parent_id: parent.id });

      await test.step("Send GET /categories/tree/{categoryId} with the parent's id.", async () => {
        after = await categoriesService.getTreeById(parent.id);
        await attachJson('Get Category Request', { method: 'GET', path: `/categories/tree/${parent.id}` });
        await attachJson('Get Category Response', after);
      });

      await test.step("Verify the body's sub_categories include the new category's id.", async () => {
        const ids = (after.sub_categories ?? []).map((sub) => sub.id);
        expect(
          ids.includes(child.id),
          assertMessage({ request: { method: 'GET', path: `/categories/tree/${parent.id}` }, expected: `sub_categories include ${child.id}`, actual: after })
        ).toBe(true);
      });
    });
  });
});
