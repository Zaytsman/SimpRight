<!-- Source: docs/wiki/Installation-&-Setup.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# Installation & Setup

This page takes you from a fresh machine to a green test run: what to install, how to configure the framework, how to check the setup, and what's optional.

## 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| [Node.js](https://nodejs.org) | **22.18 or later** (developed on 24) | npm comes with it. Check with `node -v`. Older versions can't run the `.mts` scripts. |
| [Git](https://git-scm.com) | any recent | On Windows, Git for Windows also gives you Git Bash. |
| An admin account of the app | | The Toolshop demo lists its test accounts in the README of its [GitHub repository](https://github.com/testsmith-io/practice-software-testing). You need the **admin** one. |

Windows, macOS and Linux all work. The commands below show Bash; PowerShell variants are given where they differ.

## 2. Get the code

```bash
git clone https://github.com/Zaytsman/SimpRight.git
cd SimpRight
```

To contribute, [fork the repository](https://github.com/Zaytsman/SimpRight/fork) first, clone your fork, and branch from `develop` (see [Branches and contributing](https://github.com/Zaytsman/SimpRight#branches-and-contributing)).

## 3. Install the dependencies

```bash
npm install
```

This installs Playwright, TypeScript and the few helper libraries. The API coverage package is an **optional** dependency from a private registry: without access, npm skips it quietly and everything works without the coverage report (see [step 8](#8-optional-the-api-coverage-report)).

On CI, or to install exactly what the lockfile says, use `npm ci` instead.

## 4. Install the browser

```bash
npm run install:browsers
```

It installs Chromium with the system libraries it needs (`playwright install --with-deps chromium`). On Linux, installing those libraries may ask for your `sudo` password. The UI tests run on Desktop Chrome only, so no other browser is needed.

## 5. Configure the secrets

The framework reads its secrets from a `.env` file in the project root. Copy the example:

```bash
cp .env.example .env
```

PowerShell: `Copy-Item .env.example .env`

Then fill in the admin account:

```dotenv
ADMIN_USER=<admin email>
ADMIN_PASSWORD=<admin password>
```

- `.env` is **git-ignored**. Never commit it, and never put real values into `.env.example`.
- That's the only account you set up. The customer account (the `default` role) is **registered fresh for every run** and deleted afterwards by the admin, so it needs no settings. That's also why the admin is required even for a single customer test.
- The environment files in `src/envs/` refer to these values as `${ADMIN_USER}` and `${ADMIN_PASSWORD}` placeholders. Nothing with the resolved passwords is ever written to disk.

## 6. Check the setup

Run the two fast checks first. They don't touch the app:

```bash
npm run typecheck
npm run validate:scenarios
```

Then one read-only API test and one UI test:

```bash
npx playwright test -g "API-0101:"
npx playwright test -g "UI-001:"
```

If both pass, the setup works: the config loads, the run's customer is registered and logs in, and the browser starts. Now run everything:

```bash
npm test
npm run report
```

`npm run report` opens the HTML report of the last run, with traces, screenshots and videos of the failed tests.

### Useful commands

| Command | What it does |
|---|---|
| `npm test` | All tests (API and UI) |
| `npm run test:api` | API tests only |
| `npm run test:ui` | UI tests only |
| `npm run test:headed` | UI tests with a visible browser |
| `npm run test:debug` | Step through tests in the Playwright Inspector |
| `npx playwright test tests/ui/cart/add-to-cart.spec.ts` | One spec file |
| `npx playwright test -g "UI-002:"` | One test, by its scenario ID |
| `npx playwright test --project=ui --grep @products` | One suite tag (`@products` also matches `@products-api`, hence `--project`) |
| `npm run report` | Open the last HTML report |
| `npm run typecheck` | TypeScript check |
| `npm run validate:scenarios` | Check the scenario files, their IDs and their specs; prints the next free IDs |
| `npm run inspect:ui -- /auth/login --logged-out` | List a page's `data-test` elements and accessibility tree (for writing UI tests) |
| `npm run test-cases:build` | Build the Test Cases pages into `test-results/test-cases/` |

## 7. Choose how tests run (optional)

Three environment variables change how a run behaves:

| Variable | Values | Default | Purpose |
|---|---|---|---|
| `TEST_ENV` | the name of a file in `src/envs/` | `TEST` | The environment to test |
| `UI_AUTH_MODE` | `api`, `storageState` | `api` | How UI tests start logged in |
| `CI` | any value | not set | CI behaviour: 2 retries, 2 workers, JUnit output, `test.only` forbidden |

Setting one for a single run:

```bash
TEST_ENV=QA npm test
```

PowerShell: `$env:TEST_ENV="QA"; npm test`

**Environments.** Each environment is a JSON file in `src/envs/` with `baseUrl`, `apiBaseUrl`, timeouts and the admin user. To add one, copy `TEST.json` to a new file named in capitals (for example `QA.json`), change the URLs, and run with `TEST_ENV=QA`. The configuration is checked when a run starts: an unknown environment, an invalid URL or a missing `.env` variable stops the run straight away with a message that names the problem.

**Login modes.** The app keeps its login token in the browser's `localStorage`, and the token expires after 5 minutes.
- `api` (default): each UI test gets a fresh token through the API and starts logged in. Fast, and nothing is written to disk.
- `storageState`: before the run, every role logs in through the login page and the browser state is saved in `.auth/<role>.json` (git-ignored). Use it when you want the real UI login exercised.

## 8. Optional: the API coverage report

The coverage report shows which documented endpoints, status codes, request fields and query parameters the API tests exercise. It comes from the private package `@zaytsman/playwright-api-coverage`, so it needs access granted by the owner.

With access:
1. Create a GitHub **classic** token with the `read:packages` scope only.
2. Add it to your **user** npm config (`~/.npmrc`, on Windows `%USERPROFILE%\.npmrc`), never to the repository's `.npmrc`. `.npmrc.example` shows the line:
   ```ini
   //npm.pkg.github.com/:_authToken=<your token>
   ```
3. Run `npm install` again.

After an API run, the report is in `test-results/api-coverage/index.html`. Set `DISABLE_API_COVERAGE=true` to turn it off. Passing `--reporter` on the command line also turns it off, because it replaces the configured reporters.

## 9. Optional: editor and AI tools

- **VS Code** works well with two extensions: [Playwright Test for VS Code](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright) (run and debug tests from the editor) and [YAML](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) (the scenario files point to their schema, so you get checks and autocomplete while editing them).
- **[Claude Code](https://claude.com/claude-code)** runs the project's AI agents. Open the project folder in it and the commands in `.claude/skills/` (`/write-ui-scenarios`, `/implement-api-scenarios`, `/review-tests`, `/heal-tests` and others) are available. See [docs/AI_WORKFLOW.md](https://github.com/Zaytsman/SimpRight/blob/main/docs/AI_WORKFLOW.md).

## 10. Optional: CI in your fork

The workflows in `.github/workflows/` run in a fork too:

1. Add the repository secrets `ADMIN_USER` and `ADMIN_PASSWORD` (Settings → Secrets and variables → Actions).
2. Run a workflow, for example **API Regression Test Run**, from the Actions tab. The first run creates the `gh-pages` branch.
3. Turn on GitHub Pages from the `gh-pages` branch (Settings → Pages) to get the dashboard.
4. For the wiki: turn on Wikis (Settings → General → Features) and create any first page in the web UI. After that, the **Publish Wiki** workflow copies `docs/wiki/` to the wiki whenever it changes on `main`.

Forks don't have access to the coverage package, so their runs have no coverage report. Everything else works the same.

## Troubleshooting

| Problem | Cause and fix |
|---|---|
| PowerShell: *"...ps1 cannot be loaded... not digitally signed"* | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or use `npm.cmd` / `npx.cmd`, or another terminal (cmd, Git Bash). |
| *Missing environment variables: ADMIN_USER...* | `.env` is missing or incomplete: see [step 5](#5-configure-the-secrets). |
| A login or registration returns **500**, often right at the full hour | The demo site re-seeds its data every hour, and calls fail for a minute or two. Re-run a little later. |
| A login returns **423 Locked** | Too many wrong passwords locked the account. It unlocks after a while; don't retry in a loop. Never test wrong passwords against a shared account. |
| *Executable doesn't exist* when UI tests start | The browser isn't installed: run `npm run install:browsers`. |
| No `test-results/api-coverage/` after an API run | The coverage package isn't installed (see [step 8](#8-optional-the-api-coverage-report)), or `--reporter` or `DISABLE_API_COVERAGE` turned it off. |
| *Unknown TEST_ENV=...* | There's no `src/envs/<NAME>.json` for that name; the message lists the available ones. |

Next: [Project Structure](Project-Structure).
