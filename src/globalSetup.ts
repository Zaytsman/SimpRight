import { chromium, selectors } from '@playwright/test';
import { env, getUser, storageStatePath, USER_ROLES } from './config/env';
import { isStorageStateValid } from './ui/auth/authState';
import { TEST_ID_ATTRIBUTE } from './ui/pages/BasePage';
import { LoginPage } from './ui/pages/LoginPage';

/**
 * Runs once before all tests, and only does work with UI_AUTH_MODE=storageState: it logs in every role
 * through the UI and saves `.auth/<role>.json`, which the UI fixtures then load as `storageState`.
 * In the default `api` mode, UI tests get a fresh API token per test instead and nothing happens here.
 *
 * Locally, a role's saved state is reused while its token is still valid; on CI it is always regenerated.
 */
export default async function globalSetup(): Promise<void> {
  if (env.uiAuthMode !== 'storageState') return;

  const roles = USER_ROLES.filter((role) => process.env.CI || !isStorageStateValid(storageStatePath(role)));
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
