import { openProductPageTest as test, expect, openProductPageWithNewCustomerTest, findProductByName } from '@fixtures';
import { TestConstants } from '@data/TestConstants';

// Scenarios: test-scenarios/ui/products/product-favorites.yml
test.describe('@products - Product favourites', () => {
  // Precondition: The product page of "Combination Pliers" is open.
  test.use({ productName: TestConstants.products.inStockProduct });

  test.describe(() => {
    // The new-customer fixture under the name `test`, so the scenario validator finds these tests by their titles.
    // Each test gets a customer of its own (approved), so the two favourite states can't collide in parallel runs;
    // the fixture removes the customer's favourites, then the customer.
    const test = openProductPageWithNewCustomerTest;

    test('UI-028: Adding a product to favourites shows a success message', { tag: '@smoke' }, async ({ productPage }) => {
      // Precondition: the product "Combination Pliers" is not in the user's favourites. Nothing to set up: the customer
      // is registered for this test, so its list is empty.

      await test.step('Click "Add to favourites".', async () => {
        await productPage.addToFavorites();
      });

      await test.step('Verify the message "Product added to your favorites list." is shown.', async () => {
        await expect(productPage.toast, 'The success message is visible').toBeVisible();
        await expect(productPage.toast, 'The success message is shown').toHaveText('Product added to your favorites list.');
      });
    });

    test('UI-029: Adding a product that is already a favourite shows a message', async ({
      productPage,
      productName,
      productsService,
      customerFavoritesService,
    }) => {
      // Precondition: the product "Combination Pliers" is in the user's favourites. Ids change when the site
      // re-seeds, so the product is found by its name. Added after the page opened: the page doesn't read the
      // favourites, it only sends one on "Add to favourites" (app source: detail.component.ts, `addToFavorites`).
      const product = await findProductByName(productsService, productName);
      await customerFavoritesService.add(product.id);

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

    test("UI-030: A logged-out visitor can't add a product to favourites", async ({ productPage }) => {
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
