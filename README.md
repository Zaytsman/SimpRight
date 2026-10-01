# SimpRight

Automated test framework built with **TypeScript + Playwright**. It covers UI and API tests for the [Practice Software Testing](https://practicesoftwaretesting.com) Toolshop demo app ([API](https://api.practicesoftwaretesting.com)).

**What's included**
- UI tests using page objects, reusable components and multi-page flows
- API tests using typed clients, services and DTOs
- One set of fixtures shared by both layers, with role-based test users (`admin`, `default`)
- Tests start already logged in, either through an API token (default) or a saved UI login
- Per-environment config (`TEST`, and more to come), with secrets kept in `.env`
- Test scenarios in markdown as the source of truth for what gets automated, and API contracts documenting the endpoints under test

## Prerequisites

- Node.js 20 or later (developed on 24)
- npm

## Setup

```bash
npm install
npm run install:browsers
```

Copy `.env.example` to `.env` in the project root and fill in the test users. `.env` is git-ignored, so never commit it.

```dotenv
ADMIN_USER=<admin email>
ADMIN_PASSWORD=<admin password>
DEFAULT_USER=<customer email>
DEFAULT_PASSWORD=<customer password>
```

> **Windows / PowerShell:** if `npx` or `npm` fails with *"...ps1 cannot be loaded... not digitally signed"*, run
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once. Otherwise, use `npx.cmd` / `npm.cmd` or a different terminal (cmd, Git Bash).

## Running tests

| Command | What it does |
|---|---|
| `npm test` | All tests (API + UI) |
| `npm run test:api` | API tests only |
| `npm run test:ui` | UI tests only |
| `npm run test:headed` | UI tests with a visible browser |
| `npm run test:debug` | Playwright Inspector |
| `npm run report` | Open the last HTML report |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |

Single file or single test:

```bash
npx playwright test tests/ui/cart/add-to-cart.spec.ts
npx playwright test -g "UI-CART-001"
```

### Options (environment variables)

| Variable | Values | Default | Purpose |
|---|---|---|---|
| `TEST_ENV` | name of a file in `src/envs/` | `TEST` | Environment to run against |
| `UI_AUTH_MODE` | `api`, `storageState` | `api` | How UI tests start logged in (see below) |
| `CI` | any value | not set | Enables retries, 2 workers, JUnit output and `forbidOnly` |

PowerShell example: `$env:TEST_ENV="QA"; npm test`. Git Bash example: `TEST_ENV=QA npm test`.

## Environments

Each environment is a JSON file in `src/envs/` (e.g. `TEST.json`) containing `baseUrl`, `apiBaseUrl`, timeouts and test users. Credentials are written as `${VAR}` placeholders and filled in from `.env` when tests start. To add an environment, add another file (e.g. `QA.json`) and run with `TEST_ENV=QA`. Name the file in capitals.

The configuration is checked when tests start. An unknown environment, an invalid URL or a missing `.env` variable fails straight away with a clear message.

## Logging in

Tests act as one of the users in `testUsers` (`admin`, `default`). Choose one per file or `describe` with `test.use({ role: 'admin' })`; the default is `default`. API tests get a token for that user through `POST /users/login`. It's cached per worker and refreshed before it expires.

The site keeps its session token in the browser's `localStorage` (no cookie). The token expires after **5 minutes**. UI tests start already logged in, in one of two ways:

- **`api` mode (default):** each UI test gets a fresh token for its user through the API, and it's placed in the browser before the test starts. There's no UI login and nothing is written to disk.
- **`storageState` mode** (`UI_AUTH_MODE=storageState`): before the run, `src/globalSetup.ts` logs in each user through the login page and saves `.auth/<role>.json` (git-ignored). Locally, a saved login is reused while its token is still valid.

For tests that should start logged out, use `test.use({ storageState: { cookies: [], origins: [] } })`.

## Project structure

```
src/
  config/env.ts          environment config, test users, login mode
  envs/                  per-environment JSON (TEST.json, ...)
  fixtures/              shared fixtures; index.ts is what specs import (`@fixtures`)
  api/
    clients/             one client per API area, on top of BaseClient
    services/            domain operations over clients, returning typed results
    dto/                 request/response types
    auth/                TokenService (per-role token cache)
    coverage/            optional API coverage plug-in
    fixtures/            API fixtures
  ui/
    pages/               page objects (+ components/, dialogs/)
    flows/               multi-page user journeys
    auth/                token/storage-state helpers
    fixtures/            UI fixtures
  utils/                 helpers
  globalSetup.ts         UI login for storageState mode
tests/
  api/<area>/*.spec.ts
  ui/<area>/*.spec.ts
test-scenarios/          scenario source of truth (api/, ui/)
docs/api/contracts/      API contracts, the reference for API coverage
```

## Writing tests

1. **Describe the scenario** in `test-scenarios/<ui|api>/<area>.yml` under an ID such as `UI-CART-002`, with its name, the spec path (`automatedIn`) and steps. Checks are steps that start with `Verify`; `test-scenarios/scenarios.schema.json` describes the format.
2. **Add what the test needs:** page objects, components or flows (UI), or clients, services and DTOs (API). Register them as fixtures in `src/ui/fixtures/fixtures.ts` or `src/api/fixtures/fixtures.ts`.
3. **Write the spec** in `tests/<ui|api>/<area>/`. Import `test` and `expect` from `@fixtures`, and start the title with the scenario ID.
4. **For new API endpoints**, document them in `docs/api/contracts/`.

```ts
import { test, expect } from '@fixtures';

// Scenarios: test-scenarios/ui/cart.yml
test('UI-CART-001: add a product with quantity 2 to the cart', async ({ shoppingFlow, productPage }) => {
  const { unitPrice } = await shoppingFlow.addProductToCart('Combination Pliers', 2);
  await expect(productPage.navBar.cartQuantity).toHaveText('2');

  const cartPage = await shoppingFlow.goToCart();
  expect(await cartPage.getTotal()).toBeCloseTo(unitPrice * 2, 2);
});
```

Detailed conventions, such as locator strategy, fixture layout and contract format, are in [CLAUDE.md](CLAUDE.md).

## Reports

- **Playwright HTML report:** `playwright-report/`. Open it with `npm run report`. Traces, screenshots and videos are kept for failed tests.
- **API coverage report (optional):** `test-results/api-coverage/index.html`, see below.

### API coverage (optional)

The API coverage report shows which of the endpoints, status codes, request fields and query parameters documented in `docs/api/contracts/` the tests actually exercise. It also lists calls to endpoints that aren't documented.

The reporter comes from a private package, `@zaytsman/playwright-api-coverage`. SimpRight loads it only when it's installed. Without it, everything runs the same, just without this report. The recorder keeps only the shape of each request (field and parameter names, never their values), so the report is safe to publish. The nightly API regression publishes it to the dashboard. Set `DISABLE_API_COVERAGE=true` to turn it off.

The package is an optional dependency, and the repo's `.npmrc` points the `@zaytsman` scope at GitHub Packages. Without access, `npm install` quietly skips it. **With access**, add a GitHub token (classic, with `read:packages`) to your **user** `~/.npmrc`, never to the repo, and run `npm install` again. `.npmrc.example` shows the line:

```ini
//npm.pkg.github.com/:_authToken=<your token>
```

## CI and dashboard

GitHub Actions runs the tests and publishes every report to GitHub Pages: **[zaytsman.github.io/SimpRight](https://zaytsman.github.io/SimpRight/)**.

| Workflow | When | What |
|---|---|---|
| API Regression Test Run | weekdays 02:00 UTC, or by hand | all API tests |
| UI Regression Test Run | weekdays 06:00 UTC, or by hand | all UI tests |
| Custom API / UI Test Run | by hand | one area (a folder in `tests/`), optionally filtered by a title (`--grep`) |

The dashboard shows the latest status, test counts, known issues, pass/fail, duration and failure-rate trends, and the history of the last runs, each linking to its full Playwright report. Every report family keeps its latest 30 runs.

To run it in your own fork, add the `ADMIN_USER`, `ADMIN_PASSWORD`, `DEFAULT_USER` and `DEFAULT_PASSWORD` repository secrets. After the first run creates the `gh-pages` branch, turn on GitHub Pages from that branch.

## Branches and contributing

- `main` is the stable, protected branch: changes reach it only through pull requests that pass the `verify` check (typecheck and all tests).
- Day-to-day work happens on `develop`, which is merged into `main` with a pull request.
- To contribute, fork the repo, branch from `develop`, and open a pull request into `develop`.
- Found a security problem? See [SECURITY.md](SECURITY.md).

## Current tests

| ID | Type | Test |
|---|---|---|
| UI-PROD-001 | UI | Search by name shows only matching products |
| UI-CART-001 | UI | Add a product with quantity 2 to the cart |
| API-PROD-001 | API | Product search returns only matching products |
| API-USER-001 | API | `GET /users/me` returns the logged-in user's profile |
