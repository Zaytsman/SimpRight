<!-- Source: docs/wiki/Home.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# SimpRight

**SimpRight** is an automated test framework built with **TypeScript** and **Playwright**. It tests the UI and API of the [Practice Software Testing](https://practicesoftwaretesting.com) Toolshop, a public demo web shop.

It is also an example of **AI-assisted test automation**: Claude Code agents write API contracts, test scenarios and specs, review the tests and diagnose failures, and a person approves each step.

## Highlights

- **UI tests** built on page objects, reusable components and multi-page flows.
- **API tests** built on typed clients, services and DTOs.
- **One set of fixtures** for both layers, with role-based test users. Tests start already logged in.
- **Per-environment config** in JSON. Secrets stay in a git-ignored `.env`.
- **Test scenarios in YAML** are the source of truth for what gets automated. A schema and a validator keep scenarios and specs in sync.
- **API contracts** document each API area. An optional coverage report measures the tests against them.
- **CI on GitHub Actions** with daily regressions, pull request checks and a dashboard on GitHub Pages.
- **AI agents** for the whole cycle: contracts → scenarios → specs → review → healing.

## Getting Started

1. [Installation & Setup](Installation-&-Setup): install the framework, configure it and run the first tests.
2. [Project Structure](Project-Structure): what lives where, and where new code goes.

## Test Scenarios

1. [Add API Scenarios](Add-API-Scenarios): from a story or bug (`/analyze-requirements`), a contract (`/write-api-scenarios-from-contract`), your test steps, request/response JSON or a Bruno collection (`/write-api-scenarios-from-steps`), or by hand.
2. [Add UI Scenarios](Add-UI-Scenarios): from a story or bug (`/analyze-requirements`), your test steps in plain text (`/write-ui-scenarios-from-steps`), or by hand.

## Automation

1. [API Automation](API-Automation): turn API scenarios into tests with the API test engineer: plan, approve, implement, review, heal.
2. [UI Automation](UI-Automation): the same for UI scenarios, with the page inspector and the UI test engineer.

## Test Runs

1. [CI Runs](CI-Runs): starting custom and smoke runs by hand on GitHub Actions, and reviewing their results on the Automation Portal.
2. [Local Runs](Local-Runs): running tests on your machine, and scheduling unattended runs with Task Scheduler or cron.

## Skills

Each slash command, the agent it starts and what you get:

| Skill | Agent | Does |
|---|---|---|
| [/analyze-requirements](Analyze-Requirements) | `requirements-analyst`, then `api-scenario-writer` and `ui-scenario-writer` | An analysis and a test plan from a story or bug, API first, then scenarios for both layers |
| [/write-api-contracts](Write-API-Contracts) | `api-contract-writer` | API contracts from source code or an OpenAPI spec |
| [/write-api-scenarios-from-contract](Write-API-Scenarios-From-Contract) | `api-scenario-writer` | API scenarios from a contract, endpoint by endpoint |
| [/write-api-scenarios-from-steps](Write-API-Scenarios-From-Steps) | `api-scenario-writer` | API scenarios from your test steps, request/response JSON or a Bruno collection |
| [/write-ui-scenarios-from-steps](Write-UI-Scenarios-From-Steps) | `ui-scenario-writer` | UI scenarios from your test steps in plain text |
| [/implement-api-scenarios](Implement-API-Scenarios) | `api-test-engineer` | API specs and framework code from scenarios |
| [/implement-ui-scenarios](Implement-UI-Scenarios) | `ui-test-engineer` | UI specs, page objects and flows from scenarios |
| [/review-tests](Review-Tests) | `test-reviewer` | Ranked review findings, then the fixes you pick |
| [/heal-tests](Heal-Tests) | `test-healer` | Why tests failed, then the fixes you pick |
| [/report-bug](Report-Bug) | `bug-reporter` | Bugs in the app, one per root cause, linked to their scenarios; imports and re-checks |

## Continuous Integration

1. [CI Pipeline](CI-Pipeline): the GitHub Actions workflows, the reusable test job, the `verify` pull request check and its test scopes, secrets, permissions and Dependabot.
2. [Scheduled Runs](Scheduled-Runs): the nightly regressions, and how to change, add, pause or stop a schedule.
3. [GitHub Pages Publishing](GitHub-Pages-Publishing): what the CI publishes to `gh-pages`, by which script, and how the branch stays small.
4. [Automation Portal](Automation-Portal): the dashboard: status, charts, known issues, coverage and run history.
5. [Test Cases Pages](Test-Cases-Pages): the browsable catalog of UI and API scenarios, and how it is built and published.
6. [Bugs Page](Bugs-Page): the bugs found in the app, the tests that hit them and their latest results.

## Architecture

How the framework is designed, one page per area (the rules a new test must follow are in [CLAUDE.md](https://github.com/Zaytsman/SimpRight/blob/main/CLAUDE.md)):

1. [Architecture](Architecture): the layers, the folders, what happens during a run, the design principles.
2. [Configuration](Configuration): environments, secrets, `env.ts`, `playwright.config.ts`, projects, the run's customer, login modes.
3. [Fixtures](Fixtures): the fixture tree: shared, API and UI fixtures, precondition fixtures, cleanup, what `@fixtures` exports.
4. [API Layer](API-Layer): `BaseClient`, clients, services, DTOs, tokens, error handling, the coverage hook.
5. [API Specs](API-Specs): how an API test is written: steps, shared checks, step helpers, templates, attachments.
6. [UI Layer](UI-Layer): pages, components, dialogs, flows, waits, visitor state, Cloudflare handling.
7. [UI Specs](UI-Specs): how a UI test is written: preconditions, setup helpers, steps and checks.
8. [Test Data](Test-Data): seeded constants, factories, unique names, throwaway users, cleanup, shared-data safety.
9. [Scenarios, Bugs and Validation](Scenarios-Bugs-and-Validation): scenario files, bug files, the project profile, the validator, the step-title check, the smoke set.
10. [Reporting and Secrets](Reporting-and-Secrets): reporters, attachments, assertion messages, masking, what never reaches a report.
11. [CI and Publishing](CI-and-Publishing): the workflows, the reusable test job, GitHub Pages, hardening, Dependabot.
12. [AI Agents](AI-Agents): the agents and skills, the profile they read, the exemplars they copy.

## Links

| | |
|---|---|
| Repository | [github.com/Zaytsman/SimpRight](https://github.com/Zaytsman/SimpRight) |
| Automation Portal (dashboard) | [zaytsman.github.io/SimpRight](https://zaytsman.github.io/SimpRight/) |
| UI Test Cases | [zaytsman.github.io/SimpRight/test-cases/ui](https://zaytsman.github.io/SimpRight/test-cases/ui/) |
| API Test Cases | [zaytsman.github.io/SimpRight/test-cases/api](https://zaytsman.github.io/SimpRight/test-cases/api/) |
| Bugs | [zaytsman.github.io/SimpRight/bugs](https://zaytsman.github.io/SimpRight/bugs/) |
| The AI workflow | [docs/AI_WORKFLOW.md](https://github.com/Zaytsman/SimpRight/blob/main/docs/AI_WORKFLOW.md) |
| Conventions in detail | [CLAUDE.md](https://github.com/Zaytsman/SimpRight/blob/main/CLAUDE.md) |

## Tech stack

| | |
|---|---|
| Language | TypeScript 7 (strict) |
| Test runner | Playwright Test 1.63 (Chromium for UI tests) |
| Runtime | Node.js 22.18 or later (developed on 24) |
| Config | JSON per environment, `.env` for secrets (dotenv) |
| Scenarios | YAML, checked with a JSON Schema (ajv) |
| CI | GitHub Actions, reports on GitHub Pages |
| AI | Claude Code agents and skills (`.claude/`) |
