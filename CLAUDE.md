# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Size rule:** keep this file under 200 lines and 30 KB, no line over 500 characters. It holds rules and pointers; explanations go in `docs/framework/`, and what a schema or the validator enforces isn't repeated.

## Project

SimpRight is an automated test framework built with TypeScript and Playwright, covering both UI and API testing. It is in early scaffolding: the core layers and a few example tests exist, and most of the app is not covered yet.

## Commands

```bash
npm install
npm run install:browsers          # Chromium + OS deps
npm test                          # all projects (api, ui); globalSetup registers the run's customer first
npm run test:api                  # API project only
npm run test:smoke                # the smoke set (tests tagged @smoke) of both projects in one run
npm run test:ui                   # UI project only
npx playwright test tests/ui/cart/add-to-cart.spec.ts   # single file
npx playwright test -g "UI-002:"                        # single test by scenario ID
npm run typecheck                 # tsc --noEmit (TypeScript 7; unused locals and parameters fail it)
npm run validate:scenarios        # profile, bugs, scenario files, IDs and specs
npm run check:step-titles         # step titles vs scenario steps, from a JSON report (default test-results/results.json)
npm run report                    # open last HTML report
npm run inspect:ui -- /auth/login --logged-out   # page inspector: data-test elements + accessibility tree
npm run test-cases:build          # Test Cases pages into test-results/test-cases/<layer>/ (open index.html)
npm run bugs:build                # Bugs page into test-results/bugs/ (open index.html)
npm run portal:build              # portal.json, what the dashboard shows, into test-results/portal/
```

## Playwright setup (playwright.config.ts)

Details: `docs/framework/02-configuration.md`.
- **UI login** (`authMode`, default `UI_AUTH_MODE` = `env.uiAuthMode`; per file `test.use({ authMode })`). The app keeps its JWT in `localStorage['auth-token']`; it expires after 5 minutes.
  - `api` (default): the `storageState` fixture injects a `tokenService` token for the test's role (`project.browserState`); nothing on disk.
  - `storageState`: `globalSetup` logs every role in and saves `.auth/<role>.json` (git-ignored, a live JWT). Locally a saved state is reused while its token has more than 2 minutes left; on CI it's always new, and the `default` role's always is. A role that fails to log in fails the run. `test.use({ authMode: 'storageState' })` works only when the run uses `UI_AUTH_MODE=storageState` (otherwise "No valid saved login").
  - `none` (test option only): starts logged out. The `api` project sets it because every test resolves the `storageState` fixture (tracing reads the context options): without it each API test would log the default user in, and one locked login would fail the suite. API tests log in only through the fixtures that need a token (`accessToken`, `productsClientWithToken`, `adminProductsService`).
- Projects: `api` (`tests/api`, no browser); `ui` (`tests/ui`, Desktop Chrome, headed locally, headless on CI, `HEADLESS` overrides); `inspect` (the page inspector, only while `SIMPRIGHT_INSPECT` is set).
- **Page inspector:** `npm run inspect:ui -- <path> [--role <role> | --logged-out] [--then click:<data-test> | check:<label> | select:<data-test>=<label>]`, output masked in `test-results/inspect/`. Read-only: never types or submits.
- `testIdAttribute` is `data-test` (`project.testIdAttribute`). Prefer `page.getByTestId(...)`.
- `trace: 'off'` for every project: traces store requests unmasked (passwords, tokens) and the reports are published. Don't turn it back on.
- On CI (`env.isCI`): 1 retry, 2 workers, JUnit output, `forbidOnly`.

## Fixtures

Details: `docs/framework/03-fixtures.md`.
- Specs import from `src/fixtures` (`index.ts`): `test`, `expect`, the UI precondition fixtures and the API step helpers. `index.ts` re-exports each `src/api/fixtures/<area>Steps.ts` with `export *`; keep names only their own module uses unexported.
- `src/fixtures/base.ts` (both layers): `role` (option, default `'default'`; `test.use({ role: 'admin' })`), `authMode` (option) and `storageState` (the logged-in start), `config` and `tokenService` (worker scope), `user`, `cleanup` (undo steps run after the test, pass or fail, newest first; a failing step only warns).
- `src/api/fixtures/fixtures.ts` and `src/ui/fixtures/fixtures.ts` extend base; `src/fixtures/fixtures.ts` merges them (`mergeTests`). Fixtures are lazy. Logged-out UI tests: `test.use({ authMode: 'none' })`.
- New page, component, grid and dialog fixtures go in `src/ui/fixtures/fixtures.ts`.
- UI precondition fixtures: one file each in `src/ui/fixtures/preconditions/`, named `open<Page><State>Test` after the export (`openHomePageInLondonTest`). They extend the merged `test` and are exported from `src/fixtures/index.ts`.
- A state is a helper, not a fixture: `setVisitorLocation` (`src/ui/visitor/`) or `newCustomerFixtures` (`open<Page>Test.extend(newCustomerFixtures)` = `open<Page>WithNewCustomerTest`). A fixture that opens a given record takes it as an option (`test.use({ productName })`).
- API setup helpers stay functions in `src/api/fixtures/*Steps.ts` (shared ones in `apiSteps.ts`); a helper that is a step returns its result from `test.step`, not through a `let`.

## UI layer

Details: `docs/framework/06-ui-layer.md`.
- Pages extend `BasePage(page, config)`: `private readonly` locator fields assigned in the constructor, a public `open()` calling the protected `goto('/path')`, and actions. Every page has `navBar` and `toast` (role `alert`).
- **Locators stay inside the page object.** A test reaches one only through a getter, added when a test asserts on it. Fields carry the element kind (`searchCaptionText`), getters the plain noun (`get searchCaption(): Locator`). Base classes use `protected` (`BaseDialog.root`). Dynamic locators are methods (`productGrid.card(name)`). Actions are verbs, getters nouns; values come from async methods (`getTotal()`). Amounts are read with `parseAmount` (`src/utils/amounts.ts`).
- No assertions in page objects; waiting for the app's own signal inside an action or `waitForLoaded()` is fine.
- Components (`pages/components/`) extend `BaseComponent(page, root)` and find their locators inside `root` (default: their container). Inside `filter({ has })` the inner locator starts from `page`. No URL, `open()` or `navBar`. Dialogs extend `BaseDialog(page, root?)` (default `getByRole('dialog')`). Multi-page journeys go in `src/ui/flows/` (`ShoppingFlow.openProduct(name)`), exposed as fixtures.
- Wait for the app's own signals, never fixed sleeps (`search_completed` marker, the "Product added" toast). With no marker, use `waitForApiResponse(page, method, path)` (`src/ui/pages/waitForApiResponse.ts`), started before the action and awaited after it.
- **Never `goto('/checkout')`:** Cloudflare's bot check blocks most direct loads from GitHub-hosted runners (never seen locally); `BasePage.goto()` then throws "Blocked by the site's Cloudflare bot check (environment)". Reach the checkout with `CartPage.open()`: it clicks the nav bar's cart link, then waits for `GET /carts/{id}` and fails with its status when the cart doesn't load. Only `openWithoutCart()` loads it directly.
  - The link shows only when sessionStorage has `cart_quantity`, which `setVisitorCart` sets with the cart id. When no page of the app is open, `open()` loads the home page first and waits until it has loaded: a click right after the load can be lost.
- After login, admin lands on `/admin/dashboard`, a customer on `/account`. `navBar.userMenu` shows only when logged in: use it to check login.

## Layout

- `src/`: framework code (`api/`, `ui/`, `fixtures/`, `config/`, `envs/`, `data/`, `utils/`, `globalSetup.ts`); `tests/`: specs only (no page logic in specs). Map: `docs/framework/01-architecture.md`.
- `src/config/project.ts` (`defineProject`): what the framework's core needs from the app: the test-id attribute, the API login (`apiLogin`), the browser state of a logged-in page, the UI login (storageState mode) and `beforeRun`/`afterRun` (the re-seed wait, the run's customer). `src/config/roles.ts`: the roles (`ROLES`, `UserRole`, `DEFAULT_ROLE`). The core reads the app only through these two files.
- `src/ui/visitor/`: the app's browser-storage state (location, cart). `src/ui/fixtures/` also holds setup or cleanup helpers UI specs share.
- `src/data/` (`@data/*`): `TestConstants.ts` holds seeded values that **more than one test** uses, by area (`TestConstants.products.searchTerm`); a value one test uses stays a variable in that test; roles aren't repeated there. `factories/`: `uniqueName(prefix)` (`testDataUtils.ts`) for every record a test creates, and one `<Area>Factory.ts` per area (shared builders in their own file, like `nameAndSlugPayloads.ts`).
- `test-scenarios/` (`api/`, `ui/`): the source of truth for what gets automated. Keep scenarios and specs in sync; don't invent coverage no scenario describes.
- `bugs/`: one `<ID>.yml` per root cause (`bugs/bug.schema.json`), shared by the scenarios with that cause (`bug` next to `knownIssue`). When a bug is fixed: remove `knownIssue`, `bug` and the `test.fail` line from its scenarios and tests, set `status: fixed` with `resolved`. Bug files are published: no secret values.
- `.claude/agents/` and `.claude/skills/`: the QA agents and the skills that start them (each skill's description says what it does; overview in `docs/framework/12-ai-agents.md`). The chain is contracts → scenarios → specs; stories and bugs go through `/analyze-requirements`. Agents read `simpright.yml` and keep no project facts of their own.
- `simpright.yml` (schema `simpright.schema.json`): the project config for the agents and scripts, never read by tests (paths, commands, ID prefixes and digits, `ids.areas`, `ids.fileNames`, `roles`, exemplars, live-app guardrails: `liveApi.writes: ask`, UI writes included; `parts`, `ci`, `runs`, `portal`). Keep it current: a new area needs an `ids.areas` entry, a new role a `roles` entry, a renamed exemplar a new path, a new test run a `runs` entry.
- `docs/api/contracts/`: API contracts. `docs/framework/`: how the framework works, one document per area; when a change alters how an area works, update its document too.
- `docs/wiki/`: the wiki's source (one file per page, plus `_Sidebar.md`), published on pushes to `main`; never edit in the web editor. Page links use the page name without `.md`, repo links full `github.com/.../blob/main/...` URLs; each page starts with a comment naming its source; a new page needs a sidebar entry.

## Scenarios and specs conventions

Format: `test-scenarios/scenarios.schema.json` (key order, required keys, values); `validate:scenarios` checks files, IDs and specs. Details: `docs/framework/09-scenarios-and-bugs.md`.
- **Scenario files:** `test-scenarios/<layer>/<area>/<name>.yml`, the same folders as the specs. API: one file per endpoint, `<method>-<path>.yml` in kebab-case, a path parameter as `by-<name>` (`get-products-by-product-id.yml`); a scenario calling several endpoints goes in the file of the one it tests. UI: named after the spec. File level: `suite`, `tags` (`@<area>` for UI, `@<area>-api` for API), `scenarios`.
  - IDs are numbered across the whole layer (`API-0001`, `UI-001`); a new one takes the next free number (`validate:scenarios` prints it). New scenarios are `status: manual`; whoever automates one sets `automated` with `automatedIn`. A missing `role` is the default user; `guest` is logged out (`authMode: 'none'`).
  - `knownIssue` is one sentence naming the wrong behaviour, with `bug`. The test then has `test.fail(true, 'Known issue <bug>: <text>')` right before its first `test.step`, after any setup code, so a failed setup is a real failure. A bug that makes the test too slow (the BUG-047 PDF polls) uses `test.skip(true, ...)` as the first line instead.
  - `preconditions` (UI) are statements, not actions (`The home page is open.`); `steps` start with the first user action. Checks are steps that start with `Verify`, in order; every scenario has one. Steps never contain secret values ("the default user's email").
- **Specs:** one per scenario file, same name (`.yml` → `.spec.ts`), with a `// Scenarios: <yml path>` comment, `test.describe('<tags> - <suite>')`, and one `test('<ID>: <name>')` per scenario with the name verbatim; a scenario's `tags` go in the tag option (`test('<ID>: <name>', { tag: '@smoke' }, ...)`).
- **Smoke set:** the scenarios tagged `@smoke`: critical happy paths, automated, no `knownIssue`, only writes the test cleans up (no invoices or messages), fast and stable. The user picks the set; agents never add or remove `@smoke`, except removing it together with a new known issue, and they say so.
- **Spec style, both layers** (exemplars: `tests/ui/products/product-search.spec.ts`, `tests/api/products/get-products-search.spec.ts`):
  - One `test.step()` per scenario step, titled with the step text verbatim. Action steps act (and may read values); `Verify` steps check and never change data.
  - Every assertion carries a message. A check over every item of a list first checks the list isn't empty (`expectSomeItems` in API specs).
  - Tests that differ only in data share one template function (`checkStatusAndMessage`, `checkRejectedBody`, `checkValidationRedirect` in `apiSteps.ts`, or a `check...` function), called from a literal `test('<ID>: <name>', ...)` each: never generate tests in a loop. Checks several tests repeat go in a function in the spec.
  - State shared between steps goes in `let` variables at the top of the test. Each spec file runs on its own.
- **UI spec style:**
  - Messages say what is checked: `expect(homePage.searchCaption, 'The caption names the search term')`.
  - Steps use page objects, components and flows from fixtures and their getters; no selectors in specs.
  - Preconditions are set up before the first step, never in a `test.step`: with a precondition fixture imported as `test` (`import { openHomePageTest as test, expect } from '@fixtures'`) when tests share it, otherwise as setup code with a `// Precondition: <text>` comment.
  - Setup code (preconditions, API data via `src/ui/fixtures/` helpers such as `putProductInCart`, `findProductByName`, `registerCustomerForTest`) is never a `test.step`; when it fails it throws an error starting with `Setup:`.
  - A flow is used in a step only when it does exactly what that step says; a flow spanning several steps is for setup.
- **API spec style:**
  - Every assertion passes `assertMessage({ request, expected, actual })` (`@utils/assertHelpers`).
  - Bodies are parsed with `parseJson(request, response)` (`src/utils/apiChecks.ts`), never `JSON.parse`. "Verify the response status is <N>." is `expectStatus` (or `expectStatusAndBody` when later steps read the body). Reuse the shared checks there (`expectMessage`, `expectErrorKeys`, `expectFieldMessages`, `expectLocation`, ...), `apiSteps.ts` and the area's `*Steps.ts`; never redefine one.
  - A call whose status a step checks goes through `sendAndAttach(name, request, () => client.x(...))`. The record's `auth` uses the shared `AUTH` labels (`AuthLabel`), never a string of its own. A page that may list other visitors is attached as a summary (`describePage`, `pageSummary`).
  - Attach with `attachJson(name, data)`, never `test.info().attach`. It masks `SECRET_KEYS` and the test users' credentials; the matcher's diff isn't masked, so compare a secret as a condition (`expect(a === b, message).toBe(true)`).
  - Records a test creates are removed with `cleanup.add(() => service.delete(id))`, not `afterAll`.
- **Imports:** specs import from `@fixtures` and get pages, flows, clients and services as fixtures; never `new` them or `page.goto`.
- **API assertions:** happy paths use a service (typed, throws on non-2xx); any step that checks a status code, `200` included, uses the client and asserts `response.status`.
- **Contracts:** when a spec calls an endpoint, check its contract: add it if missing, tag a fact the test confirms `_(verified)_`.

Path aliases (tsconfig `paths`): `@fixtures` (= `src/fixtures/index.ts`), `@api/*`, `@ui/*`, `@config/*`, `@data/*`, `@fixtures/*`, `@utils/*`.

## Configuration

Details: `docs/framework/02-configuration.md`.
- `src/envs/<NAME>.json` (committed): `baseUrl`, `apiBaseUrl`, timeouts, `testUsers` (the admin only, `${VAR}` placeholders for secrets). Pick with `TEST_ENV` (default `TEST`).
- `.env` (git-ignored, never commit): only secrets (`ADMIN_USER`, `ADMIN_PASSWORD`). Keep `.env.example` in sync. `.npmrc` holds only the scope mapping, never a token (see `.npmrc.example`).
- `src/config/env.ts` resolves and validates config and exports a frozen `env`, `getUser(role)`, `storageStatePath(role)`. **Never write resolved config (it has passwords) to disk.** Everything reads config through `@config/env`; never read `process.env` in tests or page objects.
- **The run's customer (the `default` role):** the demo site publishes its default customer's credentials, so other people's failed logins kept locking it (423). Instead the project's `beforeRun` registers a new customer per run (`createRunUser`, `src/api/auth/runUser.ts`) and hands it to the workers with `setRunUser` (`SIMPRIGHT_RUN_USERS`, read only by `env.ts`), and `afterRun` deletes it as admin after the run (a failed delete only warns). Its credentials are masked in reports.
  - The login check retries a 5xx or a dropped connection with a new customer for up to 4 minutes (a delayed run can start during the hourly re-seed); other errors fail at once. The re-seed deletes the customer too, so on CI a run that would start between :45 and :02 UTC first waits until :03.
  - **Never send wrong passwords for a shared account:** a lockout test registers its own customer.
- Timeouts: `defaultTimeoutMs` (actions, `expect`), `extendedTimeoutMs` (tests, navigation).

## API layer

Details: `docs/framework/04-api-layer.md`.
- **Clients** extend `BaseClient`: one per API area, public methods 1:1 with endpoints, built on the protected helpers (`get`, `post/put/patch/delete`, `query`, `queryBody`) that return `ApiResponse` (`status`, raw `body`, lower-case `headers`). Query strings via `queryString({ q, page })`.
- All HTTP goes through `BaseClient.executeRequest` (never `fetch` or `request.get`), so `onApiCall` listeners see every call. It sends `data` as JSON with `Accept: application/json`; negative tests use `rawData` (with `contentType`) and `accept` (`null` leaves the header out). A request that fails without a response masks the credential headers in its error, because errors reach published reports and CI logs.
- **API coverage (optional):** `src/api/coverage/apiCoverage.ts` loads `@zaytsman/playwright-api-coverage` when installed; the auto worker fixture `apiCoverage` records every call, and the package's reporter compares them with the contracts into `test-results/api-coverage/`. Without the package both do nothing. **Never import the package directly** (forks and their PRs don't have it). `DISABLE_API_COVERAGE=true` or a CLI `--reporter` turns it off.
- **Services** wrap clients with domain operations and parsing; **DTOs** type the bodies.
- **Auth:** `POST /users/login` returns `access_token` (300 s). `TokenService` (worker scope) logs each role in once through `project.login` (`apiLogin`) and refreshes 2 minutes before expiry. The JWT's `role` claim is `admin` or `user`; `/users/me` returns `role` only for admin.
- **Fixtures** (`src/api/fixtures/fixtures.ts`): register new clients and services here. A client for the test's role or the admin gets `roleToken(tokenService, role)` (fetched per request, so long tests never send an expired token); a token the test got itself is passed as a string. Variants per area as the scenarios need them: `xClient`/`xService` (no token), `xClientWithToken`, `xClientWithInvalidToken`, `xClientForToken(token)`/`xServiceForToken(token)`, `adminXService`.

## API contracts

`docs/api/contracts/*.md`: one file per API area, untested endpoints included (coverage is measured against them), in the format of `docs/api/CONTRACT_FORMAT.md` (the coverage package's parser).
- Every fact carries an origin tag, in order of trust: `_(verified)_` (checked live; change only after checking again), `_(source)_` (the API's code), `_(spec)_` (only the OpenAPI spec).
- Wrong status codes (a `500` for an unknown id) are documented as they are, marked as suspected bugs.

## CI and GitHub Pages

Details: `docs/framework/11-ci-and-publishing.md` and the wiki's CI and Pages pages.
- `playwright-run.yml` is the reusable test job; its callers are the scheduled (`run-ui-tests.yml`, `run-api-tests.yml`), manual (`custom-*-tests.yml`) and smoke (`smoke-tests.yml`) workflows. **A new folder under `tests/ui` or `tests/api` goes in the matching custom workflow's `area` options.** Its `keep-runs` input (default 10) sets how many runs of the family stay on Pages; `squash-gh-pages.yml` (monthly) replaces the `gh-pages` history with one commit.
- **Each caller has a `runs` entry in `simpright.yml`** (its `id` is the caller's `family`): change both together; `validate:scenarios` checks them (details in `docs/framework/11-ci-and-publishing.md`).
- The workflows' steps are local composite actions in `.github/actions/<name>/` (`setup`, `run-tests`, `publish-run`, `publish-pages`, `squash-pages`, `publish-wiki`), each with its script; a step uses one after the checkout, and `validate:scenarios` checks the inputs it passes.
- `pr-checks.yml` (`verify`, required on `main`): typecheck, scenario validation and the build of the portal's pages (`build-pages.mts`); static only. Tests run locally before a push (each changed spec three times) and nightly on `main`.
- Secrets: callers pass them by name and `playwright-run.yml` declares them (the names in `ci.secrets`); never `secrets: inherit`.
- **Hardening:**
  - Every action is pinned to a full commit SHA with its version in a comment (`actions/checkout@<sha> # v7.0.1`), in workflows and in `action.yml` files. A local action that uses other actions needs its folder in `dependabot.yml`.
  - Every checkout sets `persist-credentials: false`; only the publish steps get a token (their action's `token` input, no default). `npm ci` runs with `--ignore-scripts`.
  - Inputs reach `run:` scripts through `env:`, in workflows and actions, never as `${{ }}` inside the script.
  - Scheduled runs start at :15, never on the hour (the site re-seeds at :00).
  - A workflow that needs the coverage package needs `packages: read` in every caller too.
- The dashboard (`index.html`) lists a test under "Known Issues" when an annotation contains `Known issue`; the bug ID in `Known issue BUG-001: ...` links to the Bugs page.
- **The portal pages name nothing themselves:** the brand, runs and thresholds come from `simpright.yml` (`portal`, `runs`), through `portal.json` (written next to `index.html` on every publish) or the Test Cases and Bugs data files. Never hard-code a family, label or project name in them.
- The Test Cases (`site/test-cases/`) and Bugs (`site/bugs/`) pages are built from the scenarios and bugs (`npm run test-cases:build`, `npm run bugs:build`) and published by `publish-test-cases.yml` on pushes to `main`; `verify` builds them too, so a scenario change that breaks the build fails the PR.
- Publishing writes its files in Node (`scripts/publish-run.mts`, `scripts/build-pages.mts`, shared code in `scripts/lib/`), so it runs on any OS; the actions' `.sh` scripts only check out, commit and push. Keep new file work out of them. `*.sh` files keep LF line endings (`.gitattributes`).

## Branches and pull requests

- `main`: stable code, the scheduled runs and the dashboard. Changes arrive only through a pull request that passes `verify`, merged with a **merge commit** (no squash or rebase).
- `develop`: where work happens (commit there, or short-lived `feature/...` branches with a PR into `develop`). Release with a PR `develop` → `main`, never squashed.
- Dependabot version updates target `develop`; security updates target `main`, and after merging one, merge `main` back into `develop`.
- Claude works on `develop` (or a feature branch), never commits or pushes to `main`, and leaves opening and merging pull requests to the user unless asked.
- Never add workflows triggered by `pull_request_target` that check out pull request code: that runs untrusted code with access to secrets.
