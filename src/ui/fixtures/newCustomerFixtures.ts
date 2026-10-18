import type { Fixtures, PlaywrightTestArgs, PlaywrightTestOptions, PlaywrightWorkerArgs, PlaywrightWorkerOptions } from '@playwright/test';
import type { TestFixtures } from '../../fixtures/fixtures';
import type { BaseWorkerFixtures, Cleanup } from '../../fixtures/base';
import type { RegisterUserRequest } from '../../api/dto/user';
import type { AuthService } from '../../api/services/AuthService';
import type { FavoritesService } from '../../api/services/FavoritesService';
import type { UsersService } from '../../api/services/UsersService';
import { UserFactory } from '../../data/factories/UserFactory';
import { tokenStorageState } from '../auth/authState';

/**
 * Setup code (not a step): registers a customer for this test only through the API (a unique email, a random strong
 * password), registers its removal as admin right away, and logs it in. Returns what it registered with (`body`: the
 * email and password), its id and its access token. A customer with favourites can't be deleted (409), so a test that
 * adds some registers their removal after this call, and cleanup (newest first) removes them first.
 */
export async function registerCustomerForTest(
  services: { usersService: UsersService; adminUsersService: UsersService; authService: AuthService },
  cleanup: Cleanup
): Promise<{ body: RegisterUserRequest; id: string; token: string }> {
  const body = UserFactory.registerCustomer();
  const { id } = await services.usersService.register(body);
  cleanup.add(() => services.adminUsersService.delete(id));
  const { access_token: token } = await services.authService.login({ email: body.email, password: body.password });
  return { body, id, token };
}

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
    const { token } = await registerCustomerForTest({ usersService, adminUsersService, authService }, cleanup);
    // Registered after the customer's delete, so it runs first (cleanup runs newest first).
    cleanup.add(() => favoritesServiceForToken(token).deleteAll());
    await use({ token });
  },

  customerFavoritesService: async ({ newCustomer, favoritesServiceForToken }, use) => {
    await use(favoritesServiceForToken(newCustomer.token));
  },

  // The browser starts logged in as the new customer.
  storageState: async ({ newCustomer, config }, use) => {
    await use(tokenStorageState(config.baseUrl, newCustomer.token));
  },
};
