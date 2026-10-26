import { test as base } from '@playwright/test';
import {
  DEFAULT_ROLE,
  env,
  getUser,
  storageStatePath,
  type EnvConfig,
  type TestUser,
  type UiAuthMode,
  type UserRole,
} from '../config/env';
import { project } from '../config/project';
import { TokenService } from '../api/auth/TokenService';
import { BaseClient } from '../api/clients/BaseClient';
import { loadApiCoverage, toCoverageCall } from '../api/coverage/apiCoverage';
import { isStorageStateValid } from '../ui/auth/authState';

/** How a test starts: logged in with one of the `UiAuthMode`s, or `none` (logged out, no login at all). */
export type AuthMode = UiAuthMode | 'none';

export type BaseOptions = {
  /** Which test user the test acts as. Override per file or describe with `test.use({ role: 'admin' })`. */
  role: UserRole;
  /**
   * How the test starts logged in; defaults to UI_AUTH_MODE (see `UiAuthMode`). `none` skips the login:
   * the `api` project sets it, so only API tests that ask for a token log in.
   */
  authMode: AuthMode;
};

/** Undo steps for records a test creates; see the `cleanup` fixture. */
export interface Cleanup {
  /** Registers a step that removes a record this test created, e.g. `cleanup.add(() => productsService.delete(id))`. */
  add(task: () => Promise<unknown>): void;
}

export type BaseFixtures = {
  user: TestUser;
  cleanup: Cleanup;
};

export type BaseWorkerFixtures = {
  config: EnvConfig;
  tokenService: TokenService;
  apiCoverage: void;
};

/**
 * Fixtures shared by the API and UI layers; both extend this so `role`, `config`, `user`, `tokenService` and the
 * logged-in start (`authMode`, `storageState`) exist once (UI tests use API tokens to start logged in).
 */
export const test = base.extend<BaseOptions & BaseFixtures, BaseWorkerFixtures>({
  role: [DEFAULT_ROLE, { option: true }],
  authMode: [env.uiAuthMode, { option: true }],

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
      await use(new TokenService(request, config, project.login));
      await request.dispose();
    },
    { scope: 'worker' },
  ],

  // Records every API call for the optional coverage report; does nothing without the coverage package.
  apiCoverage: [
    async ({}, use) => {
      const coverage = loadApiCoverage();
      const stop = coverage ? BaseClient.onApiCall((call) => coverage.recordApiCall(toCoverageCall(call))) : undefined;
      await use();
      stop?.();
    },
    { scope: 'worker', auto: true },
  ],

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

    await use(project.browserState(config.baseUrl, await tokenService.getAccessToken(role)));
  },

  user: async ({ role }, use) => {
    await use(getUser(role));
  },

  // Runs the registered undo steps after the test, pass or fail, newest first. Test-scoped on purpose:
  // clients and services are built on the test-scoped `request`, so `afterAll` can't use them.
  // A failing step only logs a warning, so cleanup never hides the test's own result.
  cleanup: async ({}, use) => {
    const tasks: (() => Promise<unknown>)[] = [];
    await use({ add: (task) => tasks.push(task) });
    for (const task of tasks.reverse()) {
      await task().catch((error: unknown) => console.warn('[cleanup] An undo step failed:', error));
    }
  },
});
