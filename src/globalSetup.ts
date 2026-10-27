import { chromium, selectors } from '@playwright/test';
import { env, findInspectRequest, getUser, isRunUser, ROLES, storageStatePath } from './config/env';
import { project } from './config/project';
import { isStorageStateValid } from './ui/auth/authState';

/**
 * Runs once before all tests:
 * 1. The project's `beforeRun` (src/config/project.ts), for example creating users for the run (`setRunUser`).
 * 2. With UI_AUTH_MODE=storageState only: logs in every role through the app's login page (`project.uiLogin`) and
 *    saves `.auth/<role>.json`, which the `storageState` fixture then loads. In the default `api` mode, UI tests get a
 *    fresh API token per test instead.
 * The returned function is the global teardown: the project's `afterRun` (for example, deleting those users).
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  // A logged-out page inspection (npm run inspect:ui -- <path> --logged-out) needs no user at all.
  if (findInspectRequest()?.role === 'none') return async () => undefined;

  const afterRun = async (): Promise<void> => {
    await project.afterRun?.();
  };

  await project.beforeRun?.();
  try {
    await saveUiLogins();
  } catch (error) {
    // Playwright skips the teardown when setup fails, so run afterRun here.
    await afterRun();
    throw error;
  }
  return afterRun;
}

/**
 * Locally, a configured user's saved state is reused while its token is still valid; on CI it is always regenerated.
 * The state of a user created for the run (`setRunUser`) is always new.
 */
async function saveUiLogins(): Promise<void> {
  if (env.uiAuthMode !== 'storageState') return;

  const { uiLogin } = project;
  if (!uiLogin) {
    throw new Error('UI_AUTH_MODE=storageState needs project.uiLogin in src/config/project.ts: how a user logs in through the app.');
  }

  const roles = ROLES.filter(
    (role) => isRunUser(role) || env.isCI || !isStorageStateValid(storageStatePath(role))
  );
  const reused = ROLES.filter((role) => !roles.includes(role));
  if (reused.length) console.log(`Reusing saved login for: ${reused.join(', ')}`);
  if (!roles.length) return;

  // This browser is launched outside the test runner, so the config's `use` options don't apply here.
  selectors.setTestIdAttribute(project.testIdAttribute);
  const browser = await chromium.launch();

  try {
    for (const role of roles) {
      const context = await browser.newContext({ baseURL: env.baseUrl });
      context.setDefaultTimeout(env.defaultTimeoutMs);
      context.setDefaultNavigationTimeout(env.extendedTimeoutMs);
      const page = await context.newPage();

      try {
        await uiLogin({ page, config: env, user: getUser(role) });
      } catch (error) {
        throw new Error(`UI login failed for "${role}" user: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      }

      await context.storageState({ path: storageStatePath(role) });
      await context.close();
      console.log(`Saved login for "${role}" -> ${storageStatePath(role)}`);
    }
  } finally {
    await browser.close();
  }
}
