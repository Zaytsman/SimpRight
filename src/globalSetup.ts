import { chromium, selectors } from '@playwright/test';
import { createRunUser, deleteRunUser } from './api/auth/runUser';
import { env, findInspectRequest, getUser, storageStatePath, USER_ROLES } from './config/env';
import { isStorageStateValid } from './ui/auth/authState';
import { TEST_ID_ATTRIBUTE } from './ui/pages/BasePage';
import { LoginPage } from './ui/pages/LoginPage';

/**
 * The site re-seeds every hour at :00 UTC and deletes every user, the run's customer included, so a run
 * that crosses the hour fails every later test of the `default` role. A full run takes about 10 minutes,
 * so on CI a run that would start in the unsafe minutes waits until the re-seed is over.
 */
const LAST_SAFE_START_MINUTE = 44;
const FIRST_SAFE_MINUTE_AFTER_RESEED = 3;

/**
 * Runs once before all tests:
 * 0. On CI only: waits while a run started now would cross the hourly re-seed (see LAST_SAFE_START_MINUTE).
 * 1. Registers this run's customer (the `default` role) through the API. The returned function is the
 *    global teardown: it deletes the customer after the run.
 * 2. With UI_AUTH_MODE=storageState only: logs in every role through the UI and saves `.auth/<role>.json`,
 *    which the UI fixtures then load as `storageState`. In the default `api` mode, UI tests get a fresh
 *    API token per test instead.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  // A logged-out page inspection (npm run inspect:ui -- <path> --logged-out) needs no user at all.
  if (findInspectRequest()?.role === 'none') return async () => undefined;

  if (env.isCI) await waitForReseedWindow();
  await createRunUser();
  try {
    await saveUiLogins();
  } catch (error) {
    // Playwright skips the teardown when setup fails, so remove the customer here.
    await deleteRunUser();
    throw error;
  }
  return deleteRunUser;
}

/** Waits until :03 UTC when the current minute is :45–:02, so the run neither starts in nor crosses the re-seed. */
async function waitForReseedWindow(): Promise<void> {
  const now = new Date();
  const minute = now.getUTCMinutes();
  if (minute > LAST_SAFE_START_MINUTE || minute < FIRST_SAFE_MINUTE_AFTER_RESEED) {
    const resume = new Date(now);
    resume.setUTCMinutes(FIRST_SAFE_MINUTE_AFTER_RESEED, 0, 0);
    if (minute > LAST_SAFE_START_MINUTE) resume.setUTCHours(resume.getUTCHours() + 1);
    const waitMs = resume.getTime() - now.getTime();
    console.log(`[globalSetup] It's ${now.toISOString()}: waiting ${Math.ceil(waitMs / 60_000)} min until ${resume.toISOString()} so the run doesn't cross the site's hourly re-seed.`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

/**
 * Locally, the admin's saved state is reused while its token is still valid; on CI it is always regenerated.
 * The `default` role's state is always new, because each run registers a new customer.
 */
async function saveUiLogins(): Promise<void> {
  if (env.uiAuthMode !== 'storageState') return;

  const roles = USER_ROLES.filter(
    (role) => role === 'default' || env.isCI || !isStorageStateValid(storageStatePath(role))
  );
  const reused = USER_ROLES.filter((role) => !roles.includes(role));
  if (reused.length) console.log(`Reusing saved login for: ${reused.join(', ')}`);
  if (!roles.length) return;

  // This browser is launched outside the test runner, so the config's `use` options don't apply here.
  selectors.setTestIdAttribute(TEST_ID_ATTRIBUTE);
  const browser = await chromium.launch();

  try {
    for (const role of roles) {
      const context = await browser.newContext({ baseURL: env.baseUrl });
      context.setDefaultTimeout(env.defaultTimeoutMs);
      context.setDefaultNavigationTimeout(env.extendedTimeoutMs);
      const page = await context.newPage();
      const loginPage = new LoginPage(page, env);
      const { username, password } = getUser(role);

      await loginPage.open();
      await loginPage.login(username, password);

      // Wait for either outcome, so a wrong password fails fast with the site's own message.
      await loginPage.navBar.userMenu.or(loginPage.errorMessage).first().waitFor();
      if (await loginPage.errorMessage.isVisible()) {
        const message = (await loginPage.errorMessage.textContent())?.trim();
        throw new Error(`UI login failed for "${role}" user: "${message}". Check credentials in .env.`);
      }

      await context.storageState({ path: storageStatePath(role) });
      await context.close();
      console.log(`Saved login for "${role}" -> ${storageStatePath(role)}`);
    }
  } finally {
    await browser.close();
  }
}
