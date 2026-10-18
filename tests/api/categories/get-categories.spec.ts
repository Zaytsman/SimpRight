import { test, expect, sendAndAttach } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { Category } from '@api/dto/category';
import { expectStatus, parseJson } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/categories/get-categories.yml

test.describe('@categories-api - Categories API', () => {
  test('API-0164: List categories returns every category as a flat list', async ({ categoriesClient }) => {
    const request = { method: 'GET', path: '/categories' };
    let response: ApiResponse;
    let body: Category[];

    await test.step('Send GET /categories.', async () => {
      ({ response } = await sendAndAttach('List Categories', request, () => categoriesClient.list()));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
      body = parseJson<Category[]>(request, response);
    });

    await test.step('Verify the body is a non-empty array.', async () => {
      expect(Array.isArray(body) && body.length > 0, assertMessage({ request, expected: 'The body is a non-empty array', actual: body })).toBe(true);
    });

    await test.step('Verify every item has a non-empty string id, name and slug, and a parent_id that is null or a string.', async () => {
      for (const item of body) {
        const ok =
          (['id', 'name', 'slug'] as const).every((key) => typeof item[key] === 'string' && item[key].length > 0) &&
          (item.parent_id === null || typeof item.parent_id === 'string');
        expect(ok, assertMessage({ request, expected: 'A non-empty string id, name and slug, and a parent_id that is null or a string', actual: item })).toBe(true);
      }
    });

    await test.step('Verify no item has a sub_categories key.', async () => {
      const withKey = body.filter((item) => 'sub_categories' in item);
      expect(withKey, assertMessage({ request, expected: 'No item has a sub_categories key', actual: withKey })).toEqual([]);
    });

    await test.step('Verify the body includes at least one item whose parent_id is null and at least one whose parent_id is a string.', async () => {
      const topLevel = body.some((item) => item.parent_id === null);
      const sub = body.some((item) => typeof item.parent_id === 'string');
      expect(
        { topLevel, sub },
        assertMessage({ request, expected: 'At least one item with a null parent_id and one with a string parent_id', actual: { topLevel, sub } })
      ).toEqual({ topLevel: true, sub: true });
    });
  });
});
