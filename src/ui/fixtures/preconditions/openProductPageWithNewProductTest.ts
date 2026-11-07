// Extends `openProductPageTest` (itself the merged `test`), because a spec uses this fixture as its `test`.
import { openProductPageTest as base } from './openProductPageTest';
import { createProductInStock } from '../productSetup';

/**
 * Same as `openProductPageTest`, but the product is one created for this test through the API, with a unique name, in
 * stock (`createProductInStock`, removed after the test): other visitors of the demo site can change a seeded product's
 * stock, not this one. Its name is the `productName` fixture. A test that adds the product to the cart registers the
 * cart's removal (`removeCartAfterTest`), which then runs first: cleanup runs newest first, and a cart item blocks
 * deleting its product (409).
 */
export const openProductPageWithNewProductTest = base.extend({
  productName: async ({ productsService, adminProductsService, cleanup }, use) => {
    await use((await createProductInStock(productsService, adminProductsService, cleanup)).name);
  },
});
