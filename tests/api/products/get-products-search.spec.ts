import { test, expect } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { Paginated } from '@api/dto/common';
import type { Product } from '@api/dto/product';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/products/get-products-search.yml
test.describe('@products-api - Products API', () => {
  test('API-PROD-001: Search by name returns only matching products', async ({ productsClient }) => {
    const term = 'pliers';
    const request = { method: 'GET', path: '/products/search', query: { q: term } };
    let response: ApiResponse;
    let body: Paginated<Product>;

    await test.step('Send GET /products/search with q=pliers.', async () => {
      response = await productsClient.search(term);
      await attachJson('Search Request', request);
      await attachJson('Search Response', { status: response.status, body: response.body });
    });

    await test.step('Verify the response status is 200 and the body is paginated (data, total, current_page).', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 200', actual: response.status })).toBe(200);
      body = JSON.parse(response.body) as Paginated<Product>;
      for (const field of ['data', 'total', 'current_page'] as const) {
        expect(body[field], assertMessage({ request, expected: `Paginated body with "${field}"`, actual: Object.keys(body) })).toBeDefined();
      }
    });

    await test.step('Verify total is greater than 0 and every item\'s name contains "pliers" (case-insensitive).', async () => {
      expect(body.total, assertMessage({ request, expected: 'At least one match (total > 0)', actual: body.total })).toBeGreaterThan(0);
      for (const product of body.data) {
        expect(
          product.name.toLowerCase(),
          assertMessage({ request, expected: `Product name should contain "${term}"`, actual: product.name })
        ).toContain(term);
      }
    });

    await test.step('Verify each item has an id, a name and a price greater than 0.', async () => {
      for (const product of body.data) {
        const actual = { id: product.id, name: product.name, price: product.price };
        expect(product.id, assertMessage({ request, expected: 'Product has an id', actual })).toBeTruthy();
        expect(product.name, assertMessage({ request, expected: 'Product has a name', actual })).toBeTruthy();
        expect(product.price, assertMessage({ request, expected: 'Product price > 0', actual })).toBeGreaterThan(0);
      }
    });
  });
});
