import { test, expect, createBrand, expectBrandItems, takeSeededBrandIds, expectIncludesBrandIds, sendAndAttach } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { BrandsClient } from '@api/clients/BrandsClient';
import type { Brand } from '@api/dto/brand';
import { TestConstants } from '@data/TestConstants';
import { BrandFactory } from '@data/factories/BrandFactory';
import { expectEmptyArray, expectItemNamesContain, expectStatus, parseJson } from '@utils/apiChecks';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/brands/get-brands-search.yml

type SearchRequest = { method: 'GET'; path: '/brands/search'; query: { q?: string | string[] } };

/** Sends GET /brands/search (no `q` when `q` is undefined) and attaches the request and the response. */
async function sendSearch(brandsClient: BrandsClient, q?: string | string[]): Promise<{ request: SearchRequest; response: ApiResponse }> {
  const request: SearchRequest = { method: 'GET', path: '/brands/search', query: q === undefined ? {} : { q } };
  return sendAndAttach('Search Brands', request, () => brandsClient.search(q));
}

test.describe('@brands-api - Brands API', () => {
  test('API-0154: Search brands returns only matching brands', async ({ brandsClient }) => {
    const term = TestConstants.brands.searchTerm;
    let request: SearchRequest;
    let response: ApiResponse;
    let body: Brand[];

    await test.step('Send GET /brands/search with q=forge.', async () => {
      ({ request, response } = await sendSearch(brandsClient, term));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
      body = parseJson<Brand[]>(request, response);
    });

    await test.step('Verify the body is a non-empty array and every item\'s name contains "forge" (case-insensitive).', async () => {
      expectItemNamesContain(request, body, term);
    });

    await test.step('Verify every item has a non-empty string id, name and slug.', async () => {
      expectBrandItems(request, body);
    });
  });

  test('API-0155: Search brands with a term shorter than 4 characters matches inside names', async ({ brandsClient }) => {
    const term = 'fle';
    let request: SearchRequest;
    let response: ApiResponse;

    await test.step('Send GET /brands/search with q=fle.', async () => {
      ({ request, response } = await sendSearch(brandsClient, term));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the body is a non-empty array and every item\'s name contains "fle" (case-insensitive).', async () => {
      expectItemNamesContain(request, JSON.parse(response.body), term);
    });
  });

  test('API-0156: Search brands with a term no brand matches returns an empty array', async ({ brandsClient }) => {
    const term = BrandFactory.searchTerm();
    let request: SearchRequest;
    let response: ApiResponse;

    await test.step('Send GET /brands/search with q set to a unique term of letters and digits only that no brand has.', async () => {
      ({ request, response } = await sendSearch(brandsClient, term));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the body is an empty array.', async () => {
      expectEmptyArray(request, response);
    });
  });

  test('API-0157: Search brands without a term returns the seeded brands', async ({ brandsService, brandsClient }) => {
    let request: SearchRequest;
    let response: ApiResponse;

    const seededIds = await takeSeededBrandIds(brandsService);

    await test.step('Send GET /brands/search without a q parameter.', async () => {
      ({ request, response } = await sendSearch(brandsClient));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the body includes both seeded brand ids.', async () => {
      expectIncludesBrandIds(request, JSON.parse(response.body), seededIds);
    });
  });

  test('API-0158: Search brands with q as an array returns 422', async ({ brandsClient }) => {
    test.fail(true, 'Known issue BUG-011: Returns 500 instead of 422 when q is sent as an array.');
    let request: SearchRequest;
    let response: ApiResponse;

    await test.step('Send GET /brands/search with q as an array (q[]=x).', async () => {
      ({ request, response } = await sendSearch(brandsClient, ['x']));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });
  });

  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0159: Search brands finds a brand created after the same term was searched', async ({ brandsService, adminBrandsService, cleanup }) => {
      test.fail(true, 'Known issue BUG-013: Returns the cached search result instead of the new brand for a term searched before the brand was created.');
      const term = BrandFactory.searchTerm();
      let brandId = '';
      let results: Brand[];

      await test.step('Send GET /brands/search with q set to a unique term of letters and digits only, at least 4 characters long, that no brand has.', async () => {
        const before = await brandsService.search(term);
        await attachJson('Search Brands Request', { method: 'GET', path: '/brands/search', query: { q: term } });
        await attachJson('Search Brands Response', before);
      });

      const brand = await createBrand(
        adminBrandsService,
        cleanup,
        "Send POST /brands with that term as the name and a unique slug, with the admin's token, and take the new brand's id.",
        { name: term }
      );
      brandId = brand.id;

      await test.step('Send GET /brands/search with the same term.', async () => {
        results = await brandsService.search(term);
        await attachJson('Search Brands Request', { method: 'GET', path: '/brands/search', query: { q: term } });
        await attachJson('Search Brands Response', results);
      });

      await test.step('Verify the body includes a brand with the new id.', async () => {
        expect(
          results.some((brand) => brand.id === brandId),
          assertMessage({ request: { method: 'GET', path: '/brands/search', query: { q: term } }, expected: `A brand with id ${brandId}`, actual: results })
        ).toBe(true);
      });
    });
  });
});
