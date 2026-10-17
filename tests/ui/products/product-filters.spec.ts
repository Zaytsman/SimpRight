// Every scenario here has the precondition "The home page is open.": the fixture opens it before the steps.
import { openHomePageTest as test, expect, catalogueProductNames } from '@fixtures';
import { TestConstants } from '@data/TestConstants';

// Scenarios: test-scenarios/ui/products/product-filters.yml
test.describe('@products - Product filters', () => {
  test("UI-075: Checking a category shows only that category's products", async ({
    homePage,
    productsService,
    categoriesService,
    brandsService,
  }) => {
    const category = TestConstants.categories.labels.pliers;

    await test.step('Check the category "Pliers" in the sidebar.', async () => {
      await homePage.filters.checkCategory(category);
    });

    await test.step(
      'Verify the grid shows only the products of the category "Pliers": the products the catalogue lists for it in the page\'s default price range, $1 to $100.',
      async () => {
        // Approved reading: the catalogue is GET /products with the criteria the page sends (the category's id,
        // between=price,1,100), and the grid's page 1 is compared with the catalogue's page 1, in any order.
        const expected = await catalogueProductNames(
          { productsService, categoriesService, brandsService },
          { categorySlug: TestConstants.categories.pliers },
        );
        expect(expected.length, `The catalogue lists at least one product of the category "${category}"`).toBeGreaterThan(0);

        const shown = (await homePage.productGrid.getProductNames()).sort();
        expect(
          shown,
          `The grid shows the catalogue's products of "${category}": ${shown.join(' | ')} (catalogue: ${expected.join(' | ')})`,
        ).toEqual(expected);
      },
    );
  });

  test('UI-076: Checking a parent category checks all its child categories', async ({ homePage }) => {
    await test.step('Check the category "Hand Tools" in the sidebar.', async () => {
      await homePage.filters.checkCategory(TestConstants.categories.labels.handTools);
    });

    await test.step(
      'Verify the child categories "Hammer", "Hand Saw", "Wrench", "Screwdriver", "Pliers", "Chisels" and "Measures" are checked.',
      async () => {
        for (const child of TestConstants.categories.labels.handToolsChildren) {
          await expect(homePage.filters.categoryCheckbox(child), `The child category "${child}" is checked`).toBeChecked();
        }
      },
    );
  });

  test('UI-077: Unchecking all child categories unchecks the parent category', async ({ homePage }) => {
    const parent = TestConstants.categories.labels.handTools;

    await test.step('Check the category "Hand Tools" in the sidebar.', async () => {
      await homePage.filters.checkCategory(parent);
    });

    // One step per child, in the scenario's order: the titles are the scenario's steps verbatim.
    for (const child of TestConstants.categories.labels.handToolsChildren) {
      await test.step(`Uncheck the child category "${child}".`, async () => {
        await homePage.filters.uncheckCategory(child);
      });
    }

    await test.step('Verify the category "Hand Tools" is not checked.', async () => {
      await expect(homePage.filters.categoryCheckbox(parent), `The category "${parent}" is unchecked`).not.toBeChecked();
    });
  });

  test("UI-078: Checking a brand shows only that brand's products", async ({
    homePage,
    productsService,
    categoriesService,
    brandsService,
  }) => {
    const brand = 'MightyCraft Hardware';

    await test.step('Check the brand "MightyCraft Hardware" in the sidebar.', async () => {
      await homePage.filters.checkBrand(brand);
    });

    await test.step(
      'Verify the grid shows only the products of the brand "MightyCraft Hardware": the products the catalogue lists for it in the page\'s default price range, $1 to $100.',
      async () => {
        // Approved reading (as UI-075): the catalogue is GET /products with the criteria the page sends (the brand's id,
        // between=price,1,100), and the grid's page 1 is compared with the catalogue's page 1, in any order.
        const expected = await catalogueProductNames({ productsService, categoriesService, brandsService }, { brandName: brand });
        expect(expected.length, `The catalogue lists at least one product of the brand "${brand}"`).toBeGreaterThan(0);

        const shown = (await homePage.productGrid.getProductNames()).sort();
        expect(
          shown,
          `The grid shows the catalogue's products of "${brand}": ${shown.join(' | ')} (catalogue: ${expected.join(' | ')})`,
        ).toEqual(expected);
      },
    );
  });

  test('UI-079: Checking a category and a brand shows only products that match both', async ({
    homePage,
    productsService,
    categoriesService,
    brandsService,
  }) => {
    const category = TestConstants.categories.labels.pliers;
    const brand = TestConstants.products.brand;

    await test.step('Check the category "Pliers" in the sidebar.', async () => {
      await homePage.filters.checkCategory(category);
    });

    await test.step('Check the brand "ForgeFlex Tools" in the sidebar.', async () => {
      await homePage.filters.checkBrand(brand);
    });

    await test.step(
      'Verify the grid shows only the products that belong to both the category "Pliers" and the brand "ForgeFlex Tools": the products the catalogue lists for both filters in the page\'s default price range, $1 to $100.',
      async () => {
        // Approved reading (as UI-075): the catalogue is GET /products with the criteria the page sends (the category's
        // and the brand's ids, between=price,1,100), and the grid's page 1 is compared with the catalogue's page 1, in any order.
        const expected = await catalogueProductNames(
          { productsService, categoriesService, brandsService },
          { categorySlug: TestConstants.categories.pliers, brandName: brand },
        );
        expect(expected.length, `The catalogue lists at least one product of "${category}" and "${brand}"`).toBeGreaterThan(0);

        const shown = (await homePage.productGrid.getProductNames()).sort();
        expect(
          shown,
          `The grid shows the catalogue's products of "${category}" and "${brand}": ${shown.join(' | ')} (catalogue: ${expected.join(' | ')})`,
        ).toEqual(expected);
      },
    );
  });

  test('UI-080: Moving the price range slider shows only products within the new range', async ({ homePage }) => {
    const [low, high] = [10, 15];

    await test.step('Move the upper handle of the price range slider to 15.', async () => {
      // Approved: moved with the keyboard, holding the arrow key down like a user.
      await homePage.priceRange.setUpper(high);
    });

    await test.step('Move the lower handle of the price range slider to 10.', async () => {
      await homePage.priceRange.setLower(low);
    });

    await test.step('Verify at least one product is shown.', async () => {
      await expect(homePage.productGrid.cards.first(), 'At least one product card is shown').toBeVisible();
    });

    await test.step('Verify the price of every product shown is between $10 and $15.', async () => {
      // Approved reading: "every product shown" = the cards of the grid's page 1.
      const prices = await homePage.productGrid.getPrices();
      expect(prices.length, 'The grid shows at least one price').toBeGreaterThan(0);
      expect(
        prices.every((price) => price >= low && price <= high),
        `Every price shown is between $${low} and $${high}: ${prices.join(', ')}`,
      ).toBe(true);
    });
  });
});
