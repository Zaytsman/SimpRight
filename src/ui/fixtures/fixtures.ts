import { test as base } from '../../fixtures/base';
import { ShoppingFlow } from '../flows/ShoppingFlow';
import { CartPage } from '../pages/CartPage';
import { HomePage } from '../pages/HomePage';
import { ProductPage } from '../pages/ProductPage';
import { RentalsPage } from '../pages/RentalsPage';

// How a UI test starts logged in (`authMode`, `storageState`) is in the base fixtures (src/fixtures/base.ts).
export type UiFixtures = {
  // Pages
  homePage: HomePage;
  productPage: ProductPage;
  cartPage: CartPage;
  rentalsPage: RentalsPage;

  // Flows
  shoppingFlow: ShoppingFlow;

  // Components, grids and dialogs go here as they are added
};

export const test = base.extend<UiFixtures>({
  homePage: async ({ page, config }, use) => {
    await use(new HomePage(page, config));
  },
  productPage: async ({ page, config }, use) => {
    await use(new ProductPage(page, config));
  },
  cartPage: async ({ page, config }, use) => {
    await use(new CartPage(page, config));
  },
  rentalsPage: async ({ page, config }, use) => {
    await use(new RentalsPage(page, config));
  },

  shoppingFlow: async ({ page, config }, use) => {
    await use(new ShoppingFlow(page, config));
  },
});
