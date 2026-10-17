// Extends the merged `test` (API + UI fixtures), because a spec uses this fixture as its `test`.
import { test as base } from '../../../fixtures/fixtures';
import { TestConstants } from '../../../data/TestConstants';
import { assertNoEcoRating, putProductsInCart, type CartProduct } from '../cartSetup';

/** The cart made for this test (through the API): a rental and a product that isn't one, one of each. */
export interface RentalAndProductCart {
  cartId: string;
  rental: CartProduct;
  product: CartProduct;
}

type OpenHomePageWithRentalAndProductInCartFixtures = {
  rentalAndProductCart: RentalAndProductCart;
  /** Runs for every test: the cart is set up, then the home page is opened. */
  homePageWithRentalAndProductInCart: void;
};

/**
 * Same as `test`, but the browser's cart holds the seeded rental (1 hour) and the seeded in-stock product (quantity 1),
 * added through the API (the cart is removed after the test), and the home page is open when the test starts. The
 * cart has no location, so no line gets a location discount, and setup fails if either product has CO2 rating A or B
 * (the page's eco discount would change the totals). Setup also checks that the API gave the cart its 15% combined
 * discount, so a test about that discount's rows can't pass on a cart that never had it.
 */
export const openHomePageWithRentalAndProductInCartTest = base.extend<OpenHomePageWithRentalAndProductInCartFixtures>({
  rentalAndProductCart: async ({ page, productsService, cartsService, cleanup }, use) => {
    const { cartId, products } = await putProductsInCart(page, productsService, cartsService, cleanup, [
      { name: TestConstants.products.rentalProduct },
      { name: TestConstants.products.inStockProduct },
    ]);
    const [rental, product] = products;
    if (!rental?.is_rental || !product || product.is_rental) {
      throw new Error(`Setup: expected a rental and a product that isn't one in the cart, got ${JSON.stringify(products)}`);
    }
    assertNoEcoRating(products);
    const cart = await cartsService.get(cartId);
    if (cart.additional_discount_percentage !== 15) {
      throw new Error(`Setup: expected the cart's 15% combined discount, got ${cart.additional_discount_percentage}`);
    }
    await use({ cartId, rental, product });
  },

  homePageWithRentalAndProductInCart: [
    async ({ rentalAndProductCart, homePage }, use) => {
      void rentalAndProductCart; // set up before the page is opened, so the app finds the cart on its first load
      await homePage.open();
      await use();
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
