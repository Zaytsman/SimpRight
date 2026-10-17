// Every scenario here has the precondition "The home page is open.": the fixture opens it before the steps.
import { openHomePageTest as test, expect } from '@fixtures';
import { TestConstants } from '@data/TestConstants';

// Scenarios: test-scenarios/ui/products/product-filters.yml
test.describe('@products - Product filters', () => {
  test("UI-075: Checking a category shows only that category's products", async ({
    homePage,
    categoriesService,
    productsService,
  }) => {
    const category = 'Pliers';

    await test.step('Check the category "Pliers" in the sidebar.', async () => {
      await homePage.filters.checkCategory(category);
    });

    await test.step(
      'Verify the grid shows only the products of the category "Pliers": the products the catalogue lists for it in the page\'s default price range, $1 to $100.',
      async () => {
        // Approved reading: the catalogue is GET /products with the criteria the page sends (the category's id,
        // between=price,1,100), and the grid's page 1 is compared with the catalogue's page 1, in any order.
        const categories = await categoriesService.list();
        const pliers = categories.find((item) => item.slug === TestConstants.categories.pliers);
        expect(pliers, `The catalogue has the category with the slug "${TestConstants.categories.pliers}"`).toBeTruthy();
        const catalogue = await productsService.list({ by_category: pliers!.id, between: 'price,1,100' });
        const expected = catalogue.data.map((product) => product.name.trim()).sort();
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
});
