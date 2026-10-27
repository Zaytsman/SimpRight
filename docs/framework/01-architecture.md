# 1. Architecture

SimpRight tests [practicesoftwaretesting.com](https://practicesoftwaretesting.com) (the Toolshop demo app) on two layers, its REST API and its Angular UI, with Playwright and TypeScript. This page is the map: the layers, the folders, and what happens during a run.

## The layers

```
  tests/                 specs: one per scenario file, steps only, no page or HTTP logic
     │  import { test, expect, ... } from '@fixtures'
     ▼
  src/fixtures/          the single `test`: shared + API + UI fixtures (mergeTests), helpers re-exported
     │
     ├──► src/api/fixtures/   clients and services per role, area step helpers (*Steps.ts, apiSteps.ts)
     │        │
     │        ▼
     │    src/api/services/   happy-path operations: parse the body, throw on non-2xx
     │        │
     │        ▼
     │    src/api/clients/    one method per endpoint, raw responses, all HTTP through BaseClient
     │
     └──► src/ui/fixtures/    pages, flows, precondition fixtures, UI setup helpers (carts, products, customers)
              │
              ▼
          src/ui/flows/ ─► src/ui/pages/ ─► components/, dialogs/   page objects: locators, actions, waits

  shared by every layer:
  src/config/  env.ts: the one place that reads the environment     src/data/   seeded constants, factories
               project.ts, roles.ts: the app's test ids, logins, run hooks and roles
  src/utils/   masking, assertion messages, shared API checks, amounts, TOTP
```

Each layer only calls the one below it:

- **Specs** describe a scenario step by step. They get everything (pages, clients, services, test data) from fixtures and the test-data modules, and they never construct objects, call `page.goto`, use selectors or send HTTP themselves.
- **Fixtures** build the objects a test asks for, set up its starting state and clean up after it. They're lazy: a test pays only for what it uses.
- **Services and page objects** hold the knowledge of the app: what a happy-path call returns, which element is which, what signal says an action is done.
- **Clients and `BaseClient`** are the only code that sends HTTP. That single path is what makes masking, coverage recording and error handling work everywhere.

## The folders

| Folder | Responsible for | Details |
|---|---|---|
| `tests/api/<area>/`, `tests/ui/<area>/` | Specs, one per scenario file, named after it | [5](05-api-specs.md), [7](07-ui-specs.md) |
| `test-scenarios/<layer>/<area>/` | What to test: YAML scenarios, the source of truth for specs | [9](09-scenarios-and-bugs.md) |
| `bugs/` | Defects found in the app, one file per root cause | [9](09-scenarios-and-bugs.md) |
| `src/fixtures/` | `base.ts` (shared fixtures), `fixtures.ts` (the merge), `index.ts` (what `@fixtures` exports) | [3](03-fixtures.md) |
| `src/api/` | `clients/`, `services/`, `dto/`, `auth/` (tokens, the run's customer), `fixtures/`, `coverage/` | [4](04-api-layer.md) |
| `src/ui/` | `pages/` (+ `components/`, `dialogs/`), `flows/`, `fixtures/` (+ `preconditions/`), `visitor/`, `auth/` | [6](06-ui-layer.md) |
| `src/config/`, `src/envs/` | Typed, validated configuration per environment (`env.ts`), and the project file: the app's test ids, logins and run hooks (`project.ts`) and its roles (`roles.ts`) | [2](02-configuration.md) |
| `src/data/` | `TestConstants.ts` (seeded values), `factories/` (payload builders, unique names) | [8](08-test-data.md) |
| `src/utils/` | `assertHelpers.ts` (masking, messages, attachments), `apiChecks.ts` (shared API checks; the HTTP-level ones are the core's `httpChecks.ts`), `amounts.ts`, `envUtils.ts`, `totp.ts` | [10](10-reporting-and-secrets.md), [5](05-api-specs.md) |
| `src/globalSetup.ts` | Once per run: the project's `beforeRun` and `afterRun` (the re-seed wait, the run's customer), optional UI logins | [2](02-configuration.md) |
| `scripts/` | Validator, step-title check, page inspector, page builds, the publish scripts' file work | [9](09-scenarios-and-bugs.md), [11](11-ci-and-publishing.md) |
| `.github/workflows/` | CI: the reusable test job, scheduled and manual runs, PR checks, publishing | [11](11-ci-and-publishing.md) |
| `.github/actions/` | The workflows' steps as composite actions (setup, tests, publishing), with the publish scripts' git steps | [11](11-ci-and-publishing.md) |
| `.claude/agents/`, `.claude/skills/`, `simpright.yml` | The QA agents, their skills and the project facts they read | [12](12-ai-agents.md) |
| `docs/` | Contracts, user stories, analyses, the wiki source, these pages and the framework's [conventions](conventions.md) | |
| `site/`, `index.html` | The GitHub Pages portal, the Test Cases and Bugs pages | [11](11-ci-and-publishing.md) |

Path aliases (`tsconfig.json`, resolved by Playwright): `@fixtures` (= `src/fixtures/index.ts`), `@api/*`, `@ui/*`, `@config/*`, `@data/*`, `@fixtures/*`, `@utils/*`.

## The core and the app

The framework's **core** is the part a new project gets from the template and keeps generic: `env.ts`, `BaseClient`, `TokenService`, `BasePage`, `BaseComponent`, `BaseDialog`, the base fixtures, `globalSetup`, the assertion and HTTP check helpers, the page inspector, `playwright.config.ts` and the framework's conventions, [`conventions.md`](conventions.md), which `CLAUDE.md` imports (the `core.files` list in [`simpright.yml`](../../simpright.yml)). Everything else is the **app's**: the Toolshop's clients, services, pages, flows, fixtures, test data and specs.

The core reaches the app only through two **seams**, the project's own files:

- `src/config/roles.ts`: the roles tests act as;
- `src/config/project.ts`: the app's test-id attribute, its logins (API, browser state, login page) and what runs around a run ([2](02-configuration.md#the-project-file)).

A core code file imports only core files, the seams and packages, and `npm run validate:scenarios` fails otherwise ([9](09-scenarios-and-bugs.md)). Where the app's code does a core job its own way, it builds on the core: `AppPage` extends `BasePage`, and `apiChecks.ts` and `apiSteps.ts` add the Toolshop's own checks and re-export the core's (`httpChecks.ts`, `sendSteps.ts`).

The core is the same as in [SimpRightTemplate](https://github.com/Zaytsman/SimpRightTemplate), the template a new project starts from. `template` in `simpright.yml` records the template version the core files match, and `npm run check:template` fails when one differs from that version's copy; `verify` runs it ([11](11-ci-and-publishing.md)). So a core change is made in the template too: a new template version, then `template` here.

## What happens during a run

1. **Config load.** `playwright.config.ts` imports `src/config/env.ts`, which loads `.env`, reads `src/envs/<TEST_ENV>.json`, fills in the `${VAR}` placeholders, validates everything and freezes the result. A missing secret or a bad URL fails here, before any test.
2. **Global setup** (`src/globalSetup.ts`, main process) runs the project's `beforeRun` (`src/config/project.ts`): on CI, it waits when the run would cross the site's hourly re-seed, then it registers a new customer for the run (the `default` role) and checks that it can log in. With `UI_AUTH_MODE=storageState`, globalSetup also logs every role in through the app's login page and saves `.auth/<role>.json`.
3. **Workers start** (2 on CI). Each worker gets the worker-scoped fixtures once: `config`, `tokenService` (one login per role per worker) and the auto `apiCoverage` hook.
4. **Each test** resolves only the fixtures it names. A UI test starts with a browser that's already logged in as its role, because the token is put into localStorage before the page loads. A precondition fixture may also open a page, set the visitor's location or put a cart in place. An API test gets clients built with the right token. The steps run, then `cleanup` runs the test's undo steps, newest first, pass or fail.
5. **Reporters** write the list output, the HTML report, and on CI JUnit and `results.json`. The optional API coverage reporter compares the recorded calls with the contracts.
6. **Teardown**: the function `globalSetup` returned runs the project's `afterRun`, which deletes the run's customer as admin.
7. **On CI**, the step-title check reads `results.json`, then the report is published to GitHub Pages ([11](11-ci-and-publishing.md)).

## Design principles

- **Scenarios first.** Every test comes from a YAML scenario, and its title, describe and step titles are the scenario's text verbatim. The validator checks the titles; a CI step checks the step titles after the run.
- **One path for HTTP.** All requests go through `BaseClient.executeRequest`, so headers, masking of request errors and coverage recording are the same everywhere.
- **Fixtures, not construction.** Specs never `new` a page or a client, so wiring (tokens, config, roles) changes in one place.
- **Wait for the app's signal.** Page objects wait for markers, toasts or the app's own requests; there are no fixed sleeps anywhere.
- **Independent, parallel tests.** Every test can run alone or next to any other (`fullyParallel`). Data a test changes is its own: unique names, throwaway customers, carts made through the API, and cleanup.
- **The live app is shared and public.** Its data re-seeds every hour, other visitors change it, and the reports are published. So tests find records by name, never by id; secrets are masked everywhere; traces are off.
- **Optional extras stay optional.** The private API coverage package is an optional dependency loaded at runtime; forks run the same tests without it.
- **API over UI.** A check goes to the API unless only the UI can prove it (the [requirements analyst's layer rules](../../.claude/skills/analyze-requirements/references/layer-rules.md)). UI tests prepare their data through the API.

## Changed in the review

The review (2026-10) kept this architecture and made each layer follow it more strictly:

- Configuration is read only through `env.ts` (two direct reads of `process.env.CI` removed).
- The specs stopped copying framework code: spec-local copies of shared checks, 167 bare `JSON.parse` calls and hand-built attachments were replaced by the shared checks and step helpers, and families of identical tests by templates ([5](05-api-specs.md)).
- The typecheck now fails on unused code, and CI checks step titles after every run.

See [13. Code review, October 2026](13-code-review-2026-10.md).
