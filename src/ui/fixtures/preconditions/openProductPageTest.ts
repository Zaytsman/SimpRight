// Extends the merged `test` (API + UI fixtures), because a spec uses this fixture as its `test`.
import { test as base } from '../../../fixtures/fixtures';
import type { ProductPage } from '../../pages/ProductPage';

type OpenProductPageFixtures = {
  /** The product whose page is open; set it with `test.use({ productName: ... })`. */
  productName: string;
  productPage: ProductPage;
};

/**
 * Same as `test`, but the page of `productName` is already open and loaded when the test starts, reached like a
 * user would (home -> search -> card, `shoppingFlow.openProduct`).
 */
export const openProductPageTest = base.extend<OpenProductPageFixtures>({
  productName: ['', { option: true }],

  productPage: async ({ productPage, productName, shoppingFlow }, use) => {
    if (!productName) throw new Error('openProductPageTest needs a product: test.use({ productName: ... })');
    await shoppingFlow.openProduct(productName);
    await use(productPage);
  },
});
