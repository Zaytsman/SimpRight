import { test, expect } from '@fixtures';
import { TestConstants } from '@data/TestConstants';

// Scenarios: test-scenarios/ui/cart/add-to-cart.yml
test.describe('@cart-ui - Cart', () => {
  test('UI-CART-001: Add a product with quantity 2 to the cart', async ({ shoppingFlow, productPage }) => {
    const productName = TestConstants.products.knownProduct;
    const quantity = 2;

    const { unitPrice } = await shoppingFlow.addProductToCart(productName, quantity);
    await expect(productPage.navBar.cartQuantity).toHaveText(String(quantity));

    const cartPage = await shoppingFlow.goToCart();
    expect(await cartPage.getLines()).toEqual([{ title: productName, quantity }]);
    expect(await cartPage.getTotal()).toBeCloseTo(unitPrice * quantity, 2);
  });
});
