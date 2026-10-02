import { test, expect } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { ProductDetails } from '@api/dto/product';
import { TestConstants } from '@data/TestConstants';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/products/get-products-by-product-id.yml
test.describe('@products-api - Products API', () => {
  test('API-0020: Get product returns the product with its category, brand, image and specs', async ({
    productsService,
    productsClient,
  }) => {
    let productId: string;
    let productName: string;
    let request: { method: string; path: string };
    let response: ApiResponse;
    let body: ProductDetails;

    await test.step("Send GET /products and take the first item's id and name.", async () => {
      const list = await productsService.list();
      await attachJson('List Products Response', list);
      expect(list.data.length, assertMessage({ request: { method: 'GET', path: '/products' }, expected: 'At least one product', actual: list.total })).toBeGreaterThan(0);
      productId = list.data[0]!.id;
      productName = list.data[0]!.name;
    });

    await test.step('Send GET /products/{productId} with that id.', async () => {
      request = { method: 'GET', path: `/products/${productId}` };
      response = await productsClient.getById(productId);
      await attachJson('Get Product Request', request);
      await attachJson('Get Product Response', { status: response.status, body: response.body });
    });

    await test.step('Verify the response status is 200.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 200', actual: response.status })).toBe(200);
      body = JSON.parse(response.body) as ProductDetails;
    });

    await test.step("Verify the body's id equals that id and its name equals that name.", async () => {
      expect(body.id, assertMessage({ request, expected: `id equals ${productId}`, actual: body.id })).toBe(productId);
      expect(body.name, assertMessage({ request, expected: `name equals "${productName}"`, actual: body.name })).toBe(productName);
    });

    await test.step('Verify the body has description, price, is_location_offer, is_rental, co2_rating, in_stock, is_eco_friendly, product_image, and a brand with id and name.', async () => {
      const fields = ['description', 'price', 'is_location_offer', 'is_rental', 'co2_rating', 'in_stock', 'is_eco_friendly', 'product_image', 'brand'] as const;
      for (const field of fields) {
        expect(field in body, assertMessage({ request, expected: `Body has "${field}"`, actual: Object.keys(body) })).toBe(true);
      }
      for (const field of ['id', 'name'] as const) {
        expect(body.brand?.[field], assertMessage({ request, expected: `brand has "${field}"`, actual: body.brand })).toBeDefined();
      }
    });

    await test.step('Verify the category has id, name, slug and parent_id.', async () => {
      for (const field of ['id', 'name', 'slug', 'parent_id'] as const) {
        expect(
          body.category !== null && typeof body.category === 'object' && field in body.category,
          assertMessage({ request, expected: `category has "${field}"`, actual: body.category })
        ).toBe(true);
      }
    });

    await test.step('Verify specs is an array and every spec has id, product_id, spec_name, spec_value and spec_unit.', async () => {
      expect(Array.isArray(body.specs), assertMessage({ request, expected: 'specs is an array', actual: body.specs })).toBe(true);
      for (const spec of body.specs) {
        for (const field of ['id', 'product_id', 'spec_name', 'spec_value', 'spec_unit'] as const) {
          expect(field in spec, assertMessage({ request, expected: `spec has "${field}"`, actual: spec })).toBe(true);
        }
      }
    });

    await test.step('Verify in_stock is a boolean.', async () => {
      expect(typeof body.in_stock, assertMessage({ request, expected: 'in_stock is a boolean', actual: body.in_stock })).toBe('boolean');
    });
  });

  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0021: Get product with an admin token returns the stock count', async ({ productsService, productsClientWithToken }) => {
      let productId: string;
      let request: { method: string; path: string; auth: string };
      let response: ApiResponse;

      await test.step("Send GET /products and take the first item's id.", async () => {
        const list = await productsService.list();
        await attachJson('List Products Response', list);
        expect(list.data.length, assertMessage({ request: { method: 'GET', path: '/products' }, expected: 'At least one product', actual: list.total })).toBeGreaterThan(0);
        productId = list.data[0]!.id;
      });

      await test.step("Send GET /products/{productId} with that id, with the admin's token.", async () => {
        request = { method: 'GET', path: `/products/${productId}`, auth: "admin's token" };
        response = await productsClientWithToken.getById(productId);
        await attachJson('Get Product Request', request);
        await attachJson('Get Product Response', { status: response.status, body: response.body });
      });

      await test.step('Verify the response status is 200.', async () => {
        expect(response.status, assertMessage({ request, expected: 'Status 200', actual: response.status })).toBe(200);
      });

      await test.step('Verify in_stock is a number.', async () => {
        const body = JSON.parse(response.body) as ProductDetails;
        expect(typeof body.in_stock, assertMessage({ request, expected: 'in_stock is a number (the stock count)', actual: body.in_stock })).toBe('number');
      });
    });
  });

  test('API-0022: Get product with an unknown id returns 404', async ({ productsClient }) => {
    const unknownId = TestConstants.products.unknownId;
    const request = { method: 'GET', path: `/products/${unknownId}` };
    let response: ApiResponse;

    await test.step('Send GET /products/{productId} with a well-formed ULID that no product has.', async () => {
      response = await productsClient.getById(unknownId);
      await attachJson('Get Product Request', request);
      await attachJson('Get Product Response', { status: response.status, body: response.body });
    });

    await test.step('Verify the response status is 404.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 404', actual: response.status })).toBe(404);
    });

    await test.step('Verify the body\'s message is "Requested item not found".', async () => {
      const body = JSON.parse(response.body) as { message?: string };
      expect(body.message, assertMessage({ request, expected: 'message is "Requested item not found"', actual: body })).toBe('Requested item not found');
    });
  });
});
