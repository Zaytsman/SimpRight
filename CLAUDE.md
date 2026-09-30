# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

SimpRight is an automated test framework built with TypeScript and Playwright, covering both UI and API testing. It is in early scaffolding: the core layers and a few example tests exist, and most of the app is not covered yet.

## Commands

```bash
npm install
npm run install:browsers          # Chromium + OS deps
npm test                          # all projects (api, ui); globalSetup logs in first
npm run test:api                  # API project only
npm run test:ui                   # UI project only
npx playwright test tests/ui/cart/add-to-cart.spec.ts   # single file
npx playwright test -g "UI-CART-001"                    # single test by scenario ID
npm run typecheck                 # tsc --noEmit (TypeScript 7)
npm run report                    # open last HTML report
```

## Playwright setup (playwright.config.ts)

- **UI login has two modes**, selected with `UI_AUTH_MODE` (`env.uiAuthMode`) or per file with `test.use({ authMode: ... })`. The app keeps its JWT in `localStorage['auth-token']` (no auth cookie), and the JWT expires after **5 minutes** (see `src/ui/auth/authState.ts`).
  - `api` (default): the UI `storageState` fixture gets a token for the test's role from `tokenService` and injects it into localStorage. There's no UI login and nothing is written to disk. Tokens are refreshed when fewer than 2 minutes are left, which is longer than the test timeout.
  - `storageState`: `globalSetup` (`src/globalSetup.ts`) logs in every role in `USER_ROLES` through `LoginPage` and saves `.auth/<role>.json` (git-ignored, holds a live JWT). Locally, a saved state is reused while its token has more than 2 minutes left; on CI it is always regenerated. A role that fails to log in fails the run. In `api` mode `globalSetup` does nothing.
  - `test.use({ authMode: 'storageState' })` only works when the run itself uses `UI_AUTH_MODE=storageState`; otherwise the fixture throws "No valid saved login".
- `api` project: `tests/api`. No browser; `baseURL` = `env.apiBaseUrl`.
- `ui` project: `tests/ui`. Desktop Chrome; `baseURL` = `env.baseUrl`.
- `testIdAttribute` is `data-test` (`TEST_ID_ATTRIBUTE` in `BasePage.ts`), which is what the site uses. Prefer `page.getByTestId(...)` locators.
- On CI (`CI` set): 2 retries, 2 workers, JUnit output and `forbidOnly`.

## Fixtures

Specs import from `src/fixtures` (`index.ts`): `test`, `expect` and `openHomePageTest`.
- `src/fixtures/base.ts` holds the fixtures shared by both layers: `role` (option, default `'default'`; set with `test.use({ role: 'admin' })`), `config` and `tokenService` (worker scope), and `user`.
- `src/api/fixtures/fixtures.ts` and `src/ui/fixtures/fixtures.ts` each extend base. `src/fixtures/fixtures.ts` combines them with `mergeTests`. Fixtures are lazy, so a UI test that doesn't ask for `accessToken` never logs in through the API.
- The UI fixtures set `storageState` from `role` and `authMode`, so a test starts logged in as its role. For logged-out tests, use `test.use({ storageState: { cookies: [], origins: [] } })`.
- New page, component, grid and dialog fixtures go in `src/ui/fixtures/fixtures.ts`. Precondition variants go in their own file in `src/fixtures/` (like `openHomePage.ts`) and are exported from `index.ts`.

## UI layer

- Pages extend `BasePage(page, config)`: they expose locators as `readonly` fields assigned in the constructor, a public `open()` that calls the protected `goto('/path')`, and actions. Every page has `navBar` (`components/NavBar.ts`).
- Reusable parts of pages go in `pages/components/`, like `ProductGrid` (exposed as `homePage.productGrid`). Multi-page journeys go in `src/ui/flows/`, like `ShoppingFlow.addProductToCart(name, qty)`, and are exposed as fixtures too.
- Wait for the app's own signals, never fixed sleeps. For example, `HomePage.search()` waits for the `search_completed` marker, and `ProductPage.addToCart()` waits for the "Product added" toast.
- Dialogs extend `BaseDialog(page, config, root?)`. `root` defaults to `getByRole('dialog')`, and the buttons are scoped to it.
- After login, admin lands on `/admin/dashboard` and a customer on `/account`. `navBar.userMenu` is visible only when logged in, so use it to check that login succeeded.

## Layout

- `src/`: framework code; `tests/`: specs only (no page logic in specs).
- `src/api/`: `clients` (low-level HTTP over `APIRequestContext`), `services` (domain operations built on clients), `dto` (request/response types), `auth`, `fixtures`, `coverage` (the optional API coverage plug-in).
- `src/ui/`: `pages` (page objects, with reusable `components` and `dialogs`; `filters` and `grids` when needed), `flows` (multi-page user journeys), `auth` (token/storage-state helpers), `fixtures`.
- `src/fixtures/`: merges the API and UI fixtures (`mergeTests`) into the single `test`/`expect` that specs import.
- `src/globalSetup.ts`: UI login for `storageState` mode.
- `src/config/`: typed env access. `src/envs/`: per-environment JSON. `src/utils/`: helpers.
- `test-scenarios/` (`api/`, `ui/`): the source of truth for what gets automated. One agent writes scenarios here; another agent picks them up and implements them as specs in `tests/`. Keep scenarios and specs in sync, and don't invent coverage that no scenario describes.
- `docs/api/contracts/`: API contracts, one markdown file per API area (see "API contracts").

## Scenarios and specs conventions

- **Scenario files:** one markdown file per area (`test-scenarios/ui/cart.md`). Each scenario is a `## <ID>: <title>` section with **Role**, **Automated in** (the spec path), **Steps** and **Expected**. API scenarios also give **Endpoint** and **Auth**. IDs are `UI-<AREA>-NNN` / `API-<AREA>-NNN`.
- **Specs:** `tests/<ui|api>/<area>/<name>.spec.ts`, with a `// Scenarios: <path>` comment at the top and the scenario ID at the start of the test title (`'UI-CART-001: ...'`), so a spec can be traced back to its scenario.
- **Imports:** specs import from `@fixtures` (`test`, `expect`, `openHomePageTest`) and use fixtures for pages, flows, clients and services. They never construct them or call `page.goto` directly.
- **API assertions:** happy paths use a service (it returns parsed, typed bodies and throws on non-2xx). Status-code checks, especially error codes, use the client and assert `response.status`.
- **Contracts:** when a spec calls a new endpoint, add or extend its contract in `docs/api/contracts/` (see "API contracts" below), documenting only behavior that was checked against the real API.

Path aliases (tsconfig `paths`, resolved by Playwright): `@fixtures` (= `src/fixtures/index.ts`), `@api/*`, `@ui/*`, `@config/*`, `@data/*`, `@fixtures/*`, `@utils/*`.

## Configuration

- `src/envs/<NAME>.json` (committed) holds per-environment settings: `baseUrl`, `apiBaseUrl`, timeouts, and `testUsers` with `${VAR}` placeholders for secrets. Pick one with `TEST_ENV` (default `TEST`, case-insensitive); adding an environment means adding a JSON file.
- `.env` (git-ignored, never commit) holds only secrets: `ADMIN_USER`, `ADMIN_PASSWORD`, `DEFAULT_USER`, `DEFAULT_PASSWORD`.
- `src/config/env.ts` loads `.env`, reads the selected JSON, fills in the placeholders (`resolvePlaceholders` in `src/utils/envUtils.ts`), validates it, and exports a frozen `env`, `getUser(role)` and `storageStatePath(role)`. Everything stays in memory; never write resolved config (which contains passwords) to disk.
- Everything reads config through `@config/env`, including `playwright.config.ts`. Don't read `process.env` directly in tests or page objects.
- Timeouts: `defaultTimeoutMs` sets the action and `expect` timeouts; `extendedTimeoutMs` sets the test and navigation timeouts.

## API layer

- **Clients** extend `src/api/clients/BaseClient.ts`: one client per API area, with methods that map 1:1 to endpoints (`get/post/put/patch/delete` return `ApiResponse` with `status` and a raw `body` string). Always send HTTP through `BaseClient.executeRequest`: it uses Playwright's `APIRequestContext`, so calls appear in traces. Don't call `fetch` or `request.get` directly.
- **`BaseClient.onApiCall(listener)`** is called after every request of every client in the worker, with the method, URL, path, query string, request body, status (0 when the request failed) and duration. It returns a function that removes the listener. A listener that throws only logs a warning.
- **API coverage (optional):**
  - `src/api/coverage/apiCoverage.ts` loads the private package `@zaytsman/playwright-api-coverage` when it's installed.
  - The auto worker fixture `apiCoverage` (`src/fixtures/base.ts`) then records every call through `onApiCall`.
  - `playwright.config.ts` adds the package's reporter. It compares the calls with `docs/api/contracts/` and writes `test-results/api-coverage/` (`index.html`, `summary.json`).
  - Without the package, both do nothing. **Never import the package directly**: forks and their pull requests don't have it, so it must stay optional.
  - `DISABLE_API_COVERAGE=true` turns it off. A CLI `--reporter` also turns it off, because it replaces the configured reporters.
- **Services** (`src/api/services/`) wrap clients with domain operations and parsing; **DTOs** (`src/api/dto/`) type the request and response bodies.
- **Auth:** `POST /users/login` with `{ email, password }` returns `access_token` and `expires_in` (300s). `TokenService` (worker-scoped) logs in each role once per worker and refreshes the token 2 minutes before it expires. The JWT's `role` claim is `admin` or `user`; `/users/me` returns `role` only for admin.
- **Fixtures** (`src/api/fixtures/fixtures.ts`): `accessToken` (for the test's `role`, from the shared `tokenService`) and `authClient`. Register new clients and services here, built from `request`, `config` and `accessToken`.

## API contracts

`docs/api/contracts/*.md` document the endpoints the tests use, one file per API area. Keep every contract in this format, so tooling can read them:

````md
# Products API Documentation            <- H1 = service name ("API Documentation" is stripped)

### 1. Get product by id                <- one ### section per endpoint

**Endpoint:** `GET /products/{productId}`   <- paths relative to apiBaseUrl; {param} or :param

**Path Parameters:** / **Query Parameters:**   <- markdown table (Parameter | Type | Required | Description) or "- `name` (type, required): desc"

**Request Body:**
```ts
{ name: string; description?: string; }  <- "?" marks a field optional
```

**Response:** `200 OK`                  <- optionally followed by a ```ts/json block with the response shape

**Error Responses:**
- `404 Not Found`
````

## CI and GitHub Pages

- `.github/workflows/playwright-run.yml` is a reusable workflow: it runs one project (`ui` or `api`), then publishes the report with `scripts/publish-report.sh <family>`. The callers are `run-ui-tests.yml` / `run-api-tests.yml` (scheduled, weekdays, UTC) and `custom-ui-tests.yml` / `custom-api-tests.yml` (manual, with an area choice plus an optional `--grep`). When you add a folder under `tests/ui` or `tests/api`, add it to the `area` options of the matching custom workflow.
- Secrets `ADMIN_USER`, `ADMIN_PASSWORD`, `DEFAULT_USER` and `DEFAULT_PASSWORD` come from GitHub Secrets as environment variables; CI doesn't write a `.env` file.
- On CI, Playwright also writes `test-results/results.json`, which the dashboard reads.
- The publish script commits to the `gh-pages` branch: `<family>/run-<N>/` (report and `results.json`), `latest/<family>/` and `<family>-manifest.json`. It keeps the latest 30 runs per family (`KEEP_RUNS`) and retries the push if another workflow published first. Families: `daily-ui-regression`, `daily-api-regression`, `custom-ui`, `custom-api`.
- `index.html` in the repo root is the Pages dashboard. It's copied to `gh-pages` on every publish and loads the manifests and `results.json` files. Tests show up under "Known Issues" when they have an annotation whose description contains `Known issue`.
- API coverage is optional: when a run produces `test-results/api-coverage/`, the script publishes it with the run (and as `latest/api-coverage/` from the full API regression), and the dashboard shows its elements (`data-coverage`) only when `latest/api-coverage/summary.json` exists. UI runs set `DISABLE_API_COVERAGE=true`.
- `scripts/*.sh` must keep LF line endings (`.gitattributes`).
- `pr-checks.yml` runs the `verify` job (typecheck + all tests) on every pull request to `main` or `develop`; it's the required status check on `main`. Pull requests from forks and from Dependabot get no Actions secrets, so they run the typecheck only (Dependabot PRs run the tests too when the same four secrets are added under Dependabot secrets).

## Branches and pull requests

- `main` is the default branch and holds stable code only. Scheduled workflows run on it, so the nightly regressions and the dashboard reflect merged code. A ruleset blocks direct pushes, force pushes and deletion: changes arrive only through a pull request that passes `verify`, merged with a **merge commit** (squash and rebase are disabled).
- `develop` is where work happens: commit and push there directly (or use short-lived `feature/...` branches with a PR into `develop` for bigger changes). Force pushes and deletion are blocked.
- Release to `main` with a pull request `develop` → `main`. Never squash it: squashing a long-lived branch makes `develop` and `main` diverge.
- Dependabot version updates target `develop`. Security updates always target `main`; after merging one, merge `main` back into `develop` (`git switch develop && git merge origin/main`).
- Claude works on `develop` (or a feature branch), never commits or pushes to `main`, and leaves opening and merging pull requests to the user unless asked.
- Never add workflows triggered by `pull_request_target` that check out pull request code: that runs untrusted code with access to secrets.
