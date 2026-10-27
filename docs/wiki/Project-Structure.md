<!-- Source: docs/wiki/Project-Structure.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# Project Structure

SimpRight keeps **framework code** (`src/`) apart from **specs** (`tests/`), and both apart from the **descriptions of what to test** (`test-scenarios/`, `docs/`). Specs hold no page logic and no selectors: they call page objects, flows, clients and services through fixtures.

## The tree

```
SimpRight/
├── src/                          framework code
│   ├── config/
│   │   ├── env.ts                loads .env and the environment JSON, validates them; exports env, getUser(role)
│   │   ├── roles.ts              the roles tests act as (ROLES, UserRole, DEFAULT_ROLE)
│   │   ├── project.ts            the app's test ids, logins and run hooks (beforeRun, afterRun)
│   │   └── defineProject.ts      the shape of project.ts
│   ├── envs/
│   │   └── TEST.json             one file per environment: URLs, timeouts, the admin user (${VAR} placeholders)
│   ├── fixtures/                 what specs import as @fixtures
│   │   ├── index.ts              exports test, expect, the UI precondition fixtures and the API step helpers
│   │   ├── base.ts               fixtures shared by both layers: role, authMode, config, user, tokenService, storageState, cleanup
│   │   └── fixtures.ts           merges the API and UI fixtures (mergeTests)
│   ├── api/
│   │   ├── clients/              one client per API area, methods 1:1 with endpoints, on top of BaseClient
│   │   ├── services/             domain operations over clients; parse responses, throw on errors
│   │   ├── dto/                  request and response types
│   │   ├── auth/                 TokenService (token cache per role), apiLogin (the app's login), runUser (the run's customer)
│   │   ├── fixtures/             API fixtures (clients, services, tokens) and step helpers: apiSteps (AUTH, templates; re-exports sendSteps: sendAndAttach), <area>Steps
│   │   └── coverage/             loader of the optional API coverage plug-in
│   ├── ui/
│   │   ├── pages/                page objects, on top of AppPage (the app's base page) and the core BasePage
│   │   │   ├── components/       parts shared by pages, on top of BaseComponent: NavBar, ProductGrid, ProductFilters
│   │   │   └── dialogs/          dialogs, on top of BaseDialog
│   │   ├── flows/                multi-page user journeys (ShoppingFlow)
│   │   ├── auth/                 whether a saved login is still valid (authState)
│   │   ├── visitor/              visitor state the app keeps in browser storage: location, cart
│   │   └── fixtures/             UI fixtures (pages, components, flows), the new-customer state, setup helpers (cartSetup, productSetup)
│   │       └── preconditions/    where a test starts, open<Page><State>Test: openHomePageTest, openProductPageTest, their InLondon / WithNewCustomer variants
│   ├── data/
│   │   ├── TestConstants.ts      seeded app values that several tests rely on
│   │   └── factories/            payload builders per area, uniqueName() for created records
│   ├── utils/                    assertHelpers (assertMessage, attachJson, redact), apiChecks (the app's checks; re-exports httpChecks: parseJson, expectStatus, ...), amounts (parseAmount), totp, envUtils
│   └── globalSetup.ts            runs the project's beforeRun and afterRun (the run's customer); UI login in storageState mode
├── tests/                        specs only, one per scenario file
│   ├── api/<area>/*.spec.ts      products/, users/, carts/, ... (13 areas)
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
│   ├── framework/                how the framework works, one document per area, and conventions.md (the framework's rules)
│   ├── wiki/                     these wiki pages (published by the Publish Wiki workflow)
│   └── AI_WORKFLOW.md            the AI-driven automation cycle
├── scripts/                      tools run by npm scripts and CI (see below)
├── site/test-cases/index.html    the Test Cases page of the dashboard
├── .claude/
│   ├── agents/                   the QA agents (requirements analyst, scenario writers, test engineers, reviewer, healer, contract writer)
│   └── skills/                   the slash commands that start them, the skills they use, and `_shared/how-to-ask.md` (how every checkpoint asks)
├── .github/
│   ├── workflows/                CI (see below)
│   ├── actions/                  the workflows' steps as composite actions, with their shell scripts (see below)
│   └── dependabot.yml            weekly dependency updates
├── index.html                    the Automation Portal (dashboard on GitHub Pages)
├── playwright.config.ts          projects, reporters, timeouts, login mode
├── simpright.yml                 the project config for the agents and scripts (paths, commands, IDs, roles, the core files, test runs)
├── CLAUDE.md                     SimpRight's own rules; imports docs/framework/conventions.md, the framework's
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
| A page object | `src/ui/pages/<Name>Page.ts`, extending `AppPage` | Register a fixture in `src/ui/fixtures/fixtures.ts` |
| A part shared by pages | `src/ui/pages/components/` | Expose it from the pages that contain it |
| A dialog | `src/ui/pages/dialogs/`, extending `BaseDialog` | |
| A multi-page journey | `src/ui/flows/` | Register a fixture |
| A UI precondition (the test starts somewhere specific) | `src/ui/fixtures/preconditions/open<Page><State>Test.ts`, extending the merged `test` | Export it from `src/fixtures/index.ts` |
| An API endpoint call | A method on the area's client in `src/api/clients/` | A service method in `src/api/services/` for the happy path |
| A new API area | A client, a service and DTOs | Register them in `src/api/fixtures/fixtures.ts`; document the area in `docs/api/contracts/` |
| Data a test creates | A builder in `src/data/factories/<Area>Factory.ts` | Name records with `uniqueName()` |
| A seeded value several tests use | `src/data/TestConstants.ts` | |
| An environment | `src/envs/<NAME>.json` | Run with `TEST_ENV=<NAME>` |
| A secret | `.env` and `.env.example` (empty value) | A `${VAR}` placeholder in the environment JSON; a GitHub secret for CI |
| A test area folder | `tests/<layer>/<area>/` and `test-scenarios/<layer>/<area>/` | Add it to `ids.areas` in `simpright.yml` and to the area options of the custom workflow; `npm run validate:scenarios` checks both |
| A test run (a report family) | A caller of `playwright-run.yml` in `.github/workflows/` | An entry in the `runs` list of `simpright.yml` with the caller's `family` as its `id` ([Scheduled Runs](Scheduled-Runs#add-a-new-scheduled-run)) |
| A CI step that workflows share | A composite action in `.github/actions/<name>/`: its `action.yml` and, if it needs one, its script | Pin the actions it uses to commit SHAs; if it uses any, add its folder to `dependabot.yml` ([CI Pipeline](CI-Pipeline#changing-the-pipeline)) |

## Scripts

| Script | Run by | What it does |
|---|---|---|
| `validate-scenarios.mts` | `npm run validate:scenarios`, CI | Checks the profile, the scenario files, their IDs, that specs match them and that the runs match their workflows |
| `inspect-ui.mts` | `npm run inspect:ui` | Starts the page inspector |
| `build-test-cases.mts` | `npm run test-cases:build`, CI | Builds the UI and API Test Cases pages from the scenarios |
| `build-bugs.mts` | `npm run bugs:build`, CI | Builds the Bugs page from `bugs/` and the scenarios that name them |
| `check-step-titles.mts` | `npm run check:step-titles`, CI | Compares each test's step titles in a run's JSON report with its scenario's steps |
| `build-portal-config.mts` | `npm run portal:build` | Writes `portal.json`, what the portal shows (the brand, the runs, the thresholds), from `simpright.yml` |
| `publish-run.mts` | the `publish-run` action, or by hand on any OS | Writes a run's report into a site folder, keeps the latest runs (`keep-runs`, 10 by default) and refreshes the portal |
| `build-pages.mts` | the `publish-pages` action, CI | Writes the Test Cases and Bugs pages and the portal into a site folder |
| `lib/project.mts` | the other scripts | What they share: reading `simpright.yml`, the workflows and the local actions, the repository's URL, the branch and commit |
| `lib/run-summaries.mts` | the two Node publish scripts | The small history and run-summary files the portal and the Bugs page read |
| `lib/site.mts` | the two Node publish scripts | The portal every publish writes (`index.html`, `portal.json`) and the folder copy |

## CI actions

The workflows' steps, in `.github/actions/`; the shell scripts only do git, and the Node scripts above write the files.

| Action (script) | Used by | What it does |
|---|---|---|
| `setup` | `playwright-run.yml`, `pr-checks.yml`, `publish-test-cases.yml` | Node.js, `npm ci --ignore-scripts`, and the browsers for UI runs |
| `run-tests` | `playwright-run.yml` | The tests, then the step-title check |
| `publish-run` (`publish-run.sh`) | `playwright-run.yml` | Publishes a run to `gh-pages`: checkout, `publish-run.mts`, push |
| `publish-pages` (`publish-pages.sh`) | `publish-test-cases.yml` | Publishes the Test Cases and Bugs pages and the portal to `gh-pages`: checkout, `build-pages.mts`, push |
| `squash-pages` (`squash-pages.sh`) | `squash-gh-pages.yml`, monthly | Replaces the `gh-pages` history with one commit of the current site |
| `publish-wiki` (`publish-wiki.sh`) | `publish-wiki.yml` | Copies `docs/wiki/` to this wiki |
| `lib/gh-pages-lib.sh` (not an action) | `publish-run.sh`, `publish-pages.sh` | The git steps: checkout of `gh-pages` and push with retries |

## CI workflows

| Workflow | When | What |
|---|---|---|
| `pr-checks.yml` (`verify`) | every pull request to `main` or `develop` | Typecheck, scenario validation, the build of the portal's pages (no tests) |
| `run-api-tests.yml` | weekdays 02:15 UTC, or by hand | Full API regression, with the coverage report |
| `run-ui-tests.yml` | weekdays 06:15 UTC, or by hand | Full UI regression |
| `custom-api-tests.yml`, `custom-ui-tests.yml` | by hand | One area, optionally filtered with `--grep` |
| `smoke-tests.yml` | by hand | The smoke set (tests tagged `@smoke`) of both projects |
| `playwright-run.yml` | called by the five above | Runs one project (or both) and publishes its report |
| `publish-test-cases.yml` | scenarios or the dashboard change on `main` | Rebuilds the Test Cases pages and the dashboard |
| `publish-wiki.yml` | `docs/wiki/` changes on `main` | Copies `docs/wiki/` to this wiki |
| `squash-gh-pages.yml` | the 1st of each month, or by hand | Replaces the `gh-pages` history with one commit |

## Generated and ignored files

None of these are committed:

| Path | What |
|---|---|
| `.env` | Your secrets |
| `.auth/` | Saved logins in `storageState` mode |
| `node_modules/` | Dependencies |
| `test-results/` | Raw results, the coverage report, inspector output, built Test Cases pages |
| `playwright-report/` | The HTML report (`npm run report`) |
| `.gh-pages/` | The `gh-pages` checkout made by the publish scripts |

Previous: [Installation & Setup](Installation-&-Setup).
