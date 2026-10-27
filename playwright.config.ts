import { defineConfig, devices } from '@playwright/test';
import { apiCoverageReporter } from './src/api/coverage/apiCoverage';
import { env, findInspectRequest } from './src/config/env';
import { project } from './src/config/project';
import type { BaseOptions } from './src/fixtures/base';

const { isCI } = env;
// Set only by `npm run inspect:ui` (scripts/inspect-ui.mts); a normal run has no `inspect` project.
const inspectRequest = findInspectRequest();

// The config is re-evaluated in every worker; log only from the main process.
if (!process.env.TEST_WORKER_INDEX) {
  console.log(`Running against ${env.name}: ${env.baseUrl} (API: ${env.apiBaseUrl})`);
}

export default defineConfig<BaseOptions>({
  testDir: './tests',
  // Runs the project's beforeRun (src/config/project.ts) and, after the run, its afterRun. With
  // UI_AUTH_MODE=storageState it also logs in every role through the UI and saves .auth/<role>.json.
  globalSetup: './src/globalSetup.ts',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  timeout: env.extendedTimeoutMs,
  expect: { timeout: env.defaultTimeoutMs },
  reporter: [
    ['list'],
    ['html', { open: isCI ? 'never' : 'on-failure' }],
    ...(isCI ? [['junit', { outputFile: 'test-results/junit.xml' }] as const] : []),
    // Read by the step-title check and, when the project has the portal, by its dashboard (trends, known issues).
    ...(isCI ? [['json', { outputFile: 'test-results/results.json' }] as const] : []),
    // Optional: compares the API calls with docs/api/contracts -> test-results/api-coverage/ (skipped without the package).
    ...apiCoverageReporter({ docDir: 'docs/api/contracts' }),
  ],

  use: {
    baseURL: env.baseUrl,
    testIdAttribute: project.testIdAttribute,
    // Off: a trace stores every request and response unmasked (login bodies with passwords, tokens), and the reports are published.
    trace: 'off',
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
        // No UI login: API tests log in only through the fixtures that need a token.
        authMode: 'none',
      },
    },
    {
      name: 'ui',
      testDir: './tests/ui',
      use: {
        ...devices['Desktop Chrome'],
        // A visible browser locally, headless on CI (HEADLESS overrides it).
        headless: env.headless,
      },
    },
    // The page inspector for writing UI tests: prints a page's accessibility tree and data-test elements.
    ...(inspectRequest
      ? [
          {
            name: 'inspect',
            testDir: './scripts/inspect-ui',
            use: {
              ...devices['Desktop Chrome'],
              ...(inspectRequest.role === 'none'
                ? { authMode: 'none' as const }
                : { role: inspectRequest.role }),
            },
          },
        ]
      : []),
  ],
});
