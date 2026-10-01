import { defineConfig, devices } from '@playwright/test';
import { apiCoverageReporter } from './src/api/coverage/apiCoverage';
import { env } from './src/config/env';
import { TEST_ID_ATTRIBUTE } from './src/ui/pages/BasePage';

const isCI = !!process.env.CI;

// The config is re-evaluated in every worker; log only from the main process.
if (!process.env.TEST_WORKER_INDEX) {
  console.log(`Running against ${env.name}: ${env.baseUrl} (API: ${env.apiBaseUrl})`);
}

export default defineConfig({
  testDir: './tests',
  // With UI_AUTH_MODE=storageState: logs in every role through the UI and saves .auth/<role>.json. No-op otherwise.
  globalSetup: './src/globalSetup.ts',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  timeout: env.extendedTimeoutMs,
  expect: { timeout: env.defaultTimeoutMs },
  reporter: [
    ['list'],
    ['html', { open: isCI ? 'never' : 'on-failure' }],
    ...(isCI ? [['junit', { outputFile: 'test-results/junit.xml' }] as const] : []),
    // Read by the GitHub Pages dashboard (index.html) for trends and known issues.
    ...(isCI ? [['json', { outputFile: 'test-results/results.json' }] as const] : []),
    // Optional: compares the API calls with docs/api/contracts -> test-results/api-coverage/ (skipped without the package).
    ...apiCoverageReporter({ docDir: 'docs/api/contracts' }),
  ],

  use: {
    baseURL: env.baseUrl,
    testIdAttribute: TEST_ID_ATTRIBUTE,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: env.defaultTimeoutMs,
    navigationTimeout: env.extendedTimeoutMs,
  },

  projects: [
    {
      name: 'api',
      testDir: './tests/api',
      use: {
        baseURL: env.apiBaseUrl,
      },
    },
    {
      name: 'ui',
      testDir: './tests/ui',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
