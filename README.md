# SimpRight

Automated test framework built with **TypeScript + Playwright**. It covers UI and API tests for the [Practice Software Testing](https://practicesoftwaretesting.com) Toolshop demo app ([API](https://api.practicesoftwaretesting.com)).

## Prerequisites

- Node.js 20 or later (developed on 24)
- npm

## Setup

```bash
npm install
npm run install:browsers
```

Create a `.env` file in the project root. It's git-ignored, so never commit it.

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
```

## Reports

- **Playwright HTML report:** `playwright-report/`. Open it with `npm run report`. Traces, screenshots and videos are kept for failed tests.
