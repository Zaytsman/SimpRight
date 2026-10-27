# Conventions

The framework's rules: they hold for any project built on it, whatever app it tests. `CLAUDE.md` imports this file and adds the project's own rules (its app, its other folders, CI and branches); its size rule covers this file too. Names from SimpRight's Toolshop tests appear only as examples, marked "e.g.".

## Playwright setup (playwright.config.ts)

Details: `docs/framework/02-configuration.md`.
- **UI login** (`authMode`, default `UI_AUTH_MODE` = `env.uiAuthMode`; per file `test.use({ authMode })`):
  - `api` (default): the `storageState` fixture injects a `tokenService` token for the test's role (`project.browserState`); nothing on disk.
  - `storageState`: `globalSetup` logs every role in and saves `.auth/<role>.json` (git-ignored, a live token). Locally a saved state is reused while its token has more than 2 minutes left; on CI it's always new, and a run user's always is. A role that fails to log in fails the run. `test.use({ authMode: 'storageState' })` works only when the run uses `UI_AUTH_MODE=storageState` (otherwise "No valid saved login").
  - `none` (test option only): starts logged out. The `api` project sets it because every test resolves the `storageState` fixture (tracing reads the context options): without it each API test would log the default user in, and one locked login would fail the suite. API tests log in only through the fixtures that need a token (e.g. `accessToken`, `productsClientWithToken`, `adminProductsService`).
- Projects: `api` (`tests/api`, no browser); `ui` (`tests/ui`, Desktop Chrome, headed locally, headless on CI, `HEADLESS` overrides); `inspect` (the page inspector, only while `SIMPRIGHT_INSPECT` is set).
- **Page inspector:** `npm run inspect:ui -- <path> [--role <role> | --logged-out] [--then click:<data-test> | check:<label> | select:<data-test>=<label>]`, output masked in `test-results/inspect/`. Read-only: never types or submits.
- The test-id attribute is the project's (`project.testIdAttribute`). Prefer `page.getByTestId(...)`.
- `trace: 'off'` for every project: traces store requests unmasked (passwords, tokens) and the reports are published. Don't turn it back on.
- On CI (`env.isCI`): 1 retry, 2 workers, JUnit output, `forbidOnly`.

## Fixtures

Details: `docs/framework/03-fixtures.md`.
- Specs import from `src/fixtures` (`index.ts`): `test`, `expect`, the UI precondition fixtures and the API step helpers. `index.ts` re-exports each `src/api/fixtures/<area>Steps.ts` with `export *`; keep names only their own module uses unexported.
- `src/fixtures/base.ts` (both layers): `role` (option, default `DEFAULT_ROLE`; e.g. `test.use({ role: 'admin' })`), `authMode` (option) and `storageState` (the logged-in start), `config` and `tokenService` (worker scope), `user`, `cleanup` (undo steps run after the test, pass or fail, newest first; a failing step only warns).
- `src/api/fixtures/fixtures.ts` and `src/ui/fixtures/fixtures.ts` extend base; `src/fixtures/fixtures.ts` merges them (`mergeTests`). Fixtures are lazy. Logged-out UI tests: `test.use({ authMode: 'none' })`.
- New page, component, grid and dialog fixtures go in `src/ui/fixtures/fixtures.ts`. `src/ui/fixtures/` also holds setup or cleanup helpers UI specs share.
- UI precondition fixtures: one file each in `src/ui/fixtures/preconditions/`, named `open<Page><State>Test` after the export (e.g. `openHomePageInLondonTest`). They extend the merged `test` and are exported from `src/fixtures/index.ts`.
- A state is a helper, not a fixture (e.g. `setVisitorLocation`, or `newCustomerFixtures`: `open<Page>Test.extend(newCustomerFixtures)` = `open<Page>WithNewCustomerTest`). A fixture that opens a given record takes it as an option (e.g. `test.use({ productName })`).
- API setup helpers stay functions in `src/api/fixtures/*Steps.ts` (shared ones in `apiSteps.ts`); a helper that is a step returns its result from `test.step`, not through a `let`.

## UI layer

Details: `docs/framework/06-ui-layer.md`.
- Pages extend the app's base page (e.g. `AppPage(page, config)`), which extends the core `BasePage` (page, config, `goto()`): `private readonly` locator fields assigned in the constructor, a public `open()` calling the protected `goto('/path')`, and actions. What every page of the app has (e.g. its nav bar and toast) lives in the app's base page.
- **Locators stay inside the page object.** A test reaches one only through a getter, added when a test asserts on it. Fields carry the element kind (e.g. `searchCaptionText`), getters the plain noun (`get searchCaption(): Locator`). Base classes use `protected` (`BaseDialog.root`). Dynamic locators are methods (e.g. `productGrid.card(name)`). Actions are verbs, getters nouns; values come from async methods (e.g. `getTotal()`).
- No assertions in page objects; waiting for the app's own signal inside an action or `waitForLoaded()` is fine.
- Components (`pages/components/`) extend `BaseComponent(page, root)` and find their locators inside `root` (default: their container). Inside `filter({ has })` the inner locator starts from `page`. No URL, `open()` or base-page parts (e.g. `navBar`). Dialogs extend `BaseDialog(page, root?)` (default `getByRole('dialog')`). Multi-page journeys go in `src/ui/flows/` (e.g. `ShoppingFlow.openProduct(name)`), exposed as fixtures.
- Wait for the app's own signals, never fixed sleeps (e.g. the `search_completed` marker, the "Product added" toast). With no marker, use `waitForApiResponse(page, method, path)` (`src/ui/pages/waitForApiResponse.ts`), started before the action and awaited after it.

## Layout

Map: `docs/framework/01-architecture.md`.
- `src/`: framework code (`api/`, `ui/`, `fixtures/`, `config/`, `envs/`, `data/`, `utils/`, `globalSetup.ts`); `tests/`: specs only (no page logic in specs).
- `src/config/project.ts` (`defineProject`): what the framework's core needs from the app: the test-id attribute, the API login, the browser state of a logged-in page, the UI login (storageState mode) and `beforeRun`/`afterRun`. `src/config/roles.ts`: the roles (`ROLES`, `UserRole`, `DEFAULT_ROLE`).
  - The core (`core` in `simpright.yml`: the base classes and fixtures, config, shared checks, `globalSetup`, the inspector, this file) stays generic: its code imports only core files, these two seams and packages; `validate:scenarios` checks it, so app code never goes into a core file.
- `src/data/` (`@data/*`): `TestConstants.ts` holds seeded values that **more than one test** uses, by area (e.g. `TestConstants.products.searchTerm`); a value one test uses stays a variable in that test; roles aren't repeated there. `factories/`: `uniqueName(prefix)` (`testDataUtils.ts`) for every record a test creates, and one `<Area>Factory.ts` per area (shared builders in their own file, e.g. `nameAndSlugPayloads.ts`).
- `test-scenarios/` (`api/`, `ui/`): the source of truth for what gets automated. Keep scenarios and specs in sync; don't invent coverage no scenario describes.
- `bugs/`: one `<ID>.yml` per root cause (`bugs/bug.schema.json`), shared by the scenarios with that cause (`bug` next to `knownIssue`). When a bug is fixed: remove `knownIssue`, `bug` and the `test.fail` line from its scenarios and tests, set `status: fixed` with `resolved`. Bug files are published: no secret values.
- `simpright.yml` (schema `simpright.schema.json`): the project config for the agents and scripts, never read by tests (paths, commands, ID prefixes and digits, `ids.areas`, `ids.fileNames`, `roles`, exemplars, live-app guardrails (`liveApi`); `parts`, `core`, `ci`, `runs`, `portal`). Keep it current: a new area needs an `ids.areas` entry, a new role a `roles` entry, a renamed exemplar a new path, a new test run a `runs` entry, a new core file a `core.files` entry.

## Scenarios and specs

Format: `test-scenarios/scenarios.schema.json` (key order, required keys, values); `validate:scenarios` checks files, IDs and specs. Details: `docs/framework/09-scenarios-and-bugs.md`.
- **Scenario files:** `test-scenarios/<layer>/<area>/<name>.yml`, the same folders as the specs. API: one file per endpoint, `<method>-<path>.yml` in kebab-case, a path parameter as `by-<name>` (e.g. `get-products-by-product-id.yml`); a scenario calling several endpoints goes in the file of the one it tests. UI: named after the spec. File level: `suite`, `tags` (`@<area>` for UI, `@<area>-api` for API), `scenarios`.
  - IDs are numbered across the whole layer (e.g. `API-0001`, `UI-001`); a new one takes the next free number (`validate:scenarios` prints it). New scenarios are `status: manual`; whoever automates one sets `automated` with `automatedIn`. A missing `role` is the default user; `guest` is logged out (`authMode: 'none'`).
  - `knownIssue` is one sentence naming the wrong behaviour, with `bug`. The test then has `test.fail(true, 'Known issue <bug>: <text>')` right before its first `test.step`, after any setup code, so a failed setup is a real failure. A bug that makes the test too slow (e.g. BUG-047's PDF polls) uses `test.skip(true, ...)` as the first line instead.
  - `preconditions` (UI) are statements, not actions (e.g. `The home page is open.`); `steps` start with the first user action. Checks are steps that start with `Verify`, in order; every scenario has one. Steps never contain secret values (e.g. "the default user's email").
- **Specs:** one per scenario file, same name (`.yml` → `.spec.ts`), with a `// Scenarios: <yml path>` comment, `test.describe('<tags> - <suite>')`, and one `test('<ID>: <name>')` per scenario with the name verbatim; a scenario's `tags` go in the tag option (`test('<ID>: <name>', { tag: '@smoke' }, ...)`).
- **Smoke set:** the scenarios tagged `@smoke`: critical happy paths, automated, no `knownIssue`, only writes the test cleans up (e.g. no invoices or messages), fast and stable. The user picks the set; agents never add or remove `@smoke`, except removing it together with a new known issue, and they say so.
- **Spec style, both layers** (exemplars: the profile's `ui.exemplars.spec` and `api.exemplars.spec`):
  - One `test.step()` per scenario step, titled with the step text verbatim. Action steps act (and may read values); `Verify` steps check and never change data.
  - Every assertion carries a message. A check over every item of a list first checks the list isn't empty (`expectSomeItems` in API specs).
  - Tests that differ only in data share one template function (e.g. `checkStatusAndMessage`, `checkRejectedBody`, `checkValidationRedirect` in `apiSteps.ts`, or a `check...` function), called from a literal `test('<ID>: <name>', ...)` each: never generate tests in a loop. Checks several tests repeat go in a function in the spec.
  - State shared between steps goes in `let` variables at the top of the test. Each spec file runs on its own.
- **UI spec style:**
  - Messages say what is checked (e.g. `expect(homePage.searchCaption, 'The caption names the search term')`).
  - Steps use page objects, components and flows from fixtures and their getters; no selectors in specs.
  - Preconditions are set up before the first step, never in a `test.step`: with a precondition fixture imported as `test` (e.g. `import { openHomePageTest as test, expect } from '@fixtures'`) when tests share it, otherwise as setup code with a `// Precondition: <text>` comment.
  - Setup code (preconditions, API data via `src/ui/fixtures/` helpers, e.g. `putProductInCart`, `findProductByName`, `registerCustomerForTest`) is never a `test.step`; when it fails it throws an error starting with `Setup:`.
  - A flow is used in a step only when it does exactly what that step says; a flow spanning several steps is for setup.
- **API spec style:**
  - Every assertion passes `assertMessage({ request, expected, actual })` (`@utils/assertHelpers`).
  - Bodies are parsed with `parseJson(request, response)` (`src/utils/apiChecks.ts`), never `JSON.parse`. "Verify the response status is <N>." is `expectStatus` (or `expectStatusAndBody` when later steps read the body). Reuse the shared checks there (e.g. `expectMessage`, `expectErrorKeys`, `expectFieldMessages`, `expectLocation`), `apiSteps.ts` and the area's `*Steps.ts`; never redefine one.
  - The generic checks and send helpers are the core's (`httpChecks.ts`, `sendSteps.ts`), re-exported by `apiChecks.ts` and `apiSteps.ts`; a check of the app's own formats goes in `apiChecks.ts`.
  - A call whose status a step checks goes through `sendAndAttach(name, request, () => client.x(...))`. The record's `auth` uses the shared auth labels (e.g. `AUTH`, `AuthLabel`), never a string of its own. A page that may list other visitors is attached as a summary (e.g. `describePage`, `pageSummary`).
  - Attach with `attachJson(name, data)`, never `test.info().attach`. It masks `SECRET_KEYS` and the test users' credentials; the matcher's diff isn't masked, so compare a secret as a condition (`expect(a === b, message).toBe(true)`).
  - Records a test creates are removed with `cleanup.add(() => service.delete(id))`, not `afterAll`.
- **Imports:** specs import from `@fixtures` and get pages, flows, clients and services as fixtures; never `new` them or `page.goto`.
- **API assertions:** happy paths use a service (typed, throws on non-2xx); any step that checks a status code, `200` included, uses the client and asserts `response.status`.
- **Contracts:** when a spec calls an endpoint, check its contract: add it if missing, tag a fact the test confirms `_(verified)_`.

Path aliases (tsconfig `paths`): `@fixtures` (= `src/fixtures/index.ts`), `@api/*`, `@ui/*`, `@config/*`, `@data/*`, `@fixtures/*`, `@utils/*`.

## Configuration

Details: `docs/framework/02-configuration.md`.
- `src/envs/<NAME>.json` (committed): `baseUrl`, `apiBaseUrl`, timeouts, `testUsers` (`${VAR}` placeholders for secrets). Pick with `TEST_ENV` (default `TEST`).
- `.env` (git-ignored, never commit): only secrets. Keep `.env.example` in sync.
- `src/config/env.ts` resolves and validates config and exports a frozen `env`, `getUser(role)`, `storageStatePath(role)`. **Never write resolved config (it has passwords) to disk.** Everything reads config through `@config/env`; never read `process.env` in tests or page objects.
- Users a `beforeRun` creates for the run reach the workers through `setRunUser(role, user)` (`SIMPRIGHT_RUN_USERS`, read only by `env.ts`); their credentials are masked in reports like every test user's.
- Timeouts: `defaultTimeoutMs` (actions, `expect`), `extendedTimeoutMs` (tests, navigation).

## API layer

Details: `docs/framework/04-api-layer.md`.
- **Clients** extend `BaseClient`: one per API area, public methods 1:1 with endpoints, built on the protected helpers (`get`, `post/put/patch/delete`, `query`, `queryBody`) that return `ApiResponse` (`status`, raw `body`, lower-case `headers`). Query strings via `queryString({ q, page })`.
- All HTTP goes through `BaseClient.executeRequest` (never `fetch` or `request.get`), so `onApiCall` listeners see every call. It sends `data` as JSON with `Accept: application/json`; negative tests use `rawData` (with `contentType`) and `accept` (`null` leaves the header out). A request that fails without a response masks the credential headers in its error, because errors reach published reports and CI logs.
- **API coverage (optional):** `src/api/coverage/apiCoverage.ts` loads the coverage package when it's installed; the auto worker fixture `apiCoverage` records every call, and the package's reporter compares them with the contracts into `test-results/api-coverage/`. Without the package both do nothing. **Never import the package directly** (forks and their PRs don't have it). `DISABLE_API_COVERAGE=true` or a CLI `--reporter` turns it off.
- **Services** wrap clients with domain operations and parsing; **DTOs** type the bodies.
- **Auth:** `TokenService` (worker scope) logs each role in once through `project.login` and refreshes 2 minutes before expiry.
- **Fixtures** (`src/api/fixtures/fixtures.ts`): register new clients and services here. A client for the test's role or another one (e.g. the admin) gets `roleToken(tokenService, role)` (fetched per request, so long tests never send an expired token); a token the test got itself is passed as a string. Variants per area as the scenarios need them: `xClient`/`xService` (no token), `xClientWithToken`, `xClientWithInvalidToken`, `xClientForToken(token)`/`xServiceForToken(token)`, `adminXService`.

## API contracts

`docs/api/contracts/*.md`: one file per API area, untested endpoints included (coverage is measured against them), in the format of `docs/api/CONTRACT_FORMAT.md` (the coverage package's parser).
- Every fact carries an origin tag, in order of trust: `_(verified)_` (checked live; change only after checking again), `_(source)_` (the API's code), `_(spec)_` (only the OpenAPI spec).
- Wrong status codes (e.g. a `500` for an unknown id) are documented as they are, marked as suspected bugs.
