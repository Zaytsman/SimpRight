# 11. CI and publishing

GitHub Actions runs the tests, checks pull requests and publishes the results to GitHub Pages. One reusable workflow runs every test job; five small callers decide what to run and when. The wiki's [CI Pipeline](../wiki/CI-Pipeline.md), [CI Runs](../wiki/CI-Runs.md), [Scheduled Runs](../wiki/Scheduled-Runs.md) and [GitHub Pages Publishing](../wiki/GitHub-Pages-Publishing.md) pages have the operating details (how to start runs by hand, review their results, and change or add schedules).

```
run-api-tests.yml      weekdays 02:15 UTC ─┐
run-ui-tests.yml       weekdays 06:15 UTC ─┤
custom-api-tests.yml   by hand (area, grep) ├──► playwright-run.yml (reusable) ──► gh-pages: <family>/run-<N>/
custom-ui-tests.yml    by hand (area, grep) │      install, typecheck, tests,         latest/<family>/, manifests
smoke-tests.yml        by hand (@smoke)    ─┘      step titles, publish, artifact

pull request to main/develop ──► pr-checks.yml (verify): typecheck, validator, page builds   (required on main)
push to main ──► publish-test-cases.yml ──► gh-pages: test-cases/, bugs/, the portal
             └─► publish-wiki.yml       ──► the repository's wiki
```

## The reusable test job: `playwright-run.yml`

Inputs: `project` (`ui`, `api`, or `all`), `family` (where the report goes), `paths` (spec folders or files), `grep`, `publish-latest-coverage`. Secrets: `ADMIN_USER`, `ADMIN_PASSWORD`, declared under `workflow_call.secrets` and passed by name by each caller.

| Step | What and why |
|---|---|
| Checkout | `persist-credentials: false`: no token in the git config while dependencies install and tests run |
| Setup Node.js 24 | npm cache, and the GitHub Packages registry for the `@zaytsman` scope |
| `npm ci --ignore-scripts` | With `NODE_AUTH_TOKEN` = `GITHUB_TOKEN`, so the optional private coverage package installs (or is skipped where there's no access, as in forks). No dependency needs an install script, so none can run. |
| Browsers (UI runs) | Cached by the lockfile's hash; `npm run install:browsers` |
| Typecheck | Fails fast (under a second with TypeScript 7) |
| Run tests | `npx playwright test [--project] [--grep] [paths]`, with `continue-on-error`, so the report is still published. Mixed and UI runs set `DISABLE_API_COVERAGE=true`. On CI: 1 retry, 2 workers, `forbidOnly`, JUnit and JSON reporters. |
| Check step titles | `npm run check:step-titles`: a warning annotation per test whose step titles aren't its scenario's steps; doesn't fail the job |
| Publish report | `scripts/publish-report.sh <family>`, with `GH_TOKEN`: **the only step that gets a token that can push** |
| Upload artifact | `playwright-report/` and `test-results/`, kept 14 days |
| Fail the job | If the tests failed, with an error annotation linking to the published report |

Every input reaches a `run:` script through `env:`, never as `${{ }}` pasted into the script, so an input can't become shell code. On CI, `globalSetup` also waits when a run would cross the site's hourly re-seed ([2](02-configuration.md)); the 50-minute job timeout allows for it.

## The callers

| Workflow | Trigger | Runs | Family |
|---|---|---|---|
| `run-api-tests.yml` | weekdays 02:15 UTC, by hand | the API project; its coverage becomes the portal's API Coverage | `daily-api-regression` |
| `run-ui-tests.yml` | weekdays 06:15 UTC, by hand | the UI project | `daily-ui-regression` |
| `custom-api-tests.yml` / `custom-ui-tests.yml` | by hand: an area (a folder of `tests/<layer>/`) and an optional `--grep` | one area or all | `custom-api` / `custom-ui` |
| `smoke-tests.yml` | by hand | both projects, `--grep @smoke` | `smoke` |

Each caller declares `contents: write` (push to gh-pages) and `packages: read` (the coverage package), because a called workflow can't have more permissions than its caller. Schedules run at :15, never on the full hour: the site re-seeds at :00, and GitHub's schedule queue is busiest then. A new test folder needs an entry in the matching custom workflow's `area` options.

## Pull requests: `pr-checks.yml`

The `verify` job runs on every pull request to `main` or `develop` and is the **required check** on `main`. It's static: `npm run typecheck` (unused locals and parameters fail it), `npm run validate:scenarios`, and the Test Cases and Bugs page builds. It runs no tests, needs no secrets and no package token (`npm ci --ignore-scripts` skips the private package after a 401, as in forks), so pull requests from forks and Dependabot get the same check. A new push cancels the PR's running `verify`. Tests run locally before a push and in the nightly regressions on `main`.

## Publishing to GitHub Pages

The `gh-pages` branch is the site:

```
index.html                 the portal (copied from the repo root on every publish)
<family>/run-<N>/          one run's HTML report + results.json (+ api-coverage/)
<family>-manifest.json     the family's runs, newest first (the latest 30 are kept)
latest/<family>/           a copy of the newest run
latest/api-coverage/       the full API regression's coverage
test-cases/<layer>/        the Test Cases pages
bugs/                      the Bugs page
```

| Script | Does |
|---|---|
| `scripts/publish-report.sh <family> [--latest-coverage]` | Copies the run's report, `results.json` and coverage into `<family>/run-<N>/`, refreshes `latest/<family>/`, prunes to `KEEP_RUNS` (30), rebuilds the manifest. An unknown argument fails with the usage. |
| `scripts/publish-test-cases.sh` | Builds the Test Cases and Bugs pages and replaces `test-cases/` and `bugs/` |
| `scripts/gh-pages-lib.sh` | `ghp_checkout`: points `origin` at the repo with `GH_TOKEN`, checks out `gh-pages` as a worktree; `git ls-remote --exit-code` tells "no branch yet" (first publish: an orphan branch) from a real fetch error. `ghp_publish`: copies the portal and `.nojekyll`, commits as `github-actions[bot]`, pushes, and on a rejected push rebases and retries up to 3 times |

Each script touches only its own folders, so parallel publishes (a UI run, an API run, a Test Cases publish) rebase without conflicts. `scripts/*.sh` keep LF line endings (`.gitattributes`).

`publish-test-cases.yml` runs on pushes to `main` that change the scenarios, the bugs, the pages, their builds, the profile or `index.html`, so a portal change goes live on merge. `publish-wiki.yml` mirrors `docs/wiki/` into the repository's wiki on pushes to `main` that change it (`rsync --delete`, so pages removed in the repo are removed there). The wiki repository exists only after its first page was created in the web UI.

The portal's "Schedule Test Run" and "Wiki" buttons (`data-repo-link`) point at the repository's Actions tab and wiki; on `<owner>.github.io/<repo>/` the page rewrites them to that repository, so forks link to their own. Its coverage elements (`data-coverage`) show only when `latest/api-coverage/summary.json` exists.

## Security hardening

| Measure | Protects against |
|---|---|
| Every action pinned to a full commit SHA, with the version in a comment (`actions/checkout@<sha> # v7.0.1`) | A moved tag running other code (a SHA can't move) |
| `persist-credentials: false` everywhere; `GH_TOKEN` only in the publish steps | A dependency or test code reading a token that can push to `develop` or `gh-pages` |
| `npm ci --ignore-scripts` | Install scripts running while `NODE_AUTH_TOKEN` is set |
| Named secrets instead of `secrets: inherit` | A future secret reaching the test job by default |
| Inputs through `env:` | An input becoming shell code |
| Minimal permissions per workflow; the repository's default token is read-only | |
| No `pull_request_target` workflow | Pull request code running with access to secrets |
| Dependabot `cooldown: 7 days` | A hijacked release being proposed before it's caught |

## Dependabot

`.github/dependabot.yml` checks weekly (Tuesdays) and targets `develop`: npm (including the private package, through the `github-packages` registry and the Dependabot secret `PACKAGES_READ_TOKEN`) with minor and patch updates grouped, and GitHub Actions grouped (it updates the SHA pins with their version comments). Both wait 7 days after a release. Security updates aren't delayed and always target `main`; after merging one, `main` is merged back into `develop`.

## Branches

`main` holds stable code: a ruleset allows changes only through a pull request that passes `verify`, merged with a merge commit. `develop` is the working branch. Releases are a pull request from `develop` to `main`. Scheduled runs and publishing work from `main`, so the portal and the wiki reflect merged code.

## Changed in the review

- Actions pinned to commit SHAs (11 references; the same code as the tags at the time).
- Checkouts no longer keep the token; only the publish steps get `GH_TOKEN`. Before, the `contents: write` token was readable in `.git/config` for the whole job.
- `npm ci --ignore-scripts`; named secrets; inputs through `env:` in the publish and failure steps.
- `verify` no longer installs the private package (nothing there loads it) and dropped `packages: read`. A simulated fork install confirmed that npm skips the package after the 401.
- Publish scripts: the portal copy moved into `ghp_publish`, fetch errors are no longer mistaken for "no gh-pages branch", an unknown argument fails, and the redundant `chmod +x` lines are gone.
- Dependabot cooldown; nightlies moved from :00 to :15.
- New: the step-title check after the tests.
- Verified on CI with a manual run on `develop`: the install, the test and the gh-pages push with the new token handling all worked.

Details: [13. Code review, October 2026](13-code-review-2026-10.md).
