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
| `CI` | any value | not set | Enables retries, 2 workers, JUnit output and `forbidOnly` |

PowerShell example: `$env:TEST_ENV="QA"; npm test`. Git Bash example: `TEST_ENV=QA npm test`.

## Environments

Each environment is a JSON file in `src/envs/` (e.g. `TEST.json`) containing `baseUrl`, `apiBaseUrl`, timeouts and test users. Credentials are written as `${VAR}` placeholders and filled in from `.env` when tests start. To add an environment, add another file (e.g. `QA.json`) and run with `TEST_ENV=QA`. Name the file in capitals.

The configuration is checked when tests start. An unknown environment, an invalid URL or a missing `.env` variable fails straight away with a clear message.

## Project structure

```
src/
  config/env.ts          environment config and test users
  envs/                  per-environment JSON (TEST.json, ...)
  utils/                 helpers
tests/
  api/<area>/*.spec.ts
  ui/<area>/*.spec.ts
```

## Reports

- **Playwright HTML report:** `playwright-report/`. Open it with `npm run report`. Traces, screenshots and videos are kept for failed tests.
