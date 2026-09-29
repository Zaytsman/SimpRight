import { test as base } from '../../fixtures/base';
import { env, storageStatePath, type UiAuthMode } from '../../config/env';
import { isStorageStateValid, tokenStorageState } from '../auth/authState';
import { ShoppingFlow } from '../flows/ShoppingFlow';
import { CartPage } from '../pages/CartPage';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { ProductPage } from '../pages/ProductPage';

export type UiOptions = {
  /** How the test starts logged in; defaults to UI_AUTH_MODE (see `UiAuthMode`). */
  authMode: UiAuthMode;
};

export type UiFixtures = {
  // Pages
  loginPage: LoginPage;
  homePage: HomePage;
  productPage: ProductPage;
  cartPage: CartPage;

  // Flows
  shoppingFlow: ShoppingFlow;

  // Components, grids and dialogs go here as they are added
};

export const test = base.extend<UiOptions & UiFixtures>({
  authMode: [env.uiAuthMode, { option: true }],

  // Start logged in as the test's role.
  // Logged-out tests: test.use({ storageState: { cookies: [], origins: [] } })
  storageState: async ({ authMode, role, config, tokenService }, use) => {
    if (authMode === 'storageState') {
      const filePath = storageStatePath(role);
      if (!isStorageStateValid(filePath)) {
        throw new Error(
          `No valid saved login at ${filePath}. globalSetup creates it only when running with UI_AUTH_MODE=storageState.`
        );
      }
      await use(filePath);
      return;
    }

    await use(tokenStorageState(config.baseUrl, await tokenService.getAccessToken(role)));
  },

  loginPage: async ({ page, config }, use) => {
    await use(new LoginPage(page, config));
  },
  homePage: async ({ page, config }, use) => {
    await use(new HomePage(page, config));
  },
  productPage: async ({ page, config }, use) => {
    await use(new ProductPage(page, config));
  },
  cartPage: async ({ page, config }, use) => {
    await use(new CartPage(page, config));
  },

  shoppingFlow: async ({ page, config }, use) => {
    await use(new ShoppingFlow(page, config));
  },
});

export { expect } from '@playwright/test';
