import { test, expect } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { RelatedProduct } from '@api/dto/product';
import { TestConstants } from '@data/TestConstants';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/products/get-products-by-product-id-related.yml
test.describe('@products-api - Products API', () => {
  test('API-0023: Related products are other products from the same category', async ({ productsService, productsClient }) => {
    let productId: string;
    let categoryId: string;
    let request: { method: string; path: string };
    let response: ApiResponse;
    let body: RelatedProduct[];

    await test.step("Send GET /products and take the first item's id.", async () => {
      const list = await productsService.list();
      await attachJson('List Products Response', list);
      expect(list.data.length, assertMessage({ request: { method: 'GET', path: '/products' }, expected: 'At least one product', actual: list.total })).toBeGreaterThan(0);
      productId = list.data[0]!.id;
    });

    await test.step('Send GET /products/{productId} with that id and take its category id.', async () => {
      const product = await productsService.getById(productId);
      await attachJson('Get Product Response', product);
      expect(product.category?.id, assertMessage({ request: { method: 'GET', path: `/products/${productId}` }, expected: 'The product has a category id', actual: product.category })).toBeTruthy();
      categoryId = product.category.id;
    });

    await test.step('Send GET /products/{productId}/related with that id.', async () => {
      request = { method: 'GET', path: `/products/${productId}/related` };
      response = await productsClient.related(productId);
      await attachJson('Related Products Request', request);
      await attachJson('Related Products Response', { status: response.status, body: response.body });
    });

    await test.step('Verify the response status is 200.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 200', actual: response.status })).toBe(200);
      body = JSON.parse(response.body) as RelatedProduct[];
    });

    await test.step('Verify the body is an array with at most 10 items.', async () => {
      expect(Array.isArray(body), assertMessage({ request, expected: 'Body is an array', actual: typeof body })).toBe(true);
      expect(body.length, assertMessage({ request, expected: 'At most 10 items', actual: body.length })).toBeLessThanOrEqual(10);
    });

    await test.step("Verify no item has the requested product's id.", async () => {
      const ids = body.map((item) => item.id);
      expect(ids, assertMessage({ request, expected: `No item has id ${productId}`, actual: ids })).not.toContain(productId);
    });

    await test.step("Verify every item's category id equals the product's category id.", async () => {
      for (const item of body) {
        expect(item.category?.id, assertMessage({ request, expected: `Item ${item.id} has category id ${categoryId}`, actual: item.category })).toBe(categoryId);
      }
    });

    await test.step("Verify every item's category has id and name.", async () => {
      for (const item of body) {
        for (const field of ['id', 'name'] as const) {
          expect(
            item.category !== null && typeof item.category === 'object' && field in item.category,
            assertMessage({ request, expected: `Item ${item.id}'s category has "${field}"`, actual: item.category })
          ).toBe(true);
        }
      }
    });
  });

  test('API-0024: Related products for an unknown product id return 404', async ({ productsClient }) => {
    test.fail(true, 'Known issue: Returns 500 instead of 404 for an unknown product id.');
    const unknownId = TestConstants.products.unknownId;
    const request = { method: 'GET', path: `/products/${unknownId}/related` };
    let response: ApiResponse;

    await test.step('Send GET /products/{productId}/related with a well-formed ULID that no product has.', async () => {
      response = await productsClient.related(unknownId);
      await attachJson('Related Products Request', request);
      await attachJson('Related Products Response', { status: response.status, body: response.body });
    });

    await test.step('Verify the response status is 404.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 404', actual: response.status })).toBe(404);
    });
  });

  test('API-0025: Related products include their CO2 rating', async ({ productsService, productsClient }) => {
    test.fail(true, 'Known issue: Omits co2_rating from related products, so is_eco_friendly is always false.');
    let productId: string;
    let request: { method: string; path: string };
    let response: ApiResponse;

    await test.step("Send GET /products and take the first item's id.", async () => {
      const list = await productsService.list();
      await attachJson('List Products Response', list);
      expect(list.data.length, assertMessage({ request: { method: 'GET', path: '/products' }, expected: 'At least one product', actual: list.total })).toBeGreaterThan(0);
      productId = list.data[0]!.id;
    });

    await test.step('Send GET /products/{productId}/related with that id.', async () => {
      request = { method: 'GET', path: `/products/${productId}/related` };
      response = await productsClient.related(productId);
      await attachJson('Related Products Request', request);
      await attachJson('Related Products Response', { status: response.status, body: response.body });
      expect(response.isSuccess, assertMessage({ request, expected: 'A 2xx response to read the items from', actual: response.status })).toBe(true);
    });

    await test.step('Verify every item has a co2_rating field.', async () => {
      const body = JSON.parse(response.body) as Record<string, unknown>[];
      for (const item of body) {
        expect('co2_rating' in item, assertMessage({ request, expected: `Item ${String(item.id)} has a co2_rating field`, actual: Object.keys(item) })).toBe(true);
      }
    });
  });
});
