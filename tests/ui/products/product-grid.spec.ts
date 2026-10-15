// Every scenario here has the precondition "The home page is open.": the fixture opens it before the steps.
import { openHomePageTest as test, expect } from '@fixtures';
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

  test('UI-070: The home page shows a grid of product cards with an image, a name and a price', async ({ homePage }) => {
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

  test("UI-071: Clicking a product card opens that product's page", async ({ homePage, productPage }) => {
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
});
