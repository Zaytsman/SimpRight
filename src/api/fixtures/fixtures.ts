import { test as base } from '../../fixtures/base';
import { AuthClient } from '../clients/AuthClient';
import { ProductsClient } from '../clients/ProductsClient';
import { UsersClient } from '../clients/UsersClient';
import { ProductsService } from '../services/ProductsService';

/** Not a JWT at all, so the API can't parse it and treats the request as unauthenticated. */
const INVALID_TOKEN = 'invalid-token';

export type ApiFixtures = {
  accessToken: string;
  authClient: AuthClient;
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
};

export const test = base.extend<ApiFixtures>({
  accessToken: async ({ role, tokenService }, use) => {
    await use(await tokenService.getAccessToken(role));
  },

  authClient: async ({ request, config }, use) => {
    await use(new AuthClient(request, config));
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
});

export { expect } from '@playwright/test';
