import { test as base } from '../../fixtures/base';
import { env, storageStatePath, type UiAuthMode } from '../../config/env';
import { isStorageStateValid, tokenStorageState } from '../auth/authState';
import { ShoppingFlow } from '../flows/ShoppingFlow';
import { CartPage } from '../pages/CartPage';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { ProductPage } from '../pages/ProductPage';

/** How a test starts: logged in with one of the `UiAuthMode`s, or `none` (logged out, no login at all). */
export type AuthMode = UiAuthMode | 'none';

export type UiOptions = {
  /**
   * How the test starts logged in; defaults to UI_AUTH_MODE (see `UiAuthMode`). `none` skips the login:
   * the `api` project sets it, so only API tests that ask for a token log in.
   */
  authMode: AuthMode;
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

  // Start logged in as the test's role; logged-out tests use test.use({ authMode: 'none' }).
  // Every test resolves this fixture (Playwright's trace recording reads the context options),
  // so `none` matters for API tests too: without it, each one would log in the default user.
  storageState: async ({ authMode, role, config, tokenService }, use) => {
    if (authMode === 'none') {
      await use(undefined);
      return;
    }

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
