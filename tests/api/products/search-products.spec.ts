import { test, expect } from '@fixtures';

// Scenarios: test-scenarios/api/products.md
test.describe('Products API', () => {
  test('API-PROD-001: search by name returns only matching products', async ({ productsService }) => {
    const result = await productsService.search('pliers');

    expect(result.total).toBeGreaterThan(0);
    expect(result.data.length).toBeGreaterThan(0);
    for (const product of result.data) {
      expect(product.name.toLowerCase(), `"${product.name}" should match the search`).toContain('pliers');
      expect(product.id).toBeTruthy();
      expect(product.price).toBeGreaterThan(0);
    }
  });
});
