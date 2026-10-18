import { test, expect, createCategory, expectSlugsInclude, sendAndAttach } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { CategoriesClient } from '@api/clients/CategoriesClient';
import type { CategoryTree } from '@api/dto/category';
import { TestConstants } from '@data/TestConstants';
import { CategoryFactory } from '@data/factories/CategoryFactory';
import { expectEmptyArray, expectItemNamesContain, expectStatus, parseJson } from '@utils/apiChecks';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/categories/get-categories-search.yml

type SearchRequestInfo = { method: 'GET'; path: '/categories/search'; query: { q?: string | string[] } };

/** Sends GET /categories/search (no `q` when `q` is undefined) and attaches the request and the response. */
async function sendSearch(categoriesClient: CategoriesClient, q?: string | string[]): Promise<{ request: SearchRequestInfo; response: ApiResponse }> {
  const request: SearchRequestInfo = { method: 'GET', path: '/categories/search', query: q === undefined ? {} : { q } };
  return sendAndAttach('Search Categories', request, () => categoriesClient.search(q));
}

test.describe('@categories-api - Categories API', () => {
  test('API-0191: Search categories returns only matching categories', async ({ categoriesClient }) => {
    const term = 'hand';
    let request: SearchRequestInfo;
    let response: ApiResponse;
    let body: CategoryTree[];

    await test.step('Send GET /categories/search with q=hand.', async () => {
      ({ request, response } = await sendSearch(categoriesClient, term));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
      body = parseJson<CategoryTree[]>(request, response);
    });

    await test.step('Verify the body is a non-empty array and every item\'s name contains "hand" (case-insensitive).', async () => {
      expectItemNamesContain(request, body, term);
    });

    await test.step("Verify the body's slugs include hand-tools and hand-saw.", async () => {
      expectSlugsInclude(request, body, [TestConstants.categories.handTools, TestConstants.categories.handSaw]);
    });

    await test.step('Verify the item whose slug is hand-tools has a non-empty sub_categories.', async () => {
      const item = body.find((category) => category.slug === TestConstants.categories.handTools);
      expect(
        Array.isArray(item?.sub_categories) && item.sub_categories.length > 0,
        assertMessage({ request, expected: 'hand-tools has a non-empty sub_categories', actual: item })
      ).toBe(true);
    });
  });

  test('API-0192: Search categories with a term shorter than 4 characters matches inside names', async ({ categoriesClient }) => {
    const { term, slugs } = TestConstants.categories.shortSearch;
    let request: SearchRequestInfo;
    let response: ApiResponse;

    await test.step('Send GET /categories/search with q=saw.', async () => {
      ({ request, response } = await sendSearch(categoriesClient, term));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the body is a non-empty array and every item\'s name contains "saw" (case-insensitive).', async () => {
      expectItemNamesContain(request, JSON.parse(response.body), term);
    });

    await test.step("Verify the body's slugs include hand-saw and saw.", async () => {
      expectSlugsInclude(request, JSON.parse(response.body), slugs);
    });
  });

  test('API-0193: Search categories with a term no category matches returns an empty array', async ({ categoriesClient }) => {
    let request: SearchRequestInfo;
    let response: ApiResponse;

    await test.step('Send GET /categories/search with q set to a unique term of letters and digits only that no category has.', async () => {
      ({ request, response } = await sendSearch(categoriesClient, CategoryFactory.searchTerm()));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the body is an empty array.', async () => {
      expectEmptyArray(request, response);
    });
  });

  test('API-0194: Search categories without a term returns the seeded categories', async ({ categoriesClient }) => {
    let request: SearchRequestInfo;
    let response: ApiResponse;

    await test.step('Send GET /categories/search without a q parameter.', async () => {
      ({ request, response } = await sendSearch(categoriesClient));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's slugs include hand-tools, hammer and saw.", async () => {
      expectSlugsInclude(request, JSON.parse(response.body), TestConstants.categories.searchSeededSlugs);
    });
  });

  test('API-0195: Search categories with q as an array returns 422', async ({ categoriesClient }) => {
    test.fail(true, 'Known issue BUG-017: Returns 500 instead of 422 when q is sent as an array.');
    let request: SearchRequestInfo;
    let response: ApiResponse;

    await test.step('Send GET /categories/search with q as an array (q[]=x).', async () => {
      ({ request, response } = await sendSearch(categoriesClient, ['x']));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });
  });

  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0196: Search categories finds a category created after the same term was searched', async ({
      categoriesService,
      adminCategoriesService,
      cleanup,
    }) => {
      test.fail(true, 'Known issue BUG-020: Returns the cached search result instead of the new category for a term searched before the category was created.');
      const term = CategoryFactory.searchTerm();
      let results: CategoryTree[];

      await test.step(
        'Send GET /categories/search with q set to a unique term of letters and digits only, at least 4 characters long, that no category has.',
        async () => {
          const before = await categoriesService.search(term);
          await attachJson('Search Categories Request', { method: 'GET', path: '/categories/search', query: { q: term } });
          await attachJson('Search Categories Response', before);
        }
      );

      const category = await createCategory(
        adminCategoriesService,
        cleanup,
        "Send POST /categories with that term as the name and a unique slug, with the admin's token, and take the new category's id.",
        { name: term }
      );

      await test.step('Send GET /categories/search with the same term.', async () => {
        results = await categoriesService.search(term);
        await attachJson('Search Categories Request', { method: 'GET', path: '/categories/search', query: { q: term } });
        await attachJson('Search Categories Response', results);
      });

      await test.step('Verify the body includes a category with the new id.', async () => {
        expect(
          results.some((item) => item.id === category.id),
          assertMessage({ request: { method: 'GET', path: '/categories/search', query: { q: term } }, expected: `A category with id ${category.id}`, actual: results })
        ).toBe(true);
      });
    });
  });
});
