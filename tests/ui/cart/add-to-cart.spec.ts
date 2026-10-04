import { test, expect, createProductInStock } from '@fixtures';
import type { CartPage } from '@ui/pages/CartPage';

// Scenarios: test-scenarios/ui/cart/add-to-cart.yml
test.describe('@cart - Cart', () => {
  test('UI-002: Add a product with quantity 2 to the cart', async ({
    shoppingFlow,
    productPage,
    productsService,
    adminProductsService,
    cartsService,
    cleanup,
  }) => {
    const quantity = 2;
    let unitPrice: number;
    let cartPage: CartPage;

    // A product of its own, so other visitors of the demo site (who can change seeded products) can't break the test.
    const productName = (await createProductInStock(productsService, adminProductsService, cleanup)).name;

    await test.step('Search for that product and open it.', async () => {
      await shoppingFlow.openProduct(productName);
      unitPrice = await productPage.getUnitPrice();
    });

    await test.step('Set the quantity to 2 and click "Add to cart".', async () => {
      await productPage.setQuantity(quantity);
      await productPage.addToCart();
      // The cart holds the product, which blocks its removal: remove the cart first (cleanup runs newest first).
      const cartId = await productPage.getCartId();
      if (cartId) cleanup.add(() => cartsService.delete(cartId));
    });

    await test.step('Verify the cart badge in the nav bar shows 2.', async () => {
      await expect(productPage.navBar.cartQuantity, 'The cart badge shows the quantity added').toHaveText(String(quantity));
    });

    await test.step('Open the cart.', async () => {
      cartPage = await shoppingFlow.goToCart();
    });

    await test.step('Verify the cart has exactly one line: that product with quantity 2.', async () => {
      expect(await cartPage.getLines(), 'The cart holds only the added product, with its quantity').toEqual([{ title: productName, quantity }]);
    });

    await test.step("Verify the cart total equals 2 × the product's unit price.", async () => {
      expect(await cartPage.getTotal(), `The cart total is ${quantity} × ${unitPrice}`).toBeCloseTo(unitPrice * quantity, 2);
    });
  });
});
