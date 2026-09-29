import { test as base } from '@playwright/test';
import { env, getUser, type EnvConfig, type TestUser, type UserRole } from '../config/env';
import { TokenService } from '../api/auth/TokenService';
import { AuthClient } from '../api/clients/AuthClient';

export type BaseOptions = {
  /** Which test user the test acts as. Override per file or describe with `test.use({ role: 'admin' })`. */
  role: UserRole;
};

export type BaseFixtures = {
  user: TestUser;
};

export type BaseWorkerFixtures = {
  config: EnvConfig;
  tokenService: TokenService;
};

/**
 * Fixtures shared by the API and UI layers; both extend this so `role`, `config`, `user` and
 * `tokenService` exist once (UI tests use API tokens to start logged in).
 */
export const test = base.extend<BaseOptions & BaseFixtures, BaseWorkerFixtures>({
  role: ['default', { option: true }],

  config: [
    async ({}, use) => {
      await use(env);
    },
    { scope: 'worker' },
  ],

  // Worker-scoped so each role logs in once per worker; it needs its own request context
  // because the built-in `request` fixture is test-scoped.
  tokenService: [
    async ({ playwright, config }, use) => {
      const request = await playwright.request.newContext();
      await use(new TokenService(new AuthClient(request, config)));
      await request.dispose();
    },
    { scope: 'worker' },
  ],

  user: async ({ role }, use) => {
    await use(getUser(role));
  },
});
