import { test, expect } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { ProductsClient } from '@api/clients/ProductsClient';
import type { Paginated } from '@api/dto/common';
import type { Product, ProductListQuery } from '@api/dto/product';
import { TestConstants } from '@data/TestConstants';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/products/get-products.yml

type ListRequest = { method: 'GET'; path: '/products'; query?: ProductListQuery };

const LIST_REQUEST: ListRequest = { method: 'GET', path: '/products' };

/** Sends GET /products with the query and attaches the request and the response. */
async function sendList(productsClient: ProductsClient, query?: ProductListQuery): Promise<{ request: ListRequest; response: ApiResponse }> {
  const request: ListRequest = { method: 'GET', path: '/products', ...(query ? { query } : {}) };
  const response = await productsClient.list(query);
  await attachJson('List Products Request', request);
  await attachJson('List Products Response', { status: response.status, body: response.body });
  return { request, response };
}

/** The checks of a "Verify the response status is 200." step; returns the parsed body. */
function expectListOk(request: ListRequest, response: ApiResponse): Paginated<Product> {
  expect(response.status, assertMessage({ request, expected: 'Status 200', actual: response.status })).toBe(200);
  return JSON.parse(response.body) as Paginated<Product>;
}

const isEcoRating = (rating: string | null | undefined): boolean => ['A', 'B'].includes((rating ?? '').toUpperCase());

test.describe('@products-api - Products API', () => {
  test('API-0002: List products returns the first page of non-rental products', async ({ productsClient }) => {
    let request: ListRequest;
    let response: ApiResponse;
    let body: Paginated<Product>;

    await test.step('Send GET /products without query parameters.', async () => {
      ({ request, response } = await sendList(productsClient));
    });

    await test.step('Verify the response status is 200.', async () => {
      body = expectListOk(request, response);
    });

    await test.step('Verify the body has current_page, data, from, last_page, per_page, to and total.', async () => {
      for (const field of ['current_page', 'data', 'from', 'last_page', 'per_page', 'to', 'total'] as const) {
        expect(field in body, assertMessage({ request, expected: `Body has "${field}"`, actual: Object.keys(body) })).toBe(true);
      }
    });

    await test.step('Verify current_page is 1 and per_page is 9.', async () => {
      expect(body.current_page, assertMessage({ request, expected: 'current_page is 1', actual: body.current_page })).toBe(1);
      expect(body.per_page, assertMessage({ request, expected: 'per_page is 9', actual: body.per_page })).toBe(9);
    });

    await test.step('Verify data has at most 9 items.', async () => {
      expect(body.data.length, assertMessage({ request, expected: 'At most 9 items', actual: body.data.length })).toBeLessThanOrEqual(9);
    });

    await test.step('Verify each item has id, name, description, price, is_location_offer, is_rental, co2_rating, in_stock, is_eco_friendly, product_image, a category with id, name and slug, and a brand with id and name.', async () => {
      const fields = ['id', 'name', 'description', 'price', 'is_location_offer', 'is_rental', 'co2_rating', 'in_stock', 'is_eco_friendly', 'product_image', 'category', 'brand'] as const;
      for (const item of body.data) {
        for (const field of fields) {
          expect(field in item, assertMessage({ request, expected: `Item ${item.id} has "${field}"`, actual: Object.keys(item) })).toBe(true);
        }
        for (const field of ['id', 'name', 'slug'] as const) {
          expect(
            item.category !== null && typeof item.category === 'object' && field in item.category,
            assertMessage({ request, expected: `Item ${item.id}: category has "${field}"`, actual: item.category })
          ).toBe(true);
        }
        for (const field of ['id', 'name'] as const) {
          expect(
            item.brand !== null && typeof item.brand === 'object' && field in item.brand,
            assertMessage({ request, expected: `Item ${item.id}: brand has "${field}"`, actual: item.brand })
          ).toBe(true);
        }
      }
    });

    await test.step("Verify every item's is_rental is false.", async () => {
      for (const item of body.data) {
        expect(item.is_rental, assertMessage({ request, expected: `Item ${item.id}: is_rental is false`, actual: item.is_rental })).toBe(false);
      }
    });

    await test.step("Verify every item's in_stock is a boolean.", async () => {
      for (const item of body.data) {
        expect(typeof item.in_stock, assertMessage({ request, expected: `Item ${item.id}: in_stock is a boolean`, actual: item.in_stock })).toBe('boolean');
      }
    });

    await test.step("Verify every item's is_eco_friendly is true exactly when its co2_rating is A or B.", async () => {
      for (const item of body.data) {
        const actual = { id: item.id, co2_rating: item.co2_rating, is_eco_friendly: item.is_eco_friendly };
        expect(
          item.is_eco_friendly,
          assertMessage({ request, expected: 'is_eco_friendly is true exactly when co2_rating is A or B (case-insensitive)', actual })
        ).toBe(isEcoRating(item.co2_rating));
      }
    });
  });

  test("API-0003: Filter by brand returns only that brand's products", async ({ productsService, productsClient }) => {
    let brandId: string;
    let request: ListRequest;
    let response: ApiResponse;
    let body: Paginated<Product>;

    await test.step('Send GET /products and take the brand id of the first item.', async () => {
      const list = await productsService.list();
      await attachJson('List Products Response', list);
      expect(list.data.length, assertMessage({ request: LIST_REQUEST, expected: 'At least one product', actual: list.total })).toBeGreaterThan(0);
      brandId = list.data[0]!.brand?.id;
      expect(brandId, assertMessage({ request: LIST_REQUEST, expected: 'The first product has a brand id', actual: list.data[0] })).toBeTruthy();
    });

    await test.step('Send GET /products with by_brand set to that brand id.', async () => {
      ({ request, response } = await sendList(productsClient, { by_brand: brandId }));
    });

    await test.step('Verify the response status is 200.', async () => {
      body = expectListOk(request, response);
    });

    await test.step("Verify data is not empty and every item's brand id equals that brand id.", async () => {
      expect(body.data.length, assertMessage({ request, expected: 'data is not empty', actual: body.total })).toBeGreaterThan(0);
      for (const item of body.data) {
        expect(item.brand?.id, assertMessage({ request, expected: `Item ${item.id}: brand id is ${brandId}`, actual: item.brand })).toBe(brandId);
      }
    });
  });

  test("API-0004: Filter by category returns only that category's products", async ({ productsService, productsClient }) => {
    let categoryId: string;
    let request: ListRequest;
    let response: ApiResponse;
    let body: Paginated<Product>;

    await test.step('Send GET /products and take the category id of the first item.', async () => {
      const list = await productsService.list();
      await attachJson('List Products Response', list);
      expect(list.data.length, assertMessage({ request: LIST_REQUEST, expected: 'At least one product', actual: list.total })).toBeGreaterThan(0);
      categoryId = list.data[0]!.category?.id;
      expect(categoryId, assertMessage({ request: LIST_REQUEST, expected: 'The first product has a category id', actual: list.data[0] })).toBeTruthy();
    });

    await test.step('Send GET /products with by_category set to that category id.', async () => {
      ({ request, response } = await sendList(productsClient, { by_category: categoryId }));
    });

    await test.step('Verify the response status is 200.', async () => {
      body = expectListOk(request, response);
    });

    await test.step("Verify data is not empty and every item's category id equals that category id.", async () => {
      expect(body.data.length, assertMessage({ request, expected: 'data is not empty', actual: body.total })).toBeGreaterThan(0);
      for (const item of body.data) {
        expect(item.category?.id, assertMessage({ request, expected: `Item ${item.id}: category id is ${categoryId}`, actual: item.category })).toBe(categoryId);
      }
    });
  });

  test('API-0005: Filter by category slug returns the category and its direct sub-categories', async ({ productsService, productsClient }) => {
    let categoryId: string;
    let categorySlug: string;
    let request: ListRequest;
    let response: ApiResponse;
    let body: Paginated<Product>;

    await test.step("Send GET /products and take the first item's category id and slug.", async () => {
      const list = await productsService.list();
      await attachJson('List Products Response', list);
      expect(list.data.length, assertMessage({ request: LIST_REQUEST, expected: 'At least one product', actual: list.total })).toBeGreaterThan(0);
      categoryId = list.data[0]!.category?.id;
      categorySlug = list.data[0]!.category?.slug;
      expect(
        Boolean(categoryId && categorySlug),
        assertMessage({ request: LIST_REQUEST, expected: 'The first product has a category id and slug', actual: list.data[0]!.category })
      ).toBe(true);
    });

    await test.step('Send GET /products with by_category_slug set to that slug.', async () => {
      ({ request, response } = await sendList(productsClient, { by_category_slug: categorySlug }));
    });

    await test.step('Verify the response status is 200.', async () => {
      body = expectListOk(request, response);
    });

    await test.step('Verify data is not empty.', async () => {
      expect(body.data.length, assertMessage({ request, expected: 'data is not empty', actual: body.total })).toBeGreaterThan(0);
    });

    await test.step(
      "Verify every item's category is that category or a direct sub-category of it: its category id equals that category id, or GET /products/{productId} for the item returns a category parent_id equal to that category id.",
      async () => {
        for (const item of body.data) {
          if (item.category?.id === categoryId) continue;
          const details = await productsService.getById(item.id);
          await attachJson(`Get Product ${item.id} Response`, details);
          expect(
            details.category?.parent_id,
            assertMessage({
              request: { method: 'GET', path: `/products/${item.id}` },
              expected: `Item ${item.id}: category id is ${categoryId}, or its category's parent_id is ${categoryId}`,
              actual: details.category,
            })
          ).toBe(categoryId);
        }
      }
    );
  });

  test('API-0006: Rental filter returns only rental products', async ({ productsClient }) => {
    let request: ListRequest;
    let response: ApiResponse;
    let body: Paginated<Product>;

    await test.step('Send GET /products with is_rental=true.', async () => {
      ({ request, response } = await sendList(productsClient, { is_rental: 'true' }));
    });

    await test.step('Verify the response status is 200.', async () => {
      body = expectListOk(request, response);
    });

    await test.step("Verify every item's is_rental is true.", async () => {
      for (const item of body.data) {
        expect(item.is_rental, assertMessage({ request, expected: `Item ${item.id}: is_rental is true`, actual: item.is_rental })).toBe(true);
      }
    });
  });

  test('API-0007: Price range filter returns only products in the range', async ({ productsClient }) => {
    let request: ListRequest;
    let response: ApiResponse;
    let body: Paginated<Product>;

    await test.step('Send GET /products with between=price,10,30.', async () => {
      ({ request, response } = await sendList(productsClient, { between: 'price,10,30' }));
    });

    await test.step('Verify the response status is 200.', async () => {
      body = expectListOk(request, response);
    });

    await test.step("Verify every item's price is at least 10 and at most 30.", async () => {
      for (const item of body.data) {
        const actual = { id: item.id, price: item.price };
        expect(item.price, assertMessage({ request, expected: 'price is at least 10', actual })).toBeGreaterThanOrEqual(10);
        expect(item.price, assertMessage({ request, expected: 'price is at most 30', actual })).toBeLessThanOrEqual(30);
      }
    });
  });

  test('API-0008: Sort by price descending orders the products by price', async ({ productsClient }) => {
    let request: ListRequest;
    let response: ApiResponse;
    let body: Paginated<Product>;

    await test.step('Send GET /products with sort=price,desc.', async () => {
      ({ request, response } = await sendList(productsClient, { sort: 'price,desc' }));
    });

    await test.step('Verify the response status is 200.', async () => {
      body = expectListOk(request, response);
    });

    await test.step("Verify the items' prices are in descending order.", async () => {
      const prices = body.data.map((item) => item.price);
      const sorted = [...prices].sort((a, b) => b - a);
      expect(prices, assertMessage({ request, expected: `Prices in descending order: ${JSON.stringify(sorted)}`, actual: prices })).toEqual(sorted);
    });
  });

  test('API-0009: Eco-friendly filter returns only products rated A or B', async ({ productsClient }) => {
    let request: ListRequest;
    let response: ApiResponse;
    let body: Paginated<Product>;

    await test.step('Send GET /products with eco_friendly=true.', async () => {
      ({ request, response } = await sendList(productsClient, { eco_friendly: 'true' }));
    });

    await test.step('Verify the response status is 200.', async () => {
      body = expectListOk(request, response);
    });

    await test.step("Verify every item's co2_rating is A or B (case-insensitive) and its is_eco_friendly is true.", async () => {
      for (const item of body.data) {
        const actual = { id: item.id, co2_rating: item.co2_rating, is_eco_friendly: item.is_eco_friendly };
        expect(isEcoRating(item.co2_rating), assertMessage({ request, expected: 'co2_rating is A or B (case-insensitive)', actual })).toBe(true);
        expect(item.is_eco_friendly, assertMessage({ request, expected: 'is_eco_friendly is true', actual })).toBe(true);
      }
    });
  });

  test('API-0010: Name filter returns only products whose name contains the text', async ({ productsClient }) => {
    const term = TestConstants.products.searchTerm;
    let request: ListRequest;
    let response: ApiResponse;
    let body: Paginated<Product>;

    await test.step('Send GET /products with q=pliers.', async () => {
      ({ request, response } = await sendList(productsClient, { q: term }));
    });

    await test.step('Verify the response status is 200.', async () => {
      body = expectListOk(request, response);
    });

    await test.step('Verify data is not empty and every item\'s name contains "pliers" (case-insensitive).', async () => {
      expect(body.data.length, assertMessage({ request, expected: 'data is not empty', actual: body.total })).toBeGreaterThan(0);
      for (const item of body.data) {
        expect(item.name.toLowerCase(), assertMessage({ request, expected: `Name contains "${term}" (case-insensitive)`, actual: item.name })).toContain(term.toLowerCase());
      }
    });
  });

  test('API-0011: Spec filter returns only products with that spec value', async ({ productsService, productsClient }) => {
    let specName = '';
    let specValue = '';
    let request: ListRequest;
    let response: ApiResponse;
    let body: Paginated<Product>;

    await test.step(
      "Find a product with at least one spec: send GET /products/{productId} for the items of GET /products until one returns a non-empty specs array, and take its first spec's spec_name and spec_value.",
      async () => {
        const list = await productsService.list();
        await attachJson('List Products Response', list);
        const checked: string[] = [];
        for (const item of list.data) {
          const details = await productsService.getById(item.id);
          checked.push(item.id);
          if (details.specs?.length) {
            await attachJson('Get Product Response', details);
            specName = details.specs[0]!.spec_name;
            specValue = details.specs[0]!.spec_value;
            break;
          }
        }
        expect(
          Boolean(specName),
          assertMessage({ request: LIST_REQUEST, expected: 'A product on page 1 of GET /products has at least one spec', actual: { productsChecked: checked, withSpecs: 0 } })
        ).toBe(true);
      }
    );

    await test.step('Send GET /products with by_spec=<spec_name>:<spec_value>.', async () => {
      ({ request, response } = await sendList(productsClient, { by_spec: `${specName}:${specValue}` }));
    });

    await test.step('Verify the response status is 200.', async () => {
      body = expectListOk(request, response);
    });

    await test.step('Verify data is not empty.', async () => {
      expect(body.data.length, assertMessage({ request, expected: 'data is not empty', actual: body.total })).toBeGreaterThan(0);
    });

    await test.step("Verify every item's specs, from GET /products/{productId} for the item, include a spec with that spec_name and spec_value.", async () => {
      for (const item of body.data) {
        const details = await productsService.getById(item.id);
        await attachJson(`Get Product ${item.id} Response`, details);
        const specs = (details.specs ?? []).map((spec) => ({ spec_name: spec.spec_name, spec_value: spec.spec_value }));
        expect(
          specs.some((spec) => spec.spec_name === specName && spec.spec_value === specValue),
          assertMessage({
            request: { method: 'GET', path: `/products/${item.id}` },
            expected: `Item ${item.id} has the spec ${specName}: ${specValue}`,
            actual: specs,
          })
        ).toBe(true);
      }
    });
  });

  test('API-0012: Page 2 returns the next products', async ({ productsService, productsClient }) => {
    let pageOneIds: string[] = [];
    let request: ListRequest;
    let response: ApiResponse;
    let body: Paginated<Product>;

    await test.step('Send GET /products and keep the item ids of page 1.', async () => {
      const list = await productsService.list();
      await attachJson('List Products Response', list);
      pageOneIds = list.data.map((item) => item.id);
      expect(pageOneIds.length, assertMessage({ request: LIST_REQUEST, expected: 'Page 1 has items', actual: list.total })).toBeGreaterThan(0);
    });

    await test.step('Send GET /products with page=2.', async () => {
      ({ request, response } = await sendList(productsClient, { page: 2 }));
    });

    await test.step('Verify the response status is 200.', async () => {
      body = expectListOk(request, response);
    });

    await test.step('Verify current_page is 2.', async () => {
      expect(body.current_page, assertMessage({ request, expected: 'current_page is 2', actual: body.current_page })).toBe(2);
    });

    await test.step('Verify no item id on page 2 is among the page 1 ids.', async () => {
      const repeated = body.data.map((item) => item.id).filter((id) => pageOneIds.includes(id));
      expect(repeated, assertMessage({ request, expected: 'No page 2 id is on page 1', actual: { repeated, pageOneIds } })).toEqual([]);
    });
  });

  test('API-0013: Unknown category id returns an empty list', async ({ productsClient }) => {
    /** A well-formed ULID that no category has. */
    const unknownCategoryId = '01ZZZZZZZZZZZZZZZZZZZZZZZZ';
    let request: ListRequest;
    let response: ApiResponse;

    await test.step('Send GET /products with by_category set to a well-formed ULID that no category has.', async () => {
      ({ request, response } = await sendList(productsClient, { by_category: unknownCategoryId }));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectListOk(request, response);
    });

    await test.step('Verify data is an empty array.', async () => {
      const body = JSON.parse(response.body) as Paginated<Product>;
      expect(Array.isArray(body.data), assertMessage({ request, expected: 'data is an array', actual: body.data })).toBe(true);
      expect(body.data, assertMessage({ request, expected: 'data is empty', actual: body.data })).toEqual([]);
    });
  });

  test('API-0014: Unknown sort column is not a server error', async ({ productsClient }) => {
    test.fail(true, 'Known issue: Returns 500 instead of a client error (or ignoring the column) for an unknown sort column.');
    let request: ListRequest;
    let response: ApiResponse;

    await test.step('Send GET /products with sort=no_such_column,asc.', async () => {
      ({ request, response } = await sendList(productsClient, { sort: 'no_such_column,asc' }));
    });

    await test.step('Verify the response status is not 500.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status is not 500', actual: response.status })).not.toBe(500);
    });
  });
});
