import { test, expect } from '@fixtures';
import { TestConstants } from '@data/TestConstants';

// Scenarios: test-scenarios/ui/products/product-search.yml
test.describe('@products - Product search', () => {
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

  test('UI-003: Search resets the active category and brand filters', async ({ homePage }) => {
    const category = 'Hammer';
    const brand = TestConstants.products.brand;
    const term = TestConstants.products.searchTerm;

    await test.step('Open the home page.', async () => {
      await homePage.open();
    });

    await test.step('Check the category "Hammer" in the sidebar.', async () => {
      await homePage.filters.checkCategory(category);
    });

    await test.step('Check the brand "ForgeFlex Tools" in the sidebar.', async () => {
      await homePage.filters.checkBrand(brand);
    });

    await test.step('Search for "pliers".', async () => {
      await homePage.search(term);
    });

    await test.step('Verify the category "Hammer" is not checked.', async () => {
      await expect(homePage.filters.categoryCheckbox(category), `The category "${category}" is unchecked`).not.toBeChecked();
    });

    await test.step('Verify the brand "ForgeFlex Tools" is not checked.', async () => {
      await expect(homePage.filters.brandCheckbox(brand), `The brand "${brand}" is unchecked`).not.toBeChecked();
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

  test('UI-004: Search with a 3-character term is accepted', async ({ homePage }) => {
    const term = 'ham';

    await test.step('Open the home page.', async () => {
      await homePage.open();
    });

    await test.step('Search for "ham".', async () => {
      await homePage.search(term);
    });

    await test.step('Verify the caption reads "Searched for: ham".', async () => {
      await expect(homePage.searchCaption, 'The caption names the search term').toHaveText(`Searched for: ${term}`);
    });

    await test.step('Verify at least one product is shown.', async () => {
      await expect(homePage.productGrid.cards.first(), 'At least one product card is shown').toBeVisible();
    });

    await test.step('Verify every product name contains "ham" (case-insensitive).', async () => {
      const names = await homePage.productGrid.getProductNames();
      for (const name of names) {
        expect(name.toLowerCase(), `Product "${name}" should contain "${term}"`).toContain(term);
      }
    });
  });

  test('UI-005: Search with a 40-character term is accepted', async ({ homePage }) => {
    const term = 'a'.repeat(40);

    await test.step('Open the home page.', async () => {
      await homePage.open();
    });

    await test.step('Search for a term of exactly 40 characters.', async () => {
      await homePage.search(term);
    });

    await test.step('Verify the caption reads "Searched for: " followed by the term.', async () => {
      await expect(homePage.searchCaption, 'The caption names the 40-character term').toHaveText(`Searched for: ${term}`);
    });
  });

  test('UI-006: Search with a 2-character term is rejected', async ({ homePage }) => {
    const term = 'pl';
    let firstPageNames: string[] = [];

    await test.step('Open the home page.', async () => {
      await homePage.open();
      firstPageNames = await homePage.productGrid.getProductNames();
    });

    await test.step('Search for "pl".', async () => {
      await homePage.submitSearch(term);
    });

    await test.step('Verify no "Searched for:" caption is shown.', async () => {
      await expect(homePage.searchCaption, 'No search caption is shown').toBeHidden();
    });

    // Approved reading: "the first page of all products" = the same names, in the same order, as right after
    // the home page loaded.
    await test.step('Verify the product grid still shows the first page of all products.', async () => {
      expect(firstPageNames.length, 'The home page showed products before the search').toBeGreaterThan(0);
      const names = await homePage.productGrid.getProductNames();
      expect(names, `The grid is unchanged: ${names.join(' | ')} (before: ${firstPageNames.join(' | ')})`).toEqual(firstPageNames);
    });
  });

  test('UI-007: Search with a 41-character term is rejected', async ({ homePage }) => {
    const term = 'a'.repeat(41);
    let firstPageNames: string[] = [];

    await test.step('Open the home page.', async () => {
      await homePage.open();
      firstPageNames = await homePage.productGrid.getProductNames();
    });

    await test.step('Search for a term of exactly 41 characters.', async () => {
      await homePage.submitSearch(term);
    });

    await test.step('Verify no "Searched for:" caption is shown.', async () => {
      await expect(homePage.searchCaption, 'No search caption is shown').toBeHidden();
    });

    // Approved reading: "the first page of all products" = the same names, in the same order, as right after
    // the home page loaded.
    await test.step('Verify the product grid still shows the first page of all products.', async () => {
      expect(firstPageNames.length, 'The home page showed products before the search').toBeGreaterThan(0);
      const names = await homePage.productGrid.getProductNames();
      expect(names, `The grid is unchanged: ${names.join(' | ')} (before: ${firstPageNames.join(' | ')})`).toEqual(firstPageNames);
    });
  });
});
