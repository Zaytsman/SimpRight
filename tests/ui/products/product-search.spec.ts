import { expect, openHomePageTest as test } from '@fixtures';

// Scenarios: test-scenarios/ui/products/product-search.yml
test.describe('Product search', () => {
  test('UI-PROD-001: search by name shows only matching products', async ({ homePage }) => {
    await homePage.search('pliers');

    await expect(homePage.searchCaption).toHaveText('Searched for: pliers');
    await expect(homePage.productGrid.cards.first()).toBeVisible();

    const names = await homePage.productGrid.getProductNames();
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(name.toLowerCase(), `"${name}" should match the search`).toContain('pliers');
    }
  });
});
