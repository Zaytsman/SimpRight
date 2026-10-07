<!-- Source: docs/wiki/CI-Pipeline.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# CI Pipeline

How SimpRight's GitHub Actions are put together: the workflows, the reusable test job, the pull request check and how it picks which tests to run, secrets and permissions, and Dependabot. To start or schedule runs, see [CI Runs](CI-Runs).

```
                ┌──────── run-api-tests.yml  (weekdays 02:00 UTC)
                ├──────── run-ui-tests.yml   (weekdays 06:00 UTC)
 test runs  ────┤                                              ──► playwright-run.yml ──► gh-pages
                ├──────── custom-api-tests.yml (by hand)            (reusable)            (reports)
                └──────── custom-ui-tests.yml  (by hand)

 pull requests ────────── pr-checks.yml (verify) ──► typecheck, scenarios, Test Cases build, affected tests

 push to main ──┬──────── publish-test-cases.yml ──► gh-pages (Test Cases pages + portal)
                └──────── publish-wiki.yml       ──► the wiki
```

## The workflows

| File | Name in Actions | Trigger | Job |
|---|---|---|---|
| `playwright-run.yml` | Playwright Run (reusable) | called by the four below | Runs one Playwright project, publishes the report |
| `run-api-tests.yml` | API Regression Test Run | weekdays 02:00 UTC, by hand | All API tests; also publishes the coverage as the latest |
| `run-ui-tests.yml` | UI Regression Test Run | weekdays 06:00 UTC, by hand | All UI tests |
| `custom-api-tests.yml` | Custom API Test Run | by hand (area, grep) | One API area or all, optionally filtered |
| `custom-ui-tests.yml` | Custom UI Test Run | by hand (area, grep) | One UI area or all, optionally filtered |
| `pr-checks.yml` | PR Checks | pull requests to `main` or `develop` | The `verify` job |
| `publish-test-cases.yml` | Publish Test Cases | push to `main` changing scenarios, the page, its scripts, the profile or `index.html`; by hand | Validates the scenarios, builds and publishes the Test Cases pages and the portal |
| `publish-wiki.yml` | Publish Wiki | push to `main` changing `docs/wiki/`; by hand | Mirrors `docs/wiki/` into the wiki |

## The reusable test job: `playwright-run.yml`

Every test run goes through one job, so the four callers stay a dozen lines each.

| Input | Meaning |
|---|---|
| `project` | `ui` or `api` |
| `family` | The report family on GitHub Pages (`daily-ui-regression`, `daily-api-regression`, `custom-ui`, `custom-api`) |
| `paths` | Spec folders or files, space-separated; empty = the whole project |
| `grep` | Only tests whose title matches |
| `publish-latest-coverage` | Publish this run's API coverage as the portal's API Coverage (the full API regression only) |

Its steps:

1. Check out, set up Node.js 24 with the npm cache and the GitHub Packages registry for the `@zaytsman` scope.
2. `npm ci`, with `NODE_AUTH_TOKEN` = `GITHUB_TOKEN`, so the optional private coverage package installs (or is skipped where there's no access, as in forks).
3. UI runs only: restore the browser cache, `npm run install:browsers`.
4. `npm run typecheck`.
5. Run the tests: `npx playwright test --project=<project> [--grep <grep>] [paths]`. The step **continues on error**, so the report is still published. UI runs set `DISABLE_API_COVERAGE=true`: their only API calls are logins, which would make a misleading coverage report.
6. Publish the report to `gh-pages` (`scripts/publish-report.sh <family>`; see [GitHub Pages Publishing](GitHub-Pages-Publishing)).
7. Upload `playwright-report/` and `test-results/` as an artifact (kept 14 days).
8. Fail the job if tests failed, with an error annotation that links to the published report.

On CI, Playwright adds 2 retries, 2 workers, `forbidOnly`, and two more reporters: JUnit (`test-results/junit.xml`) and JSON (`test-results/results.json`, which the portal reads).

## Secrets and permissions

| Secret | Where | Used for |
|---|---|---|
| `ADMIN_USER`, `ADMIN_PASSWORD` | Actions secrets | The admin account; passed to the tests as environment variables (CI writes no `.env`). The customer account is registered per run |
| `GITHUB_TOKEN` | built in | Pushing to `gh-pages` and the wiki; installing the coverage package |
| `PACKAGES_READ_TOKEN` | Dependabot secret | Dependabot's access to the private package (a classic token with `read:packages` only) |

Permissions are declared per workflow and kept minimal:

- test runs: `contents: write` (push to `gh-pages`) and `packages: read` (the coverage package). A called workflow can't have more permissions than its caller, so **every caller declares both**;
- `pr-checks.yml`: `contents: read`, `packages: read`;
- publish workflows: `contents: write`.

No workflow uses `pull_request_target`, so pull request code never runs with access to secrets.

## The pull request check: `verify`

`verify` runs on every pull request to `main` or `develop`, and it's the **required check** on `main`. It's one job with conditional steps, because a required check that is skipped as a whole never reports and would block the merge.

1. **Always:** `npm run typecheck`, `npm run validate:scenarios`, and `npm run test-cases:build` (the Test Cases pages must still build).
2. **Decide the test scope** with `scripts/pr-test-scope.sh` from the files changed against the base branch.
3. **Run the tests** the scope asks for (Chromium is installed only when tests run).
4. On failure, upload the report as an artifact (kept 7 days).

### Test scopes

| Scope | When | Tests run |
|---|---|---|
| `all` | A file every run depends on but no spec imports changed: `playwright.config.ts`, `src/globalSetup.ts`, `src/envs/*`, `package.json`, `package-lock.json`, `tsconfig.json`, `.npmrc`, `pr-checks.yml`, `pr-test-scope.sh` | `npx playwright test` |
| `changed` | Only `src/` or `tests/` changed | `npx playwright test --only-changed=<base>`: the specs whose imports reach the changed files |
| `none` | Nothing the tests depend on changed: docs, wiki, contracts, scenarios, the portal, `site/`, `.claude/`, other workflows | No tests (a notice says so) |

Every spec imports `@fixtures`, which imports the whole framework, so in practice any change under `src/` runs everything, and a change to one spec runs just that spec.

**When you add a file** that every run depends on but no spec imports (a new environment file format, a new setup script), add it to the `all` list in `scripts/pr-test-scope.sh`.

### Forks and Dependabot

Pull requests from forks and from Dependabot get no repository secrets. `verify` notices that and runs the static checks only (typecheck, scenario validation, Test Cases build). Dependabot pull requests run the tests too once the admin secrets are also added as Dependabot secrets.

### Concurrency

A new push to a pull request cancels its running `verify`. Publishing is never cancelled: Publish Test Cases and Publish Wiki queue their own runs, test runs can publish in parallel, and the publish scripts retry a rejected push.

## Branches and rules

- `main` is protected by a ruleset: changes only through a pull request that passes `verify`, merged with a **merge commit** (squash and rebase are off); no force pushes, no deletion.
- `develop` is the working branch: no force pushes, no deletion.
- Scheduled runs, Test Cases and wiki publishing all work from `main`, so the portal and the wiki reflect merged code.

## Dependabot

`.github/dependabot.yml` checks weekly, on Tuesdays, and targets `develop`:

| Ecosystem | Grouping | Commit prefix |
|---|---|---|
| npm (including the private package, through the `github-packages` registry) | minor and patch updates in one pull request; majors on their own | `deps` |
| GitHub Actions | all updates in one pull request | `ci` |

Security updates ignore `target-branch` and always open against `main`; after merging one, merge `main` back into `develop`.

## Changing the pipeline

| Change | Where |
|---|---|
| A new test area folder | Add it to the `area` options of `custom-ui-tests.yml` or `custom-api-tests.yml` |
| A new scheduled run | A new caller of `playwright-run.yml` (example in [CI Runs](CI-Runs#add-a-new-scheduled-run)) |
| A file every run depends on | The `all` list in `scripts/pr-test-scope.sh` |
| A new secret | Actions secrets, the `env:` of `playwright-run.yml` and `pr-checks.yml`, `.env.example`, and the environment JSON placeholders |
| Shell scripts | Keep LF line endings (`.gitattributes` enforces it for every `*.sh`) |

See also: [CI Runs](CI-Runs), [GitHub Pages Publishing](GitHub-Pages-Publishing).
