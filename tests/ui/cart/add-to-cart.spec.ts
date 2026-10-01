import { test, expect } from '@fixtures';

// Scenarios: test-scenarios/ui/cart.yml
test.describe('Cart', () => {
  test('UI-CART-001: add a product with quantity 2 to the cart', async ({ shoppingFlow, productPage }) => {
    const productName = 'Combination Pliers';
    const quantity = 2;

    const { unitPrice } = await shoppingFlow.addProductToCart(productName, quantity);
    await expect(productPage.navBar.cartQuantity).toHaveText(String(quantity));

    const cartPage = await shoppingFlow.goToCart();
    expect(await cartPage.getLines()).toEqual([{ title: productName, quantity }]);
    expect(await cartPage.getTotal()).toBeCloseTo(unitPrice * quantity, 2);
  });
});
