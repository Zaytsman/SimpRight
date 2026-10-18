import { test, expect, createProductInStock, openProductPageTest, removeCartAfterTest } from '@fixtures';
import { TestConstants } from '@data/TestConstants';

// Scenarios: test-scenarios/ui/cart/add-to-cart.yml
test.describe('@cart - Cart', () => {
  test('UI-002: Add a product with quantity 2 to the cart', { tag: '@smoke' }, async ({
    shoppingFlow,
    productPage,
    cartPage,
    productsService,
    adminProductsService,
    cartsService,
    cleanup,
  }) => {
    const quantity = 2;
    let unitPrice: number;

    // Precondition: A product created for this test through the API, with a unique name, is in stock.
    // A product of its own, so other visitors of the demo site (who can change seeded products) can't break the test.
    const productName = (await createProductInStock(productsService, adminProductsService, cleanup)).name;

    // Precondition: The product page of that product is open.
    await shoppingFlow.openProduct(productName);

    await test.step('Set the quantity to 2 and click "Add to cart".', async () => {
      unitPrice = await productPage.getUnitPrice();
      await productPage.setQuantity(quantity);
      try {
        await productPage.addToCart();
      } finally {
        // The cart holds the product, which blocks its removal: the cart goes first (cleanup runs newest first).
        // In `finally`, so a cart the app created is removed even when the add fails.
        await removeCartAfterTest(productPage, cartsService, cleanup);
      }
    });

    await test.step('Verify the cart badge in the nav bar shows 2.', async () => {
      await expect(productPage.navBar.cartQuantity, 'The cart badge shows the quantity added').toHaveText(String(quantity));
    });

    await test.step('Open the cart.', async () => {
      await cartPage.open();
    });

    await test.step('Verify the cart has exactly one line: that product with quantity 2.', async () => {
      expect(await cartPage.getLines(), 'The cart holds only the added product, with its quantity').toEqual([{ title: productName, quantity }]);
    });

    await test.step("Verify the cart total equals 2 × the product's unit price.", async () => {
      expect(await cartPage.getTotal(), `The cart total is ${quantity} × ${unitPrice}`).toBeCloseTo(unitPrice * quantity, 2);
    });
  });

  test.describe(() => {
    const test = openProductPageTest;
    // Precondition: The cart is empty. Nothing to set up: every test gets a new browser context, and the app keeps the
    // cart id only in that context's sessionStorage (not with the logged-in user), so the test starts without a cart.
    // Precondition: The product page of "Combination Pliers" is open.
    test.use({ productName: TestConstants.products.inStockProduct });

    test('UI-027: Adding a product to the cart shows a success message', async ({ productPage, cartsService, cleanup }) => {
      await test.step('Click "Add to cart".', async () => {
        try {
          await productPage.addToCart();
        } finally {
          // In `finally`, so a cart the app created is removed even when the add fails.
          await removeCartAfterTest(productPage, cartsService, cleanup);
        }
      });

      await test.step('Verify the message "Product added to shopping cart." is shown.', async () => {
        await expect(productPage.toast, 'The success message is visible').toBeVisible();
        await expect(productPage.toast, 'The success message is shown').toHaveText('Product added to shopping cart.');
      });
    });
  });
});
