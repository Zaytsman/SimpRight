# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

SimpRight is an automated test framework built with TypeScript and Playwright, covering both UI and API testing. It is in early scaffolding: the core layers and a few example tests exist, and most of the app is not covered yet.

## Commands

```bash
npm install
npm run install:browsers          # Chromium + OS deps
npm test                          # all projects (api, ui); globalSetup registers the run's customer first
npm run test:api                  # API project only
npm run test:ui                   # UI project only
npx playwright test tests/ui/cart/add-to-cart.spec.ts   # single file
npx playwright test -g "UI-002:"                        # single test by scenario ID
npm run typecheck                 # tsc --noEmit (TypeScript 7)
npm run validate:scenarios        # profile, scenario files, IDs and specs
npm run report                    # open last HTML report
npm run inspect:ui -- /auth/login --logged-out   # page inspector: data-test elements + accessibility tree
npm run test-cases:build          # Test Cases pages into test-results/test-cases/<layer>/ (open index.html)
```

## Playwright setup (playwright.config.ts)

- **UI login has two modes**, selected with `UI_AUTH_MODE` (`env.uiAuthMode`) or per file with `test.use({ authMode: ... })`. The app keeps its JWT in `localStorage['auth-token']` (no auth cookie), and the JWT expires after **5 minutes** (see `src/ui/auth/authState.ts`).
  - `api` (default): the UI `storageState` fixture gets a token for the test's role from `tokenService` and injects it into localStorage. There's no UI login and nothing is written to disk. Tokens are refreshed when fewer than 2 minutes are left, which is longer than the test timeout.
  - `storageState`: `globalSetup` (`src/globalSetup.ts`) logs in every role in `USER_ROLES` through `LoginPage` and saves `.auth/<role>.json` (git-ignored, holds a live JWT). Locally, a saved state is reused while its token has more than 2 minutes left; on CI it is always regenerated. The `default` role's state is always new (see "The run's customer"). A role that fails to log in fails the run.
  - `test.use({ authMode: 'storageState' })` only works when the run itself uses `UI_AUTH_MODE=storageState`; otherwise the fixture throws "No valid saved login".
  - `none` (a test option only, not a `UI_AUTH_MODE` value): no login, the test starts logged out. The `api` project sets it in `playwright.config.ts`. That matters because every test resolves the `storageState` fixture (Playwright's trace recording reads the context options), so without it each API test would log in the default user, even for public endpoints, and a locked or failing login would fail the whole API suite. API tests log in through the fixtures that need a token (`accessToken`, `productsClientWithToken`, `adminProductsService`).
- `api` project: `tests/api`. No browser; `baseURL` = `env.apiBaseUrl`.
- `ui` project: `tests/ui`. Desktop Chrome; `baseURL` = `env.baseUrl`.
- `inspect` project: the page inspector, for writing UI tests and scenarios. `npm run inspect:ui -- <path> [--role <role> | --logged-out] [--then <step> ...]` (`scripts/inspect-ui.mts`) opens a page as a role (default: the run's customer), makes the listed steps (`click:<data-test>`, `check:<label>` for a filter checkbox, `select:<data-test>=<option label>` for a list option), waits until the page stops changing, and prints every `data-test` element (grouped, with role, label or text, declared field limits, visibility) and the page's accessibility tree; the output is masked like the reports and saved in `test-results/inspect/`. The project exists only while the wrapper sets `SIMPRIGHT_INSPECT` (read by `findInspectRequest()` in `env.ts`), so `npm test` never runs it. It's read-only: its steps change only what the page shows; it never types or submits. Its spec (`scripts/inspect-ui/inspect-page.spec.ts`) is a tool, so it calls `page.goto` itself.
- `testIdAttribute` is `data-test` (`TEST_ID_ATTRIBUTE` in `BasePage.ts`), which is what the site uses. Prefer `page.getByTestId(...)` locators.
- On CI (`CI` set): 2 retries, 2 workers, JUnit output and `forbidOnly`.

## Fixtures

Specs import from `src/fixtures` (`index.ts`): `test`, `expect` and `openHomePageTest`.
- `src/fixtures/base.ts` holds the fixtures shared by both layers: `role` (option, default `'default'`; set with `test.use({ role: 'admin' })`), `config` and `tokenService` (worker scope), `user`, and `cleanup` (undo steps for records the test creates, run after the test, pass or fail, newest first; a failing step only logs a warning).
- `src/api/fixtures/fixtures.ts` and `src/ui/fixtures/fixtures.ts` each extend base. `src/fixtures/fixtures.ts` combines them with `mergeTests`. Fixtures are lazy, so a UI test that doesn't ask for `accessToken` never logs in through the API.
- The UI fixtures set `storageState` from `role` and `authMode`, so a test starts logged in as its role. For logged-out tests, use `test.use({ authMode: 'none' })`.
- New page, component, grid and dialog fixtures go in `src/ui/fixtures/fixtures.ts`. Precondition variants go in their own file in `src/fixtures/` (like `openHomePage.ts`) and are exported from `index.ts`.

## UI layer

- Pages extend `BasePage(page, config)`: they keep locators in `private readonly` fields assigned in the constructor, and expose a public `open()` that calls the protected `goto('/path')`, plus actions. Every page has `navBar` (`components/NavBar.ts`).
- **Locators stay inside the page object.** A test reaches one only through a getter, added when a test has to assert on it. Fields carry the element kind (`searchCaptionText`, `cartQuantityBadge`, `errorAlert`); the getter is the plain noun (`get searchCaption(): Locator`). Base classes use `protected` for what subclasses need (`BaseDialog.root`). Dynamic locators are methods with parameters (`productGrid.card(name)`). Name actions with verbs (`search`, `addToCart`, `openCart`) and getters with nouns; values a test reads come from async methods (`getTotal()`, `getLines()`).
- No assertions in page objects. Waiting for the app's own signal inside an action or `waitForLoaded()` is fine (`expect(marker).toBeAttached()` as a wait); checks belong in specs.
- Reusable parts of pages go in `pages/components/`, like `ProductGrid` (exposed as `homePage.productGrid`). Multi-page journeys go in `src/ui/flows/`, like `ShoppingFlow.addProductToCart(name, qty)`, and are exposed as fixtures too.
- Wait for the app's own signals, never fixed sleeps. For example, `HomePage.search()` waits for the `search_completed` marker, and `ProductPage.addToCart()` waits for the "Product added" toast.
- Dialogs extend `BaseDialog(page, config, root?)`. `root` defaults to `getByRole('dialog')`, and the buttons are scoped to it.
- After login, admin lands on `/admin/dashboard` and a customer on `/account`. `navBar.userMenu` is visible only when logged in, so use it to check that login succeeded.

## Layout

- `src/`: framework code; `tests/`: specs only (no page logic in specs).
- `src/api/`: `clients` (low-level HTTP over `APIRequestContext`), `services` (domain operations built on clients), `dto` (request/response types), `auth`, `fixtures`, `coverage` (the optional API coverage plug-in).
- `src/ui/`: `pages` (page objects, with reusable `components` and `dialogs`; `filters` and `grids` when needed), `flows` (multi-page user journeys), `auth` (token/storage-state helpers), `fixtures`.
- `src/fixtures/`: merges the API and UI fixtures (`mergeTests`) into the single `test`/`expect` that specs import.
- `src/globalSetup.ts`: registers the run's customer (and deletes it after the run), plus the UI login for `storageState` mode.
- `src/config/`: typed env access. `src/envs/`: per-environment JSON. `src/utils/`: helpers (`assertHelpers.ts`: `assertMessage`, `attachJson`, `redact`).
- `src/data/` (`@data/*`): test data.
  - `TestConstants.ts`: seeded values from the app that more than one test relies on, grouped by area (`TestConstants.products.searchTerm`). A value only one test uses stays a variable in that test. Roles aren't repeated here (they're `UserRole` in config).
  - `factories/`: `testDataUtils.ts` (`uniqueName(prefix)`, e.g. `Lifecycle-20261001-3fa9c2`, for every record a test creates) and one `<Area>Factory.ts` per area with create/update payload builders, added with the first scenario that creates data in that area.
- `test-scenarios/` (`api/`, `ui/`): the source of truth for what gets automated. One agent writes scenarios here; another agent picks them up and implements them as specs in `tests/`. Keep scenarios and specs in sync, and don't invent coverage that no scenario describes.
- `.claude/agents/` and `.claude/skills/`: the QA agents and the skills that start them. `/write-api-scenarios <contract>` runs the `api-scenario-writer` agent: it proposes scenarios from a contract, waits for the user's approval, then writes the YAML files. `/implement-api-scenarios <IDs | file | area>` runs the `api-test-engineer` agent (with the `api-scaffolding` and `api-test-from-scenario` skills): it plans the code and the tests that change data, waits for approval, then writes and runs the specs and marks the scenarios `automated`. `/write-api-contracts [update] <source> <spec> <areas>` runs the `api-contract-writer` agent: it writes or updates the contracts in `docs/api/contracts/` from the API's source code, its OpenAPI spec or both, optionally checking facts against the live API (it asks first). So the chain is contracts → scenarios → specs. For UI, `/write-ui-scenarios <story or bug> [AC ...]` runs the `ui-scenario-writer` agent: it proposes scenarios from a user story's acceptance criteria (stories live in `docs/ui/user-stories/`) or a bug report, checking labels and messages in the live app with the read-only page inspector, waits for approval, then writes the YAML files. `/implement-ui-scenarios <IDs | file | area>` runs the `ui-test-engineer` agent (with the `ui-scaffolding` and `ui-test-from-scenario` skills): it inspects the pages, plans the page objects, flows, fixtures and the tests that change data, waits for approval, then writes and runs the specs and marks the scenarios `automated`. `/review-tests [spec | scenario file | IDs | area | commit]` (default: the work not pushed yet) runs the read-only `test-reviewer` agent on specs of both layers and the code they use: it checks each test against its scenario and the conventions with the checklists in `.claude/skills/review-tests/references/`, and returns findings ranked blocker / should fix / nit; the skill then applies the findings the user picks and re-runs the affected specs. `/heal-tests [run id | PR | spec | IDs]` (default: the last local run) runs the `test-healer` agent on failed tests: it diagnoses each failure from the CI log or the local results (read-only, with the page inspector, `GET` calls to the API and re-runs of read-only tests) and gives a verdict (test defect, flaky, app changed, app bug, data drift, environment) with evidence, waits for the user to pick the fixes, then applies them and re-runs the specs. It never weakens a check or skips a test; app bugs become `knownIssue` proposals, and the app's known transient problems are listed in the profile's `liveApi.transient`. The agents read `qa-agents-profile.yml` and keep no project facts of their own.
- `docs/api/contracts/`: API contracts, one markdown file per API area (see "API contracts").
- `site/test-cases/index.html`: the Test Cases page of the dashboard (see "CI and GitHub Pages").
- `docs/wiki/`: the source of the GitHub wiki, one markdown file per page (`Installation-&-Setup.md` is the page "Installation & Setup") plus `_Sidebar.md`. Links between pages use the page name without `.md` (`[Project Structure](Project-Structure)`); links to repo files use full `github.com/.../blob/main/...` URLs. Edit pages here, never in the wiki's web editor: `publish-wiki.yml` copies the folder to the wiki on every push to `main` that changes it (pages removed here are removed there). Each page starts with an HTML comment naming its source. A new page needs a `_Sidebar.md` entry.
- `qa-agents-profile.yml` (schema: `qa-agents-profile.schema.json`): project facts for the QA agents and scripts: paths, commands, scenario ID prefixes and digits (`ids.layers`), the area folders (`ids.areas`) and file-name rules (`ids.fileNames`), `roles`, the `api` and `ui` sections (exemplar files to copy the style of, the known-issue snippet, agent-critical rules), the page inspector command (`commands.inspectUi`), and live app guardrails (`liveApi.writes: ask`, which covers UI tests that change data too). It points to this file for conventions instead of repeating them. Keep it current: a new scenario area needs an `ids.areas` entry, a new role a `roles` entry, and a renamed exemplar a new path (`validate:scenarios` checks that every path exists).

## Scenarios and specs conventions

- **Scenario files:** YAML in `test-scenarios/<layer>/<area>/<name>.yml`, the same folders as the specs in `tests/<layer>/<area>/`, validated by `test-scenarios/scenarios.schema.json` (the `# yaml-language-server: $schema=...` line at the top gives editor checks).
  - API: one file per endpoint, named `<method>-<path>.yml` with the path in kebab-case, starting with the API name (`api/products/get-products-search.yml` for `GET /products/search`, `api/users/get-users-me.yml` for `GET /users/me`). A path parameter becomes `by-<name>`: `GET /products/{productId}` is `get-products-by-product-id.yml`. A scenario that calls several endpoints goes in the file of the endpoint it tests. The pattern is `ids.fileNames.api` in `qa-agents-profile.yml`.
  - UI: kebab-case, named after the spec (`ui/cart/add-to-cart.yml`).
  - File level: `suite`, `tags` (required, at least one, for the whole suite: `@<area>` for UI, such as `@cart`, and `@<area>-api` for API, such as `@products-api`), and `scenarios`.
  - Each scenario, in this key order: `id` (`<PREFIX>-<number>`, numbered across the whole layer, not per area: `API-0001` (4 digits) or `UI-001` (3 digits), from `ids.layers` in `qa-agents-profile.yml`; unique across files; a new scenario takes the next free number, which `validate:scenarios` prints), `name`, `ref` (optional: the user story, bug or document the scenario comes from, such as `US-123`, `BUG-45` or `docs/ui/user-stories/Product_Detail.md#AC3`; one or a list), `status` (`manual` for every new scenario; whoever automates it sets `automated` together with `automatedIn`), `automatedIn` (the spec path; required when `status` is `automated`, absent when it's `manual`), `role` (one of the profile's `roles`; absent means the default user; `guest` means a logged-out visitor, `test.use({ authMode: 'none' })`), `knownIssue` (the test then starts with `test.fail(true, 'Known issue: <text>')`), `steps`.
  - Checks are ordinary steps that start with `Verify`, in the order they happen; every scenario has at least one. There's no separate expected-results list.
  - Steps never contain secret values: write "the default user's email", not the address.
- **Specs:** one spec per scenario file, with the same name: `test-scenarios/api/products/get-products-search.yml` → `tests/api/products/get-products-search.spec.ts`. `validate:scenarios` checks all of this:
  - a `// Scenarios: <yml path>` comment at the top;
  - `test.describe('<tags joined by spaces> - <suite>')`, such as `'@products-api - Products API'` (Playwright reads the `@tags`, so `--grep @products-api` works);
  - one `test()` per scenario, titled `'<ID>: <name>'` with the name verbatim.
- **Spec style, both layers** (examples: `tests/ui/products/product-search.spec.ts` and `tests/api/products/get-products-search.spec.ts`):
  - One `test.step()` per scenario step, titled with the step text verbatim, so the report and trace read like the scenario. Action steps act (and may read values for later checks); `Verify` steps hold the checks and may read data, never change it.
  - Every assertion carries a message; a bare `expect` without one is forbidden.
  - State shared between steps goes in `let` variables at the top of the test. Each spec file runs on its own.
- **UI spec style:**
  - Messages are plain text saying what is checked: `expect(homePage.searchCaption, 'The caption names the search term')`.
  - Steps use page objects, components and flows from fixtures, and the getters they expose; no selectors in specs.
  - A precondition fixture (`openHomePageTest`) covers setup the scenario doesn't list as a step. When the scenario lists it ("Open the home page."), the spec does it inside that step with plain `test`.
  - A flow is used in a step only when it does exactly what that step says (`shoppingFlow.openProduct(name)`); a flow spanning several steps (`addProductToCart`) is for setup.
- **API spec style:**
  - Every assertion passes `assertMessage({ request, expected, actual })` from `@utils/assertHelpers`.
  - Action steps make the call and attach the payloads.
  - Requests and responses are attached with `attachJson(name, data)`, never `test.info().attach` directly. Both helpers mask `password`, `access_token`, `token`, `authorization` and the test users' emails and passwords, because the HTML reports are published. The matcher's own diff isn't masked, so compare a secret value as a condition (`expect(a === b, message).toBe(true)`).
  - Records a test creates are removed with the `cleanup` fixture (`cleanup.add(() => service.delete(id))`), not `afterAll`: clients and services are test-scoped, so `afterAll` can't use them.
- **Imports:** specs import from `@fixtures` (`test`, `expect`, `openHomePageTest`) and use fixtures for pages, flows, clients and services. They never construct them or call `page.goto` directly.
- **API assertions:** happy paths use a service (it returns parsed, typed bodies and throws on non-2xx). Any step that checks a status code, including `200`, uses the client and asserts `response.status`.
- **Contracts:** when a spec calls an endpoint, check its contract in `docs/api/contracts/` (see "API contracts" below). Add the endpoint if it's missing, and when the test confirms a fact against the real API, tag it `_(verified)_`.

Path aliases (tsconfig `paths`, resolved by Playwright): `@fixtures` (= `src/fixtures/index.ts`), `@api/*`, `@ui/*`, `@config/*`, `@data/*`, `@fixtures/*`, `@utils/*`.

## Configuration

- `src/envs/<NAME>.json` (committed) holds per-environment settings: `baseUrl`, `apiBaseUrl`, timeouts, and `testUsers` (the admin only) with `${VAR}` placeholders for secrets. Pick one with `TEST_ENV` (default `TEST`, case-insensitive); adding an environment means adding a JSON file.
- `.env` (git-ignored, never commit) holds only secrets: `ADMIN_USER`, `ADMIN_PASSWORD`. `.env.example` (committed) lists them with empty values; keep it in sync when a secret is added.
- `.npmrc.example` shows the line for the user's own `~/.npmrc` (a `read:packages` token) that installs the optional coverage package. The repo's `.npmrc` holds only the scope mapping, never a token.
- `src/config/env.ts` loads `.env`, reads the selected JSON, fills in the placeholders (`resolvePlaceholders` in `src/utils/envUtils.ts`), validates it, and exports a frozen `env`, `getUser(role)` and `storageStatePath(role)`. Everything stays in memory; never write resolved config (which contains passwords) to disk.
- **The run's customer (the `default` role):** the demo site publishes its default customer's credentials, so other people's failed logins kept locking it (423). Instead, `globalSetup` registers a new customer for each run (`createRunUser` in `src/api/auth/runUser.ts`: `UserFactory.registerCustomer()`, a unique email and a random strong password), checks that it can log in, and hands its credentials to the workers through `SIMPRIGHT_RUN_USER_*` variables that only `env.ts` reads (`getUser('default')`, `getRunUser()`). The teardown that `globalSetup` returns deletes it as admin; a failed delete only logs a warning. Its email and password are masked in reports like the configured users'. Never send wrong passwords for a shared account: a lockout test registers its own customer.
- Everything reads config through `@config/env`, including `playwright.config.ts`. Don't read `process.env` directly in tests or page objects.
- Timeouts: `defaultTimeoutMs` sets the action and `expect` timeouts; `extendedTimeoutMs` sets the test and navigation timeouts.

## API layer

- **Clients** extend `src/api/clients/BaseClient.ts`: one client per API area, with methods that map 1:1 to endpoints (`get/post/put/patch/delete/query` return `ApiResponse` with `status`, a raw `body` string and `headers`, names in lower case). `query` sends the HTTP `QUERY` method with its criteria in the body. Always send HTTP through `BaseClient.executeRequest`: it uses Playwright's `APIRequestContext`, so calls appear in traces. Don't call `fetch` or `request.get` directly.
  - `executeRequest` sends `data` as JSON (`Content-Type: application/json; charset=utf-8` unless `contentType` is given) and `Accept: application/json`. For negative tests, `rawData` sends a body as-is (with its `contentType`), and `accept` replaces the Accept header (`null` leaves it out).
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

`docs/api/contracts/*.md` document whole API areas, one file per area, including endpoints and status codes that no test covers yet: the coverage report measures the tests against them, so the gaps show. `/write-api-contracts` writes and updates them; the full format specification is `docs/api/CONTRACT_FORMAT.md` (a copy of the coverage package's, which owns the parser). Keep every contract in this format, so tooling can read them:

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
- `404 Not Found`: no product with this id _(spec)_   <- origin tag, see below
````

Every fact carries an origin tag, in this order of trust:
- `_(verified)_`: checked against the live API. Change it only after checking again.
- `_(source)_`: read from the API's source code.
- `_(spec)_`: only in the OpenAPI spec, not confirmed by the code.

Status codes the API returns where it shouldn't (for example a `500` for an unknown id) are documented as they are, marked as suspected bugs. With the coverage package installed, `npx playwright-api-coverage validate` checks the format and counts the status codes by origin.

## CI and GitHub Pages

- `.github/workflows/playwright-run.yml` is a reusable workflow: it runs one project (`ui` or `api`), then publishes the report with `scripts/publish-report.sh <family>`. The callers are `run-ui-tests.yml` / `run-api-tests.yml` (scheduled, weekdays, UTC) and `custom-ui-tests.yml` / `custom-api-tests.yml` (manual, with an area choice plus an optional `--grep`). When you add a folder under `tests/ui` or `tests/api`, add it to the `area` options of the matching custom workflow.
- Secrets `ADMIN_USER` and `ADMIN_PASSWORD` come from GitHub Secrets as environment variables; CI doesn't write a `.env` file.
- On CI, Playwright also writes `test-results/results.json`, which the dashboard reads.
- The publish script commits to the `gh-pages` branch: `<family>/run-<N>/` (report and `results.json`), `latest/<family>/` and `<family>-manifest.json`. It keeps the latest 30 runs per family (`KEEP_RUNS`) and retries the push if another workflow published first. Families: `daily-ui-regression`, `daily-api-regression`, `custom-ui`, `custom-api`.
- `index.html` in the repo root is the Pages dashboard. It's copied to `gh-pages` on every publish and loads the manifests and `results.json` files. Tests show up under "Known Issues" when they have an annotation whose description contains `Known issue`.
- **Installing the coverage package on CI:**
  - The package is an `optionalDependency` from GitHub Packages. `.npmrc` maps the `@zaytsman` scope to it and holds no token.
  - In `playwright-run.yml` and `pr-checks.yml`, `actions/setup-node` (`registry-url` + `scope`) and `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` on `npm ci` install it. This works because the package grants SimpRight read access in its settings.
  - It needs `packages: read`, and that also goes in every caller of the reusable workflow, because a called workflow can't have more permissions than its caller.
  - Without access (forks), `npm ci` skips it and the tests run without coverage.
  - Dependabot reads it through the `github-packages` registry in `dependabot.yml`, using the Dependabot secret `PACKAGES_READ_TOKEN`, a classic token with `read:packages` only. When that token expires, Dependabot's npm updates fail until it's replaced.
- API coverage is optional: when a run produces `test-results/api-coverage/`, the script publishes it with the run (and as `latest/api-coverage/` from the full API regression), and the dashboard shows its elements (`data-coverage`) only when `latest/api-coverage/summary.json` exists. UI runs set `DISABLE_API_COVERAGE=true`.
- **Test Cases pages:** the dashboard's "UI Test Cases" and "API Test Cases" buttons open `test-cases/ui/` and `test-cases/api/`, a browsable catalog of the scenarios (a tree that follows `test-scenarios/<layer>/<area>/<file>`, search, status and known-issue filters, steps, the scenario's YAML, links to the spec line and the user story).
  - One page for every layer: `scripts/build-test-cases.mts` (`npm run test-cases:build [-- <dir>]`) reads the profile and the scenario files and writes `<dir>/<layer>/index.html` (a copy of `site/test-cases/index.html`) and `scenarios-data.js` (`window.SCENARIO_CATALOG`; a script, not JSON, so the page also opens from disk). API files are labelled with their endpoint, found in the steps (`GET /products/{productId}` for `get-products-by-product-id.yml`); UI files with their file name.
  - `publish-test-cases.yml` runs on pushes to `main` that change the scenarios, the page, its build, the profile or `index.html` (and by hand): it validates the scenarios, then `scripts/publish-test-cases.sh` publishes `test-cases/` and `index.html`. So the dashboard shows the merged scenarios, and a dashboard change goes live on merge.
  - The buttons stay hidden until `test-cases/<layer>/scenarios-data.js` exists. `verify` builds the pages too, so a scenario change that breaks the build fails the pull request.
  - `scripts/gh-pages-lib.sh` (`ghp_checkout`, `ghp_publish`) holds the gh-pages worktree checkout and the push with retries, shared by both publish scripts.
- **Wiki:** `publish-wiki.yml` runs on pushes to `main` that change `docs/wiki/` (and by hand): it clones `<repo>.wiki.git` with `GITHUB_TOKEN` (`contents: write`), mirrors `docs/wiki/` into it with `rsync --delete`, and pushes when something changed. The wiki repository exists only after its first page was created in the web UI.
- `scripts/*.sh` must keep LF line endings (`.gitattributes`).
- `pr-checks.yml` runs the `verify` job on every pull request to `main` or `develop`; it's the required status check on `main`. Typecheck and scenario validation always run; `scripts/pr-test-scope.sh` then picks the tests from the files changed against the base branch:
  - `all`: a file that no spec imports but every run depends on changed (`playwright.config.ts`, `src/globalSetup.ts`, `src/envs/*`, `package*.json`, `tsconfig.json`, `.npmrc`, `pr-checks.yml`, the script itself). Add a new file of that kind to the script's list.
  - `changed`: only `src/` or `tests/` changed, so `playwright test --only-changed=<base>` runs the specs whose imports reach the changed files. Every spec imports `@fixtures`, which imports the whole framework, so in practice any `src/` change runs everything and a spec-only change runs just that spec.
  - `none`: nothing the tests depend on changed (docs, contracts, scenarios, `index.html`, `site/`, `.claude/`, other workflows), so the tests are skipped.
  - It stays one job with conditional steps, because a required check that is skipped as a whole never reports and blocks the merge.
  - Pull requests from forks and from Dependabot get no Actions secrets, so they run the typecheck and scenario validation only (Dependabot PRs run the tests too when the same two secrets are added under Dependabot secrets).

## Branches and pull requests

- `main` is the default branch and holds stable code only. Scheduled workflows run on it, so the nightly regressions and the dashboard reflect merged code. A ruleset blocks direct pushes, force pushes and deletion: changes arrive only through a pull request that passes `verify`, merged with a **merge commit** (squash and rebase are disabled).
- `develop` is where work happens: commit and push there directly (or use short-lived `feature/...` branches with a PR into `develop` for bigger changes). Force pushes and deletion are blocked.
- Release to `main` with a pull request `develop` → `main`. Never squash it: squashing a long-lived branch makes `develop` and `main` diverge.
- Dependabot version updates target `develop`. Security updates always target `main`; after merging one, merge `main` back into `develop` (`git switch develop && git merge origin/main`).
- Claude works on `develop` (or a feature branch), never commits or pushes to `main`, and leaves opening and merging pull requests to the user unless asked.
- Never add workflows triggered by `pull_request_target` that check out pull request code: that runs untrusted code with access to secrets.
