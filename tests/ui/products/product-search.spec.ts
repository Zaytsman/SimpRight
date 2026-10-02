import { expect, openHomePageTest as test } from '@fixtures';
import { TestConstants } from '@data/TestConstants';

// Scenarios: test-scenarios/ui/products/product-search.yml
test.describe('@products-ui - Product search', () => {
  test('UI-001: Search by name shows only matching products', async ({ homePage }) => {
    const term = TestConstants.products.searchTerm;
    await homePage.search(term);

    await expect(homePage.searchCaption).toHaveText(`Searched for: ${term}`);
    await expect(homePage.productGrid.cards.first()).toBeVisible();

    const names = await homePage.productGrid.getProductNames();
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(name.toLowerCase(), `"${name}" should match the search`).toContain(term);
    }
  });
});
