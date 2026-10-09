<!-- Source: docs/wiki/Project-Structure.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# Project Structure

SimpRight keeps **framework code** (`src/`) apart from **specs** (`tests/`), and both apart from the **descriptions of what to test** (`test-scenarios/`, `docs/`). Specs hold no page logic and no selectors: they call page objects, flows, clients and services through fixtures.

## The tree

```
SimpRight/
├── src/                          framework code
│   ├── config/
│   │   └── env.ts                loads .env and the environment JSON, validates them; exports env, getUser(role)
│   ├── envs/
│   │   └── TEST.json             one file per environment: URLs, timeouts, the admin user (${VAR} placeholders)
│   ├── fixtures/                 what specs import as @fixtures
│   │   ├── index.ts              exports test, expect and the precondition fixtures
│   │   ├── base.ts               fixtures shared by both layers: role, config, user, tokenService, cleanup
│   │   ├── fixtures.ts           merges the API and UI fixtures (mergeTests)
│   │   ├── openHomePage.ts       precondition fixture: the test starts on the home page
│   │   └── visitorInLondon.ts    precondition fixture: the browser reports a London location
│   ├── api/
│   │   ├── clients/              one client per API area, methods 1:1 with endpoints, on top of BaseClient
│   │   ├── services/             domain operations over clients; parse responses, throw on errors
│   │   ├── dto/                  request and response types
│   │   ├── auth/                 TokenService (token cache per role), runUser (the run's customer)
│   │   ├── fixtures/             API fixtures (clients, services, tokens) and shared setup steps
│   │   └── coverage/             loader of the optional API coverage plug-in
│   ├── ui/
│   │   ├── pages/                page objects, on top of BasePage
│   │   │   ├── components/       parts shared by pages: NavBar, ProductGrid
│   │   │   └── dialogs/          dialogs, on top of BaseDialog
│   │   ├── flows/                multi-page user journeys (ShoppingFlow)
│   │   ├── auth/                 login token and storage state helpers
│   │   └── fixtures/             UI fixtures (pages, components, flows)
│   ├── data/
│   │   ├── TestConstants.ts      seeded app values that several tests rely on
│   │   └── factories/            payload builders per area, uniqueName() for created records
│   ├── utils/                    assertHelpers (assertMessage, attachJson, redact), envUtils
│   └── globalSetup.ts            registers the run's customer (deleted after the run); UI login in storageState mode
├── tests/                        specs only, one per scenario file
│   ├── api/<area>/*.spec.ts      products/, users/
│   └── ui/<area>/*.spec.ts       cart/, products/
├── test-scenarios/               what gets automated: the source of truth
│   ├── scenarios.schema.json     the format of a scenario file
│   ├── api/<area>/*.yml          one file per endpoint (get-products-search.yml)
│   └── ui/<area>/*.yml           one file per feature (product-search.yml)
├── bugs/                         bugs in the app under test: BUG-001.yml, one per root cause
│   └── bug.schema.json           the format of a bug file
├── docs/
│   ├── api/contracts/            API contracts, one per API area; the reference for API coverage
│   ├── api/CONTRACT_FORMAT.md    the contract format
│   ├── ui/user-stories/          user stories and bug reports with acceptance criteria, the input for the analyst and UI scenarios
│   ├── analysis/                 analysis documents: a summary and test plan per work item (/analyze-requirements)
│   ├── wiki/                     these wiki pages (published by the Publish Wiki workflow)
│   └── AI_WORKFLOW.md            the AI-driven automation cycle
├── scripts/                      tools run by npm scripts and CI (see below)
├── site/test-cases/index.html    the Test Cases page of the dashboard
├── .claude/
│   ├── agents/                   the QA agents (requirements analyst, scenario writers, test engineers, reviewer, healer, contract writer)
│   └── skills/                   the slash commands that start them, and the skills they use
├── .github/
│   ├── workflows/                CI (see below)
│   └── dependabot.yml            weekly dependency updates
├── index.html                    the Automation Portal (dashboard on GitHub Pages)
├── playwright.config.ts          projects, reporters, timeouts, login mode
├── qa-agents-profile.yml         project facts for the agents and scripts (paths, commands, IDs, roles)
├── CLAUDE.md                     the conventions in detail
├── .env.example                  the secrets the framework needs (copy to .env)
├── .npmrc / .npmrc.example       registry of the optional coverage package / the user-level token line
└── tsconfig.json                 TypeScript settings and path aliases
```

## How a test is wired

```
tests/ui/products/product-search.spec.ts
   │  import { test, expect } from '@fixtures'
   ▼
src/fixtures/  ──  base.ts (role, config, user, cleanup)
   │               + src/api/fixtures (clients, services, accessToken)
   │               + src/ui/fixtures  (pages, flows, logged-in browser)
   ▼
src/ui/pages, src/ui/flows          src/api/services → src/api/clients → BaseClient
   │                                    │
   ▼                                    ▼
the browser (Playwright page)       Playwright APIRequestContext
   │                                    │
   └────────────── src/config/env.ts (URLs, timeouts, users) ──┘
```

- A spec asks for what it needs by name (`async ({ homePage, productsService }) => ...`). Fixtures are lazy: a UI test that doesn't ask for an API client never creates one.
- The `role` option picks the test user (`test.use({ role: 'admin' })`), and the test starts logged in as that user. `test.use({ authMode: 'none' })` starts logged out.
- Records a test creates are removed by the `cleanup` fixture after the test, pass or fail.

## Playwright projects

| Project | Specs | Notes |
|---|---|---|
| `api` | `tests/api` | No browser. `baseURL` is the API's URL. Starts logged out; tests log in through the fixtures that need a token. |
| `ui` | `tests/ui` | Desktop Chrome. `baseURL` is the site's URL. |
| `inspect` | `scripts/inspect-ui` | The page inspector. Exists only while `npm run inspect:ui` runs, so `npm test` never runs it. |

## Path aliases

Defined in `tsconfig.json` and resolved by Playwright, so imports don't climb folders:

| Alias | Points to |
|---|---|
| `@fixtures` | `src/fixtures/index.ts` (what specs import) |
| `@fixtures/*` | `src/fixtures/*` |
| `@api/*` | `src/api/*` |
| `@ui/*` | `src/ui/*` |
| `@config/*` | `src/config/*` |
| `@data/*` | `src/data/*` |
| `@utils/*` | `src/utils/*` |

## Where new code goes

| You're adding | Put it in | Then |
|---|---|---|
| A test scenario | `test-scenarios/<layer>/<area>/<name>.yml`, with the next free ID | `npm run validate:scenarios` |
| A bug in the app | `bugs/<ID>.yml` with the next free `BUG-` ID; the scenarios that hit it get `knownIssue` and `bug` | `npm run validate:scenarios` |
| A spec | `tests/<layer>/<area>/<name>.spec.ts`, named after its scenario file | |
| A page object | `src/ui/pages/<Name>Page.ts`, extending `BasePage` | Register a fixture in `src/ui/fixtures/fixtures.ts` |
| A part shared by pages | `src/ui/pages/components/` | Expose it from the pages that contain it |
| A dialog | `src/ui/pages/dialogs/`, extending `BaseDialog` | |
| A multi-page journey | `src/ui/flows/` | Register a fixture |
| A precondition (the test starts somewhere specific) | `src/fixtures/<name>.ts` | Export it from `src/fixtures/index.ts` |
| An API endpoint call | A method on the area's client in `src/api/clients/` | A service method in `src/api/services/` for the happy path |
| A new API area | A client, a service and DTOs | Register them in `src/api/fixtures/fixtures.ts`; document the area in `docs/api/contracts/` |
| Data a test creates | A builder in `src/data/factories/<Area>Factory.ts` | Name records with `uniqueName()` |
| A seeded value several tests use | `src/data/TestConstants.ts` | |
| An environment | `src/envs/<NAME>.json` | Run with `TEST_ENV=<NAME>` |
| A secret | `.env` and `.env.example` (empty value) | A `${VAR}` placeholder in the environment JSON; a GitHub secret for CI |
| A test area folder | `tests/<layer>/<area>/` and `test-scenarios/<layer>/<area>/` | Add it to `ids.areas` in `qa-agents-profile.yml` and to the area options of the custom workflow |

## Scripts

| Script | Run by | What it does |
|---|---|---|
| `validate-scenarios.mts` | `npm run validate:scenarios`, CI | Checks the profile, the scenario files, their IDs and that specs match them |
| `inspect-ui.mts` | `npm run inspect:ui` | Starts the page inspector |
| `build-test-cases.mts` | `npm run test-cases:build`, CI | Builds the UI and API Test Cases pages from the scenarios |
| `pr-test-scope.sh` | CI (`verify`) | Decides which tests a pull request runs: all, only the affected specs, or none |
| `publish-report.sh` | CI | Publishes a run's report to `gh-pages` and keeps the latest 30 runs |
| `publish-test-cases.sh` | CI | Publishes the Test Cases pages and the dashboard to `gh-pages` |
| `gh-pages-lib.sh` | the two publish scripts | Shared checkout of `gh-pages` and push with retries |

## CI workflows

| Workflow | When | What |
|---|---|---|
| `pr-checks.yml` (`verify`) | every pull request to `main` or `develop` | Typecheck, scenario validation, Test Cases build, and the tests the change can affect |
| `run-api-tests.yml` | weekdays 02:00 UTC, or by hand | Full API regression, with the coverage report |
| `run-ui-tests.yml` | weekdays 06:00 UTC, or by hand | Full UI regression |
| `custom-api-tests.yml`, `custom-ui-tests.yml` | by hand | One area, optionally filtered with `--grep` |
| `playwright-run.yml` | called by the four above | Runs one project and publishes its report |
| `publish-test-cases.yml` | scenarios or the dashboard change on `main` | Rebuilds the Test Cases pages and the dashboard |
| `publish-wiki.yml` | `docs/wiki/` changes on `main` | Copies `docs/wiki/` to this wiki |

## Generated and ignored files

None of these are committed:

| Path | What |
|---|---|
| `.env` | Your secrets |
| `.auth/` | Saved logins in `storageState` mode |
| `node_modules/` | Dependencies |
| `test-results/` | Raw results, traces, the coverage report, inspector output, built Test Cases pages |
| `playwright-report/` | The HTML report (`npm run report`) |
| `.gh-pages/` | The `gh-pages` checkout made by the publish scripts |

Previous: [Installation & Setup](Installation-&-Setup).
