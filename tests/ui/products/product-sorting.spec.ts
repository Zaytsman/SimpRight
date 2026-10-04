import { test, expect } from '@fixtures';

// Scenarios: test-scenarios/ui/products/product-sorting.yml
// The user's approved reading of the Verify steps: names are compared case-insensitively, prices are the
// price shown on each card (the discounted one when there is one), and the checks cover the first page only.
const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

test.describe('@products - Product sorting', () => {
  test('UI-008: Sort by name from A to Z', async ({ homePage }) => {
    await test.step('Open the home page.', async () => {
      await homePage.open();
    });

    await test.step('Select "Name (A - Z)" in the sort list.', async () => {
      await homePage.sortBy('Name (A - Z)');
    });

    await test.step('Verify the product names are in alphabetical order, A to Z.', async () => {
      const names = await homePage.productGrid.getProductNames();
      expect(names.length, 'The first page shows products').toBeGreaterThan(0);
      expect(names, `The names are in A to Z order: ${names.join(' | ')}`).toEqual([...names].sort(byName));
    });
  });

  test('UI-009: Sort by name from Z to A', async ({ homePage }) => {
    await test.step('Open the home page.', async () => {
      await homePage.open();
    });

    await test.step('Select "Name (Z - A)" in the sort list.', async () => {
      await homePage.sortBy('Name (Z - A)');
    });

    await test.step('Verify the product names are in reverse alphabetical order, Z to A.', async () => {
      const names = await homePage.productGrid.getProductNames();
      expect(names.length, 'The first page shows products').toBeGreaterThan(0);
      expect(names, `The names are in Z to A order: ${names.join(' | ')}`).toEqual([...names].sort((a, b) => byName(b, a)));
    });
  });

  test('UI-010: Sort by price from high to low', async ({ homePage }) => {
    await test.step('Open the home page.', async () => {
      await homePage.open();
    });

    await test.step('Select "Price (High - Low)" in the sort list.', async () => {
      await homePage.sortBy('Price (High - Low)');
    });

    await test.step('Verify the products are sorted by price, highest first.', async () => {
      const prices = await homePage.productGrid.getPrices();
      expect(prices.length, 'The first page shows products').toBeGreaterThan(0);
      expect(prices, `The prices are highest first: ${prices.join(', ')}`).toEqual([...prices].sort((a, b) => b - a));
    });
  });

  test('UI-011: Sort by price from low to high', async ({ homePage }) => {
    await test.step('Open the home page.', async () => {
      await homePage.open();
    });

    await test.step('Select "Price (Low - High)" in the sort list.', async () => {
      await homePage.sortBy('Price (Low - High)');
    });

    await test.step('Verify the products are sorted by price, lowest first.', async () => {
      const prices = await homePage.productGrid.getPrices();
      expect(prices.length, 'The first page shows products').toBeGreaterThan(0);
      expect(prices, `The prices are lowest first: ${prices.join(', ')}`).toEqual([...prices].sort((a, b) => a - b));
    });
  });
});
