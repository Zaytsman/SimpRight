# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

SimpRight is an automated test framework built with TypeScript and Playwright, covering both UI and API testing. It is in early scaffolding: the config, API layer, UI layer and fixtures exist, but there are no specs yet.

## Commands

```bash
npm install
npm run install:browsers          # Chromium + OS deps
npm test                          # all projects (api, ui); globalSetup logs in first
npm run test:api                  # API project only
npm run test:ui                   # UI project only
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
- `src/api/`: `clients` (low-level HTTP over `APIRequestContext`), `services` (domain operations built on clients), `dto` (request/response types), `auth`, `fixtures`.
- `src/ui/`: `pages` (page objects, with reusable `components` and `dialogs`; `filters` and `grids` when needed), `flows` (multi-page user journeys), `auth` (token/storage-state helpers), `fixtures`.
- `src/fixtures/`: merges the API and UI fixtures (`mergeTests`) into the single `test`/`expect` that specs import.
- `src/globalSetup.ts`: UI login for `storageState` mode.
- `src/config/`: typed env access. `src/envs/`: per-environment JSON. `src/utils/`: helpers.

Path aliases (tsconfig `paths`, resolved by Playwright): `@fixtures` (= `src/fixtures/index.ts`), `@api/*`, `@ui/*`, `@config/*`, `@data/*`, `@fixtures/*`, `@utils/*`.

## Configuration

- `src/envs/<NAME>.json` (committed) holds per-environment settings: `baseUrl`, `apiBaseUrl`, timeouts, and `testUsers` with `${VAR}` placeholders for secrets. Pick one with `TEST_ENV` (default `TEST`, case-insensitive); adding an environment means adding a JSON file.
- `.env` (git-ignored, never commit) holds only secrets: `ADMIN_USER`, `ADMIN_PASSWORD`, `DEFAULT_USER`, `DEFAULT_PASSWORD`.
- `src/config/env.ts` loads `.env`, reads the selected JSON, fills in the placeholders (`resolvePlaceholders` in `src/utils/envUtils.ts`), validates it, and exports a frozen `env`, `getUser(role)` and `storageStatePath(role)`. Everything stays in memory; never write resolved config (which contains passwords) to disk.
- Everything reads config through `@config/env`, including `playwright.config.ts`. Don't read `process.env` directly in tests or page objects.
- Timeouts: `defaultTimeoutMs` sets the action and `expect` timeouts; `extendedTimeoutMs` sets the test and navigation timeouts.

## API layer

- **Clients** extend `src/api/clients/BaseClient.ts`: one client per API area, with methods that map 1:1 to endpoints (`get/post/put/patch/delete` return `ApiResponse` with `status` and a raw `body` string). Always send HTTP through `BaseClient.executeRequest`: it uses Playwright's `APIRequestContext`, so calls appear in traces. Don't call `fetch` or `request.get` directly.
- **Services** (`src/api/services/`) wrap clients with domain operations and parsing; **DTOs** (`src/api/dto/`) type the request and response bodies.
- **Auth:** `POST /users/login` with `{ email, password }` returns `access_token` and `expires_in` (300s). `TokenService` (worker-scoped) logs in each role once per worker and refreshes the token 2 minutes before it expires. The JWT's `role` claim is `admin` or `user`; `/users/me` returns `role` only for admin.
- **Fixtures** (`src/api/fixtures/fixtures.ts`): `accessToken` (for the test's `role`, from the shared `tokenService`) and `authClient`. Register new clients and services here, built from `request`, `config` and `accessToken`.
