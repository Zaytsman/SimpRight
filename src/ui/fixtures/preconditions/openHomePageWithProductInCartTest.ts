// Extends the merged `test` (API + UI fixtures), because a spec uses this fixture as its `test`.
import { test as base } from '../../../fixtures/fixtures';
import { putProductInCart, type VisitorCart } from '../cartSetup';

type OpenHomePageWithProductInCartFixtures = {
  /** The cart made for this test (through the API) and the product in it: the seeded in-stock product, quantity 1. */
  visitorCart: VisitorCart;
  /** Runs for every test: the cart is set up, then the home page is opened. */
  homePageWithProductInCart: void;
};

/**
 * Same as `test`, but a product that is in stock is in the browser's cart (`putProductInCart`; the cart is removed
 * after the test), and the home page is open when the test starts.
 */
export const openHomePageWithProductInCartTest = base.extend<OpenHomePageWithProductInCartFixtures>({
  visitorCart: async ({ page, productsService, cartsService, cleanup }, use) => {
    await use(await putProductInCart(page, productsService, cartsService, cleanup));
  },

  homePageWithProductInCart: [
    async ({ visitorCart, homePage }, use) => {
      void visitorCart; // set up before the page is opened, so the app finds the cart on its first load
      await homePage.open();
      await use();
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
