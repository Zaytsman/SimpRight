import { test, expect } from '@fixtures';
import type { CartPage } from '@ui/pages/CartPage';
import { TestConstants } from '@data/TestConstants';

// Scenarios: test-scenarios/ui/cart/add-to-cart.yml
test.describe('@cart-ui - Cart', () => {
  test('UI-002: Add a product with quantity 2 to the cart', async ({ shoppingFlow, productPage }) => {
    const productName = TestConstants.products.knownProduct;
    const quantity = 2;
    let unitPrice: number;
    let cartPage: CartPage;

    await test.step('Search for "Combination Pliers" and open the product.', async () => {
      await shoppingFlow.openProduct(productName);
      unitPrice = await productPage.getUnitPrice();
    });

    await test.step('Set the quantity to 2 and click "Add to cart".', async () => {
      await productPage.setQuantity(quantity);
      await productPage.addToCart();
    });

    await test.step('Verify the cart badge in the nav bar shows 2.', async () => {
      await expect(productPage.navBar.cartQuantity, 'The cart badge shows the quantity added').toHaveText(String(quantity));
    });

    await test.step('Open the cart.', async () => {
      cartPage = await shoppingFlow.goToCart();
    });

    await test.step('Verify the cart has exactly one line: "Combination Pliers" with quantity 2.', async () => {
      expect(await cartPage.getLines(), 'The cart holds only the added product, with its quantity').toEqual([{ title: productName, quantity }]);
    });

    await test.step("Verify the cart total equals 2 × the product's unit price.", async () => {
      expect(await cartPage.getTotal(), `The cart total is ${quantity} × ${unitPrice}`).toBeCloseTo(unitPrice * quantity, 2);
    });
  });
});
