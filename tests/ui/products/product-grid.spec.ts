// Every scenario here has the precondition "The home page is open.": the fixture opens it before the steps.
import { openHomePageTest as test, expect, openHomePageInLondonTest } from '@fixtures';
import { TestConstants } from '@data/TestConstants';

// Scenarios: test-scenarios/ui/products/product-grid.yml
test.describe('@products - Product grid', () => {
  test('UI-012: An out-of-stock product shows "Out of stock" on its card', async ({ homePage }) => {
    const productName = TestConstants.products.outOfStockProduct;

    await test.step('Verify the card of "Long Nose Pliers" shows "Out of stock".', async () => {
      const label = homePage.productGrid.outOfStockLabel(productName);
      await expect(label, `The card of "${productName}" shows its out-of-stock label`).toBeVisible();
      await expect(label, `The out-of-stock label of "${productName}" reads "Out of stock"`).toHaveText('Out of stock');
    });
  });

  test('UI-070: The home page shows a grid of product cards with an image, a name and a price', { tag: '@smoke' }, async ({ homePage }) => {
    const grid = homePage.productGrid;

    await test.step('Verify the product grid shows at least one product card.', async () => {
      await expect(grid.cards.first(), 'At least one product card is shown').toBeVisible();
    });

    // Approved reading for the three "every card" steps below: "every card" means the cards the home page shows,
    // page 1 of the grid.
    await test.step('Verify every card shows a product image.', async () => {
      // Approved reading: the image is shown when its <img> is visible; whether the picture loaded isn't checked.
      const count = await grid.cards.count();
      for (let i = 0; i < count; i++) {
        await expect(grid.cardImage(i), `Card ${i + 1} of ${count} shows a product image`).toBeVisible();
      }
    });

    await test.step('Verify every card shows a product name.', async () => {
      const count = await grid.cards.count();
      for (let i = 0; i < count; i++) {
        await expect(grid.cardName(i), `Card ${i + 1} of ${count} shows its product name`).toBeVisible();
        await expect(grid.cardName(i), `Card ${i + 1} of ${count} has a non-empty product name`).toHaveText(/\S/);
      }
    });

    await test.step('Verify every card shows a price.', async () => {
      const count = await grid.cards.count();
      for (let i = 0; i < count; i++) {
        await expect(grid.cardPrice(i), `Card ${i + 1} of ${count} shows its price`).toBeVisible();
        await expect(grid.cardPrice(i), `Card ${i + 1} of ${count} has a price in dollars and cents`).toHaveText(
          /^\$\d+\.\d{2}$/
        );
      }
    });
  });

  test("UI-071: Clicking a product card opens that product's page", { tag: '@smoke' }, async ({ homePage, productPage }) => {
    const productName = TestConstants.products.inStockProduct;

    await test.step('Click the card of "Combination Pliers".', async () => {
      await homePage.productGrid.openProduct(productName);
      await productPage.waitForLoaded();
    });

    await test.step('Verify the product detail page is shown.', async () => {
      // Approved reading: the detail page is shown when its description (rendered only on that page) is visible.
      await expect(productPage.description, 'The product detail page shows the product description').toBeVisible();
    });

    await test.step('Verify the name "Combination Pliers" is shown.', async () => {
      await expect(productPage.name, 'The product name is shown').toBeVisible();
      await expect(productPage.name, `The product name is "${productName}"`).toHaveText(productName);
    });
  });

  test('UI-072: The pagination controls are shown below the grid and page 2 shows other products', async ({ homePage }) => {
    const grid = homePage.productGrid;
    const pagination = homePage.pagination;
    let firstPageNames: string[] = [];

    await test.step('Verify the pagination controls are shown below the product grid.', async () => {
      await expect(pagination.navigation, 'The pagination controls are shown').toBeVisible();
      // Approved reading: "below the product grid" = the controls' top is at or below the bottom of the grid's last card.
      const controls = await pagination.navigation.boundingBox();
      const lastCard = await grid.cards.last().boundingBox();
      expect(controls && lastCard, 'Both the pagination controls and the last card have a position on the page').toBeTruthy();
      expect(controls!.y, 'The pagination controls start below the last product card').toBeGreaterThanOrEqual(lastCard!.y + lastCard!.height);
    });

    await test.step('Click page "2" in the pagination.', async () => {
      firstPageNames = await grid.getProductNames();
      await pagination.goToPage(2);
    });

    await test.step('Verify at least one product is shown.', async () => {
      await expect(grid.cards.first(), 'At least one product card is shown on page 2').toBeVisible();
    });

    await test.step('Verify none of the products shown was shown on page 1.', async () => {
      // Approved reading: products are compared by name.
      const secondPageNames = await grid.getProductNames();
      const repeated = secondPageNames.filter((name) => firstPageNames.includes(name));
      expect(
        repeated,
        `No product of page 2 (${secondPageNames.join(' | ')}) was on page 1 (${firstPageNames.join(' | ')})`,
      ).toEqual([]);
    });

    await test.step('Verify page "2" is marked as the active page.', async () => {
      // Approved reading: the app marks the current page with the class "active" on its list item (it sets no aria-current).
      await expect(pagination.pageItem(2), 'Page 2 is marked as the active page').toHaveClass(/\bactive\b/);
    });
  });

  test('UI-073: The price range slider is shown with the range $1 to $100 and a maximum of $200', async ({ homePage }) => {
    const slider = homePage.priceRange;

    await test.step('Verify the price range slider is shown in the sidebar.', async () => {
      // The slider is looked up inside the filter sidebar, so these checks also prove where it is.
      await expect(slider.lowerHandle, 'The lower handle of the price range slider is shown in the sidebar').toBeVisible();
      await expect(slider.upperHandle, 'The upper handle of the price range slider is shown in the sidebar').toBeVisible();
    });

    // Approved reading for the three checks below: the values the slider announces (aria-valuenow, aria-valuemax).
    await test.step('Verify the lower handle is at 1.', async () => {
      await expect(slider.lowerHandle, 'The lower handle is at 1').toHaveAttribute('aria-valuenow', '1');
    });

    await test.step('Verify the upper handle is at 100.', async () => {
      await expect(slider.upperHandle, 'The upper handle is at 100').toHaveAttribute('aria-valuenow', '100');
    });

    await test.step('Verify the maximum of the slider is 200.', async () => {
      await expect(slider.upperHandle, 'The slider goes up to 200').toHaveAttribute('aria-valuemax', '200');
    });
  });

  test.describe(() => {
    // The precondition fixture under the name `test`, so the scenario validator finds this test by its title: the
    // browser is a visitor in London and the home page is open.
    const test = openHomePageInLondonTest;

    test("UI-074: A location offer's card shows the original price struck through and the discounted price for a visitor in London", async ({
      homePage,
    }) => {
      const grid = homePage.productGrid;
      const productName = TestConstants.products.locationOfferProduct;

      await test.step('Verify the card of "Bolt Cutters" is shown on the first page.', async () => {
        await expect(grid.card(productName), `The card of "${productName}" is shown on page 1`).toBeVisible();
      });

      await test.step('Verify the card of "Bolt Cutters" shows its original price struck through.', async () => {
        const original = grid.cardPriceOf(productName);
        await expect(original, `The card of "${productName}" shows its original price`).toBeVisible();
        await expect(original, `The original price of "${productName}" is a dollar amount`).toHaveText(/^\$\d+\.\d{2}$/);
        await expect(original, `The original price of "${productName}" is struck through`).toHaveCSS('text-decoration-line', 'line-through');
      });

      await test.step('Verify the card of "Bolt Cutters" shows the discounted price, 25% below the original price.', async () => {
        await expect(grid.cardDiscountPriceOf(productName), `The card of "${productName}" shows a discounted price`).toBeVisible();
        const original = await grid.getCardPrice(productName);
        const discounted = await grid.getCardDiscountPrice(productName);
        // Approved reading: 25% below = 75% of the original price, within half a cent (the app rounds to the cent).
        expect(
          Math.abs(discounted - original * 0.75),
          `The discounted price ${discounted} is 75% of the original price ${original}, to the cent`,
        ).toBeLessThanOrEqual(0.005 + 1e-9);
      });
    });
  });
});
