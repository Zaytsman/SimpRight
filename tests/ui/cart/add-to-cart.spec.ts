import { test, expect } from '@fixtures';
import { TestConstants } from '@data/TestConstants';

// Scenarios: test-scenarios/ui/cart/add-to-cart.yml
test.describe('@cart-ui - Cart', () => {
  // Skipped for now (2026-10-03): the shared default test user is locked (423) on the demo site, so the
  // login fails before the test starts. Re-enable (test.fixme -> test) when it unlocks or with an own account.
  test.fixme('UI-002: Add a product with quantity 2 to the cart', async ({ shoppingFlow, productPage }) => {
    const productName = TestConstants.products.knownProduct;
    const quantity = 2;

    const { unitPrice } = await shoppingFlow.addProductToCart(productName, quantity);
    await expect(productPage.navBar.cartQuantity).toHaveText(String(quantity));

    const cartPage = await shoppingFlow.goToCart();
    expect(await cartPage.getLines()).toEqual([{ title: productName, quantity }]);
    expect(await cartPage.getTotal()).toBeCloseTo(unitPrice * quantity, 2);
  });
});
