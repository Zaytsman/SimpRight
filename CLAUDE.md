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
npm run validate:scenarios        # profile, bugs, scenario files, IDs and specs
npm run check:step-titles         # step titles vs scenario steps, from a JSON report (default test-results/results.json)
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
- After login, admin lands on `/admin/dashboard`, a customer on `/account`. `navBar.userMenu` shows only when logged in: use it to check login.
- Live-app guardrails in `simpright.yml`: `liveApi.writes: ask`, UI writes included.

## Layout

- `src/ui/visitor/`: the app's browser-storage state (location, cart).
- `.claude/agents/` and `.claude/skills/`: the QA agents and the skills that start them (each skill's description says what it does; overview in `docs/framework/12-ai-agents.md`). The chain is contracts → scenarios → specs; stories and bugs go through `/analyze-requirements`. Agents read `simpright.yml` and keep no project facts of their own.
- `docs/framework/`: how the framework works, one document per area, and `conventions.md`; when a change alters how an area works, update its document too.
- `docs/wiki/`: the wiki's source (one file per page, plus `_Sidebar.md`), published on pushes to `main`; never edit in the web editor. Page links use the page name without `.md`, repo links full `github.com/.../blob/main/...` URLs; each page starts with a comment naming its source; a new page needs a sidebar entry.

## Configuration

Details: `docs/framework/02-configuration.md`.
- `testUsers` holds the admin only; `.env` holds its secrets (`ADMIN_USER`, `ADMIN_PASSWORD`). `.npmrc` holds only the scope mapping of the private API coverage package (`@zaytsman/playwright-api-coverage`), never a token (see `.npmrc.example`).
- **The run's customer (the `default` role):** the demo site publishes its default customer's credentials, so other people's failed logins kept locking it (423). Instead the project's `beforeRun` (`src/config/project.ts`) registers a new customer per run (`createRunUser`, `src/api/auth/runUser.ts`) and hands it to the workers with `setRunUser`, and `afterRun` deletes it as admin after the run (a failed delete only warns).
  - The login check retries a 5xx, a dropped connection or a timeout with a new customer for up to 4 minutes (a delayed run can start during the hourly re-seed); other errors fail at once. The re-seed deletes the customer too, so on CI `beforeRun` first waits until :03 when the run would start between :45 and :02 UTC.
  - **Never send wrong passwords for a shared account:** a lockout test registers its own customer.

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
