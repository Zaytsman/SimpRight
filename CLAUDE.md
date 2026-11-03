# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Size rule:** keep this file and `docs/framework/conventions.md` each under 200 lines and 30 KB, no line over 500 characters. They hold rules and pointers; explanations go in `docs/framework/`, and what a schema or the validator enforces isn't repeated. A rule that holds for any project built on the framework goes in `conventions.md`; one about SimpRight (the Toolshop, this repository, its CI and branches) goes here.

The framework's conventions, which the sections below add to:
@docs/framework/conventions.md

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
npm run validate:scenarios        # bugs, scenario files, IDs and specs; prints the next free IDs
npm run check:step-titles         # step titles vs scenario steps, from a JSON report (default test-results/results.json)
npm run doctor                    # simpright.yml, runs vs workflows, the kit's actions, the generated files, the core boundary, the core vs SimpRightTemplate (reads GitHub)
npm run apply -- --dry-run        # the diff of the workflows and dependabot.yml from simpright.yml; without --dry-run, writes them
npm run report                    # open last HTML report
npm run inspect:ui -- /auth/login --logged-out   # page inspector: data-test elements + accessibility tree
npm run test-cases:build          # Test Cases pages into test-results/test-cases/<layer>/ (open index.html)
npm run bugs:build                # Bugs page into test-results/bugs/ (open index.html)
npm run portal:build              # portal.json, what the dashboard shows, into test-results/portal/
```

## The app under test (the Toolshop)

Details: `docs/framework/04-api-layer.md`, `docs/framework/06-ui-layer.md`.
- **Login:** `POST /users/login` returns `access_token` (300 s); the project's API login is `apiLogin`. The app keeps its JWT in `localStorage['auth-token']`; it expires after 5 minutes. The JWT's `role` claim is `admin` or `user`; `/users/me` returns `role` only for admin.
- The test-id attribute is `data-test`.
- `AppPage` is the app's base page: every page has `navBar`, `toast` (role `alert`) and `getCartId()` from it. Amounts are read with `parseAmount` (`src/utils/amounts.ts`).
- **Never `goto('/checkout')`:** Cloudflare's bot check blocks most direct loads from GitHub-hosted runners (never seen locally); `AppPage.goto()` then throws "Blocked by the site's Cloudflare bot check (environment)". Reach the checkout with `CartPage.open()`: it clicks the nav bar's cart link, then waits for `GET /carts/{id}` and fails with its status when the cart doesn't load. Only `openWithoutCart()` loads it directly.
  - The link shows only when sessionStorage has `cart_quantity`, which `setVisitorCart` sets with the cart id. When no page of the app is open, `open()` loads the home page first and waits until it has loaded: a click right after the load can be lost.
  - The page inspector can't put anything in a cart, so it can't reach the checkout steps after the cart: their locators come from the app's source (`sprint5/UI/src/app/checkout/` in the practice-software-testing repository), checked against the live page.
- After login, admin lands on `/admin/dashboard`, a customer on `/account`. `navBar.userMenu` shows only when logged in: use it to check login.
- **Records that block cleanup:** invoices can't be deleted (no `DELETE /invoices`), and a customer with an invoice can't be deleted (409), so a test that creates an invoice leaves it and its customer until the hourly re-seed. A cart item or a favourite blocks deleting its product or user (409): cleanup removes carts and favourites first.
- Live-app guardrails in `simpright.yml`: `liveApi.writes: ask`, UI writes included.

## Layout

- `src/ui/visitor/`: the app's browser-storage state (location, cart).
- `.claude/agents/` and `.claude/skills/`: the QA agents and the skills that start them (each skill's description says what it does; overview in `docs/framework/12-ai-agents.md`). The chain is contracts → scenarios → specs; stories and bugs go through `/analyze-requirements`. Agents read `simpright.yml` and keep no project facts of their own.
- `docs/framework/`: how the framework works, one document per area, and `conventions.md`; when a change alters how an area works, update its document too.
- **The core is shared with [SimpRightTemplate](https://github.com/Zaytsman/SimpRightTemplate)** (public, `main` only, versions are tags `vX.Y.Z`): a change to a core file (`core.files`) is made in the template too, in the same piece of work; tag a new template version, then set `template` in `simpright.yml`. `npm run doctor` fails `verify` until they match.
- **The scenarios, portal and CI parts are the [SimpRight Kit](https://github.com/Zaytsman/SimpRightKit)'s:** its npm packages (`simpright`, `@simpright/scenarios`, `@simpright/portal`, pinned to one exact version) and its CI actions (pinned to that release's commit): the validator, `doctor`, `apply`, the scenario and bug schemas (`paths` points into `node_modules`), the portal's pages and publishing, the workflows' steps.
  - They change in the kit, in a release; the package and action pins here move together (one Dependabot pull request; `doctor` checks them).
- `docs/wiki/`: the wiki's source (one file per page, plus `_Sidebar.md`), published on pushes to `main`; never edit in the web editor. Page links use the page name without `.md`, repo links full `github.com/.../blob/main/...` URLs; each page starts with a comment naming its source; a new page needs a sidebar entry.

## Configuration

Details: `docs/framework/02-configuration.md`.
- `testUsers` holds the admin only; `.env` holds its secrets (`ADMIN_USER`, `ADMIN_PASSWORD`). `.npmrc` holds only the scope mapping of the private API coverage package (`@zaytsman/playwright-api-coverage`), never a token (see `.npmrc.example`).
- **The run's customer (the `default` role):** the demo site publishes its default customer's credentials, so other people's failed logins kept locking it (423). Instead the project's `beforeRun` (`src/config/project.ts`) registers a new customer per run (`createRunUser`, `src/api/auth/runUser.ts`) and hands it to the workers with `setRunUser`, and `afterRun` deletes it as admin after the run (a failed delete only warns).
  - The login check retries a 5xx, a dropped connection or a timeout with a new customer for up to 4 minutes (a delayed run can start during the hourly re-seed); other errors fail at once. The re-seed deletes the customer too, so on CI `beforeRun` first waits until :03 when the run would start between :45 and :02 UTC.
  - **Never send wrong passwords for a shared account:** a lockout test registers its own customer.

## CI and GitHub Pages

Details: `docs/framework/11-ci-and-publishing.md` and the wiki's CI and Pages pages.
- **The workflows and `.github/dependabot.yml` are generated** by `npm run apply` (`simpright apply`) from `simpright.yml`: never edit them by hand. After a change to `runs`, `ci` or `parts`, a new folder under `tests/ui` or `tests/api` (the custom runs' `area` options) or a new kit version, run `npm run apply -- --dry-run`, read the diff, then `npm run apply`. `.simpright/state.json` (committed) records what it wrote; `doctor` fails `verify` until the files match.
- `playwright-run.yml` is the reusable test job; its callers are the scheduled (`run-ui-tests.yml`, `run-api-tests.yml`), manual (`custom-*-tests.yml`) and smoke (`smoke-tests.yml`) workflows. Its `keep-runs` input (default 10) sets how many runs of the family stay on Pages; `squash-gh-pages.yml` (monthly) replaces the `gh-pages` history with one commit.
- **Each caller comes from a `runs` entry in `simpright.yml`:** its `id` is the caller's `family`, its `workflow` the file name, which never changes once the workflow has run (GitHub numbers a workflow's runs per file, and the portal keeps a family's highest numbers).
- The workflows' steps are the kit's actions (`Zaytsman/SimpRightKit/actions/<name>`: `setup`, `run-tests`, `publish-run`, `publish-pages`, `squash-pages`, `publish-wiki`), pinned to the commit of the kit release the packages pin; `doctor` checks the pins and the inputs each step passes. A change to an action is a kit release.
- `pr-checks.yml` (`verify`, required on `main`): typecheck, scenario validation, `doctor` (the setup, the generated files, and the core against the template) and the build of the portal's pages (`simpright-portal build-pages`); static only. Tests run locally before a push (each changed spec three times) and nightly on `main`.
- **Hardening:** the generated workflows follow the kit's rules, and a hand-written workflow must too ([its CI README](https://github.com/Zaytsman/SimpRightKit/blob/main/actions/README.md#the-rules-they-follow)): actions pinned to full commit SHAs with the version in a comment, `persist-credentials: false`, a token only for the steps that push, `npm ci --ignore-scripts`, inputs through `env:`, secrets passed by name (`ci.secrets`), `packages: read` in every caller.
- Scheduled runs start at :15, never on the hour (the site re-seeds at :00). GitHub often starts them hours late, so a red scheduled run is checked against its real start time first.
- The dashboard (`index.html`) lists a test under "Known Issues" when an annotation contains `Known issue`; the bug ID in `Known issue BUG-001: ...` links to the Bugs page.
- **The portal pages (`@simpright/portal`) name nothing themselves:** the brand, runs and thresholds come from `simpright.yml` (`portal`, `runs`), through `portal.json` (written next to `index.html` on every publish) or the Test Cases and Bugs data files.
- The Test Cases and Bugs pages are built from the scenarios and bugs (`npm run test-cases:build`, `npm run bugs:build`) and published by `publish-test-cases.yml` on pushes to `main` (also when `package-lock.json` changes, as with a new kit version); `verify` builds them too, so a scenario change that breaks the build fails the PR.
- Publishing writes its files with `simpright-portal` (`publish-run`, `build-pages`), so it runs on any OS; the kit actions' `.sh` scripts only check out, commit and push.

## Branches and pull requests

- `main`: stable code, the scheduled runs and the dashboard. Changes arrive only through a pull request that passes `verify`, merged with a **merge commit** (no squash or rebase).
- `develop`: where work happens (commit there, or short-lived `feature/...` branches with a PR into `develop`). Release with a PR `develop` → `main`, never squashed.
- Dependabot version updates target `develop`; security updates target `main`, and after merging one, merge `main` back into `develop`.
- Claude works on `develop` (or a feature branch), never commits or pushes to `main`, and leaves opening and merging pull requests to the user unless asked.
- Never add workflows triggered by `pull_request_target` that check out pull request code: that runs untrusted code with access to secrets.
