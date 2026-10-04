import { test as base } from '../../fixtures/base';
import { AuthClient } from '../clients/AuthClient';
import { CartsClient } from '../clients/CartsClient';
import { ProductsClient } from '../clients/ProductsClient';
import { UsersClient } from '../clients/UsersClient';
import { ProductsService } from '../services/ProductsService';
import { AuthService } from '../services/AuthService';
import { CartsService } from '../services/CartsService';
import { UsersService } from '../services/UsersService';

/** Not a JWT at all, so the API can't parse it and treats the request as unauthenticated. */
const INVALID_TOKEN = 'invalid-token';

export type ApiFixtures = {
  accessToken: string;
  authClient: AuthClient;
  /** Login as a happy path, for setup steps that need a user's own token. */
  authService: AuthService;
  /** Public endpoints: no token. */
  productsClient: ProductsClient;
  productsService: ProductsService;
  /** Products endpoints authenticated as the test's `role` (e.g. an admin sees the stock count). */
  productsClientWithToken: ProductsClient;
  /** Sends a fixed malformed bearer token (`INVALID_TOKEN`), for the "invalid token" 401 checks. */
  productsClientWithInvalidToken: ProductsClient;
  /** Always authenticated as admin, whatever the test's `role`: setup creates and cleanup deletes (DELETE is admin-only). */
  adminProductsService: ProductsService;
  /** Authenticated as the test's `role`. */
  usersClient: UsersClient;
  /** Users endpoints with no token (public ones such as register, and the "no token" 401 checks). */
  usersClientWithoutToken: UsersClient;
  /** Public user operations (register a throwaway customer); no token. */
  usersService: UsersService;
  /** Sends a fixed malformed bearer token (`INVALID_TOKEN`), for the "invalid token" 401 checks. */
  usersClientWithInvalidToken: UsersClient;
  /** Builds a users client with a token the test obtained itself (e.g. from a throwaway customer's login). */
  usersClientForToken: (token: string) => UsersClient;
  /** Builds a users service with a token the test obtained itself (setup logouts and refreshes of that token). */
  usersServiceForToken: (token: string) => UsersService;
  /** Always authenticated as admin, whatever the test's `role`: patches throwaway customers and deletes them in cleanup. */
  adminUsersService: UsersService;
  /** Public: carts need no token (cleanup removes the cart a UI test filled). */
  cartsService: CartsService;
};

export const test = base.extend<ApiFixtures>({
  accessToken: async ({ role, tokenService }, use) => {
    await use(await tokenService.getAccessToken(role));
  },

  authClient: async ({ request, config }, use) => {
    await use(new AuthClient(request, config));
  },
  authService: async ({ authClient }, use) => {
    await use(new AuthService(authClient));
  },

  productsClient: async ({ request, config }, use) => {
    await use(new ProductsClient(request, config));
  },
  productsService: async ({ productsClient }, use) => {
    await use(new ProductsService(productsClient));
  },
  productsClientWithToken: async ({ request, config, accessToken }, use) => {
    await use(new ProductsClient(request, config, accessToken));
  },
  productsClientWithInvalidToken: async ({ request, config }, use) => {
    await use(new ProductsClient(request, config, INVALID_TOKEN));
  },
  adminProductsService: async ({ request, config, tokenService }, use) => {
    await use(new ProductsService(new ProductsClient(request, config, await tokenService.getAccessToken('admin'))));
  },

  usersClient: async ({ request, config, accessToken }, use) => {
    await use(new UsersClient(request, config, accessToken));
  },
  usersClientWithoutToken: async ({ request, config }, use) => {
    await use(new UsersClient(request, config));
  },
  usersService: async ({ usersClientWithoutToken }, use) => {
    await use(new UsersService(usersClientWithoutToken));
  },
  usersClientWithInvalidToken: async ({ request, config }, use) => {
    await use(new UsersClient(request, config, INVALID_TOKEN));
  },
  usersClientForToken: async ({ request, config }, use) => {
    await use((token: string) => new UsersClient(request, config, token));
  },
  usersServiceForToken: async ({ usersClientForToken }, use) => {
    await use((token: string) => new UsersService(usersClientForToken(token)));
  },
  adminUsersService: async ({ request, config, tokenService }, use) => {
    await use(new UsersService(new UsersClient(request, config, await tokenService.getAccessToken('admin'))));
  },

  cartsService: async ({ request, config }, use) => {
    await use(new CartsService(new CartsClient(request, config)));
  },
});

export { expect } from '@playwright/test';
