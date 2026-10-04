import { test, expect } from '@fixtures';
import { TestConstants } from '@data/TestConstants';

// Scenarios: test-scenarios/ui/products/product-search.yml
test.describe('@products-ui - Product search', () => {
  test('UI-001: Search by name shows only matching products', async ({ homePage }) => {
    const term = TestConstants.products.searchTerm;

    await test.step('Open the home page.', async () => {
      await homePage.open();
    });

    await test.step('Search for "pliers".', async () => {
      await homePage.search(term);
    });

    await test.step('Verify the caption reads "Searched for: pliers".', async () => {
      await expect(homePage.searchCaption, 'The caption names the search term').toHaveText(`Searched for: ${term}`);
    });

    await test.step('Verify at least one product is shown.', async () => {
      await expect(homePage.productGrid.cards.first(), 'At least one product card is shown').toBeVisible();
    });

    await test.step('Verify every product name contains "pliers" (case-insensitive).', async () => {
      const names = await homePage.productGrid.getProductNames();
      for (const name of names) {
        expect(name.toLowerCase(), `Product "${name}" should contain "${term}"`).toContain(term);
      }
    });
  });
});
