import { apiLogin } from '../api/auth/apiLogin';
import { createRunUser, deleteRunUser } from '../api/auth/runUser';
import { LoginPage } from '../ui/pages/LoginPage';
import { defineProject } from './defineProject';
import { env } from './env';

/** localStorage key where the app keeps its JWT (the site sets no auth cookie). */
const AUTH_TOKEN_KEY = 'auth-token';

/**
 * The site re-seeds every hour at :00 UTC and deletes every user, the run's customer included, so a run
 * that crosses the hour fails every later test of the `default` role. A full run takes about 10 minutes,
 * so on CI a run that would start in the unsafe minutes waits until the re-seed is over.
 */
const LAST_SAFE_START_MINUTE = 44;
const FIRST_SAFE_MINUTE_AFTER_RESEED = 3;

/**
 * How the framework's core reaches the Toolshop (practicesoftwaretesting.com): its test ids, its logins and what runs
 * around a test run. The roles are in `roles.ts`; URLs, timeouts and the configured users in `src/envs/<ENV>.json`.
 */
export const project = defineProject({
  testIdAttribute: 'data-test',

  login: apiLogin,

  browserState: (baseUrl, token) => ({
    cookies: [],
    origins: [{ origin: new URL(baseUrl).origin, localStorage: [{ name: AUTH_TOKEN_KEY, value: token }] }],
  }),

  uiLogin: async ({ page, config, user }) => {
    const loginPage = new LoginPage(page, config);
    await loginPage.open();
    await loginPage.login(user.username, user.password);

    // Wait for either outcome, so a wrong password fails fast with the site's own message.
    await loginPage.navBar.userMenu.or(loginPage.errorMessage).first().waitFor();
    if (await loginPage.errorMessage.isVisible()) {
      const message = (await loginPage.errorMessage.textContent())?.trim();
      throw new Error(`"${message}". Check credentials in .env.`);
    }
  },

  // Each run registers its own customer, the `default` role (see runUser.ts), and deletes it afterwards.
  beforeRun: async () => {
    if (env.isCI) await waitForReseedWindow();
    await createRunUser();
  },
  afterRun: deleteRunUser,
});

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
