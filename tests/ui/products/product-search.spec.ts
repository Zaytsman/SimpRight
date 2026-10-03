import { expect, openHomePageTest as test } from '@fixtures';
import { TestConstants } from '@data/TestConstants';

// Scenarios: test-scenarios/ui/products/product-search.yml
test.describe('@products-ui - Product search', () => {
  // Skipped for now (2026-10-03): the shared default test user is locked (423) on the demo site, so the
  // login fails before the test starts. Re-enable (test.fixme -> test) when it unlocks or with an own account.
  test.fixme('UI-001: Search by name shows only matching products', async ({ homePage }) => {
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
