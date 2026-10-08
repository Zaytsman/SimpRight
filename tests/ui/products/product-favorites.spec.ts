import { test, expect, throwawayCustomerTest } from '@fixtures';
import { TestConstants } from '@data/TestConstants';

// Scenarios: test-scenarios/ui/products/product-favorites.yml
test.describe('@products - Product favourites', () => {
  test.describe(() => {
    // The precondition fixture under the name `test`, so the scenario validator finds these tests by their titles.
    // Each test gets a customer of its own (approved), so the two favourite states can't collide in parallel runs;
    // the fixture removes the customer's favourites, then the customer.
    const test = throwawayCustomerTest;

    test('UI-028: Adding a product to favourites shows a success message', async ({ shoppingFlow, productPage, customerFavoritesService }) => {
      const productName = TestConstants.products.inStockProduct;

      await test.step(`The product "Combination Pliers" is not in the user's favourites.`, async () => {
        // The customer is new, so the list is empty already; clearing it keeps the step true whatever the fixture gives.
        await customerFavoritesService.deleteAll();
      });

      await test.step('Open the product "Combination Pliers".', async () => {
        await shoppingFlow.openProduct(productName);
      });

      await test.step('Click "Add to favourites".', async () => {
        await productPage.addToFavorites();
      });

      await test.step('Verify the message "Product added to your favorites list." is shown.', async () => {
        await expect(productPage.toast, 'The success message is visible').toBeVisible();
        await expect(productPage.toast, 'The success message is shown').toHaveText('Product added to your favorites list.');
      });
    });

    test('UI-029: Adding a product that is already a favourite shows a message', async ({
      shoppingFlow,
      productPage,
      productsService,
      customerFavoritesService,
    }) => {
      const productName = TestConstants.products.inStockProduct;

      await test.step(`The product "Combination Pliers" is in the user's favourites.`, async () => {
        // Ids change when the site re-seeds, so the product is found by its name.
        const product = (await productsService.search(productName)).data.find((item) => item.name === productName);
        if (!product) throw new Error(`No product named "${productName}" found`);
        await customerFavoritesService.add(product.id);
      });

      await test.step('Open the product "Combination Pliers".', async () => {
        await shoppingFlow.openProduct(productName);
      });

      await test.step('Click "Add to favourites".', async () => {
        await productPage.addToFavorites();
      });

      await test.step('Verify the message "Product already in your favorites list." is shown.', async () => {
        await expect(productPage.toast, 'The "already a favourite" message is visible').toBeVisible();
        await expect(productPage.toast, 'The "already a favourite" message is shown').toHaveText('Product already in your favorites list.');
      });
    });
  });

  test.describe(() => {
    test.use({ authMode: 'none' });

    test("UI-030: A logged-out visitor can't add a product to favourites", async ({ shoppingFlow, productPage }) => {
      await test.step('Open the product "Combination Pliers".', async () => {
        await shoppingFlow.openProduct(TestConstants.products.inStockProduct);
      });

      await test.step('Click "Add to favourites".', async () => {
        await productPage.addToFavorites();
      });

      await test.step('Verify the message "Unauthorized, can not add product to your favorite list." is shown.', async () => {
        await expect(productPage.toast, 'The "not logged in" message is visible').toBeVisible();
        await expect(productPage.toast, 'The "not logged in" message is shown').toHaveText('Unauthorized, can not add product to your favorite list.');
      });
    });
  });
});
