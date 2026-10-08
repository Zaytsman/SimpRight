import { test as base } from './fixtures';
import { tokenStorageState } from '../ui/auth/authState';
import { UserFactory } from '../data/factories/UserFactory';
import type { FavoritesService } from '../api/services/FavoritesService';

type ThrowawayCustomerFixtures = {
  /** The customer registered for this test: an access token of its own. */
  throwawayCustomer: { token: string };
  /** The favourites of that customer (the user the browser is logged in as). */
  customerFavoritesService: FavoritesService;
};

/**
 * Same as `test`, but the browser starts logged in as a customer registered for this test only, so tests that
 * change the user's own data (favourites) can't affect each other or the run's customer. After the test, the
 * customer's favourites are removed, then the customer (as admin; a user with favourites can't be deleted: 409).
 */
export const throwawayCustomerTest = base.extend<ThrowawayCustomerFixtures>({
  throwawayCustomer: async ({ usersService, adminUsersService, authService, cleanup }, use) => {
    const body = UserFactory.registerCustomer();
    const created = await usersService.register(body);
    cleanup.add(() => adminUsersService.delete(created.id));
    const login = await authService.login({ email: body.email, password: body.password });
    await use({ token: login.access_token });
  },

  customerFavoritesService: async ({ throwawayCustomer, favoritesServiceForToken, cleanup }, use) => {
    const favoritesService = favoritesServiceForToken(throwawayCustomer.token);
    // Registered after the customer's delete, so it runs first (cleanup runs newest first).
    cleanup.add(() => favoritesService.deleteAll());
    await use(favoritesService);
  },

  // Start logged in as the customer. It asks for customerFavoritesService so that cleanup is registered even
  // when the test's steps never call it (a favourite added only through the UI).
  storageState: async ({ throwawayCustomer, customerFavoritesService, config }, use) => {
    void customerFavoritesService;
    await use(tokenStorageState(config.baseUrl, throwawayCustomer.token));
  },
});

export { expect } from '@playwright/test';
