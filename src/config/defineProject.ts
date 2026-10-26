import type { APIRequestContext, BrowserContextOptions, Page } from '@playwright/test';
import type { EnvConfig, TestUser } from './env';

/** A bearer token from the app's API login, and how long it lives. */
export interface LoginResult {
  token: string;
  expiresInSeconds: number;
}

/** A browser storage state as an object, as Playwright's `storageState` option takes it. */
export type BrowserState = Exclude<NonNullable<BrowserContextOptions['storageState']>, string>;

/**
 * What the framework's core needs from the project: how its app marks elements for tests, how a user logs in, and
 * what runs around a test run. The project's own is `src/config/project.ts`, built with `defineProject`.
 */
export interface Project {
  /** The attribute the app marks elements with for tests; `page.getByTestId()` looks it up. */
  testIdAttribute: string;
  /**
   * Logs `user` in through the API and returns the bearer token; `TokenService` calls it for each role's token.
   * Throws an `ApiError` with the status when the API answers with an error, so the failure can name the role.
   */
  login(args: { request: APIRequestContext; config: EnvConfig; user: TestUser }): Promise<LoginResult>;
  /** The browser storage state of a page logged in with `token`: UI tests start with it (`authMode: 'api'`). */
  browserState(baseUrl: string, token: string): BrowserState;
  /**
   * Logs `user` in through the app's login page, for `UI_AUTH_MODE=storageState` (globalSetup then saves the browser's
   * state). Throws with the app's message when the login fails.
   */
  uiLogin?(args: { page: Page; config: EnvConfig; user: TestUser }): Promise<void>;
  /** Runs once before the tests, in globalSetup: for example, creates users for the run (`setRunUser`). */
  beforeRun?(): Promise<void>;
  /** Runs once after the tests, and also when globalSetup fails after `beforeRun`. It shouldn't throw. */
  afterRun?(): Promise<void>;
}

/** The project's `Project`, typed: `export const project = defineProject({ ... })`, like Playwright's `defineConfig`. */
export function defineProject(project: Project): Project {
  return project;
}
