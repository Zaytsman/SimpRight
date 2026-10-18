# 2. Configuration

Everything that differs between environments or machines (URLs, timeouts, credentials, how the browser runs) is read in one place, [`src/config/env.ts`](../../src/config/env.ts), and handed to the rest of the code as a frozen, typed `env` object. Nothing else reads `process.env`, apart from the few runtime variables listed at the end of this page.

## The sources

| Source | Committed | Holds |
|---|---|---|
| `src/envs/<NAME>.json` | yes | `baseUrl`, `apiBaseUrl`, `defaultTimeoutMs`, `extendedTimeoutMs`, and `testUsers` (the admin only) with `${VAR}` placeholders for its credentials |
| `.env` | **no** (git-ignored) | Only secrets: `ADMIN_USER`, `ADMIN_PASSWORD` |
| `.env.example` | yes | The same keys with empty values; kept in sync when a secret is added |
| Environment variables | | On CI the secrets come from GitHub Secrets as variables; CI writes no `.env` |

`TEST_ENV` picks the JSON file (default `TEST`, case-insensitive), so adding an environment means adding `src/envs/QA.json` and running with `TEST_ENV=QA`.

## How `env.ts` loads it

1. `dotenv` loads `.env` (quietly; a missing file is fine on CI).
2. The selected JSON is read, and `resolvePlaceholders` ([`src/utils/envUtils.ts`](../../src/utils/envUtils.ts)) replaces every `${VAR}` with `process.env.VAR`. It collects **all** missing variables and throws once, so a new machine sees every gap in one message.
3. Every field is validated: URLs must be `http(s)` (a trailing `/` is dropped), timeouts must be positive numbers, each configured role needs a username and a password. An unknown `TEST_ENV`, `UI_AUTH_MODE` or `HEADLESS` value fails with the list of allowed values.
4. The result is `Object.freeze`d and exported as `env`. Resolved config holds passwords, so it stays in memory and is never written to disk.

## `EnvConfig`

| Field | From | Used for |
|---|---|---|
| `name` | `TEST_ENV` | Logged at start: `Running against TEST: https://...` |
| `isCI` | `CI` (set by GitHub Actions) | Retries, workers, reporters, headless default, the re-seed wait |
| `uiAuthMode` | `UI_AUTH_MODE` (`api` default, or `storageState`) | How UI tests start logged in (below) |
| `headless` | `HEADLESS` (`true`/`false`); default: headless on CI, headed locally | The `ui` project's browser |
| `baseUrl`, `apiBaseUrl` | the JSON | The UI and API projects' `baseURL`; clients build URLs from `apiBaseUrl` |
| `defaultTimeoutMs` | the JSON (10 s) | Action and `expect` timeouts |
| `extendedTimeoutMs` | the JSON (60 s) | Test and navigation timeouts |
| `testUsers` | the JSON + secrets | The admin's credentials |

Helpers next to it: `getUser(role)` (the admin from `testUsers`, the `default` role from the run's customer), `storageStatePath(role)` (`.auth/<role>.json`), and `findInspectRequest()` for the page inspector.

## `playwright.config.ts`

It reads only `env`; it never touches `process.env` directly.

| Setting | Value | Why |
|---|---|---|
| `fullyParallel` | `true` | Every test is independent |
| `retries` / `workers` | CI: 1 / 2; locally 0 / Playwright's default | Fewer workers on CI keep the shared demo site's per-IP limits safe |
| `forbidOnly` | on CI | A stray `test.only` fails the run |
| `timeout`, `expect.timeout`, `actionTimeout`, `navigationTimeout` | from `env` | One place to tune |
| `testIdAttribute` | `data-test` (`TEST_ID_ATTRIBUTE` in `BasePage.ts`) | What the site uses, so `getByTestId` works |
| `trace` | `'off'` for every project | Traces store requests unmasked (passwords, tokens), and reports are public ([10](10-reporting-and-secrets.md)) |
| `screenshot`, `video` | on failure only | |
| reporters | `list`, `html`; on CI also `junit` and `json` (`test-results/results.json`); plus the optional API coverage reporter | [10](10-reporting-and-secrets.md) |

### Projects

| Project | `testDir` | Notes |
|---|---|---|
| `api` | `tests/api` | `baseURL` = `apiBaseUrl`; `authMode: 'none'`, so no API test logs in unless it asks for a token fixture |
| `ui` | `tests/ui` | Desktop Chrome, `headless` from `env` |
| `inspect` | `scripts/inspect-ui` | Exists only while `npm run inspect:ui` sets `SIMPRIGHT_INSPECT`, so `npm test` never runs it |

Why `api` sets `authMode: 'none'`: every test resolves the `storageState` fixture (Playwright's tracing reads the context options). Without `none`, each API test, even one for a public endpoint, would log the default user in, and one locked login would fail the whole API suite.

## The run's customer (the `default` role)

The demo site publishes its default customer's credentials, and other people's failed logins kept locking that account (423). So each run makes its own customer:

1. `globalSetup` calls `createRunUser()` ([`src/api/auth/runUser.ts`](../../src/api/auth/runUser.ts)): it registers a customer with `UserFactory.registerCustomer()` (unique email, random strong password) and checks that it can log in.
2. A 5xx answer or a dropped connection is retried with a new customer every 20 s for up to 4 minutes, because a delayed scheduled run can start during the site's hourly re-seed. Any other error (a 4xx, a wrong admin password) fails at once. The difference comes from `ApiError.status`, not from the error text.
3. The credentials reach the workers through `SIMPRIGHT_RUN_USER_ID`, `_EMAIL` and `_PASSWORD`, which only `env.ts` reads (`getRunUser()`). They're masked in reports like the admin's.
4. The teardown that `globalSetup` returns deletes the customer as admin; a failed delete only logs a warning. When setup itself fails after registering, it deletes the customer before rethrowing (Playwright skips the teardown then).

**The re-seed wait.** The site re-seeds at :00 UTC and deletes every user, including the run's customer. On CI, a run that would start between :45 and :02 waits until :03 (a full run takes about 10 minutes; the job timeout allows for the wait). Locally there's no wait: just don't start a run in that window.

## How UI tests start logged in

`authMode` (a test option, default `env.uiAuthMode`) decides what the UI `storageState` fixture returns:

| Mode | What happens |
|---|---|
| `api` (default) | `tokenService.getAccessToken(role)` logs in through the API, and `tokenStorageState()` puts the JWT into `localStorage['auth-token']` for the app's origin. No UI login, nothing on disk. |
| `storageState` | `globalSetup` logs every role in through `LoginPage` and saves `.auth/<role>.json` (git-ignored; it holds a live JWT). Locally, a saved state is reused while its token has more than 2 minutes left; on CI it's always new. The `default` role's state is always new. |
| `none` | No login: the test starts logged out (`test.use({ authMode: 'none' })`, the `guest` role in scenarios). |

The app keeps its JWT in localStorage (no auth cookie), and the token lives 5 minutes. `TOKEN_EXPIRY_MARGIN_MS` (2 minutes) is the one margin for both cases: `TokenService` refreshes that long before expiry, and a saved state is reused only with that much left.

## Runtime variables

| Variable | Read by | Meaning |
|---|---|---|
| `TEST_ENV`, `UI_AUTH_MODE`, `HEADLESS`, `CI` | `env.ts` | Above |
| `DISABLE_API_COVERAGE=true` | the optional coverage package (its recorder and reporter) | No coverage recording or report (UI runs set it) |
| `SIMPRIGHT_RUN_USER_*` | `env.ts` | The run's customer, set by `globalSetup` |
| `SIMPRIGHT_INSPECT` | `env.ts` (`findInspectRequest`) | The page inspector's request; creates the `inspect` project |
| `PLAYWRIGHT_JSON_OUTPUT_NAME` | Playwright | Where a local `--reporter=json` writes, for `npm run check:step-titles` |

## Changed in the review

- `CI` is read only as `env.isCI` (it was read directly in `playwright.config.ts` and twice in `globalSetup.ts`).
- Two separate 2-minute token margins (in `TokenService` and `authState`) became one constant, `TOKEN_EXPIRY_MARGIN_MS`.
- The raw env file has its own type (`RawEnvFile`) instead of `Record<string, any>`.
- `runUser` tells a transient failure from a real one by `ApiError.status` instead of matching the error text.

Details: [13. Code review, October 2026](13-code-review-2026-10.md).
