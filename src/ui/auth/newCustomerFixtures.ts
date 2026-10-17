import type { Fixtures, PlaywrightTestArgs, PlaywrightTestOptions, PlaywrightWorkerArgs, PlaywrightWorkerOptions } from '@playwright/test';
import type { TestFixtures } from '../../fixtures/fixtures';
import type { BaseWorkerFixtures } from '../../fixtures/base';
import type { FavoritesService } from '../../api/services/FavoritesService';
import { UserFactory } from '../../data/factories/UserFactory';
import { tokenStorageState } from './authState';

export type NewCustomerFixtures = {
  /** The customer registered for this test: an access token of its own. */
  newCustomer: { token: string };
  /** The favourites of that customer (the user the browser is logged in as). */
  customerFavoritesService: FavoritesService;
};

/**
 * The state "a customer registered for this test only is logged in", for `open<Page>WithNewCustomerTest` fixtures
 * (`openProductPageTest.extend(newCustomerFixtures)`): tests that change the user's own data can't affect each other
 * or the run's customer. After the test, the customer's favourites are removed, then the customer (as admin; a user
 * with favourites can't be deleted: 409).
 */
export const newCustomerFixtures: Fixtures<
  NewCustomerFixtures,
  object,
  TestFixtures & PlaywrightTestArgs & PlaywrightTestOptions,
  BaseWorkerFixtures & PlaywrightWorkerArgs & PlaywrightWorkerOptions
> = {
  newCustomer: async ({ usersService, adminUsersService, authService, favoritesServiceForToken, cleanup }, use) => {
    const body = UserFactory.registerCustomer();
    const created = await usersService.register(body);
    cleanup.add(() => adminUsersService.delete(created.id));
    const login = await authService.login({ email: body.email, password: body.password });
    // Registered after the customer's delete, so it runs first (cleanup runs newest first).
    cleanup.add(() => favoritesServiceForToken(login.access_token).deleteAll());
    await use({ token: login.access_token });
  },

  customerFavoritesService: async ({ newCustomer, favoritesServiceForToken }, use) => {
    await use(favoritesServiceForToken(newCustomer.token));
  },

  // The browser starts logged in as the new customer.
  storageState: async ({ newCustomer, config }, use) => {
    await use(tokenStorageState(config.baseUrl, newCustomer.token));
  },
};
