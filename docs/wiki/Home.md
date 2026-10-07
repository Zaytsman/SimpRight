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

## Test Runs

1. [CI Runs](CI-Runs): the GitHub Actions workflows, starting runs by hand, changing and adding schedules, where the results are.
2. [Local Runs](Local-Runs): running tests on your machine, and scheduling unattended runs with Task Scheduler or cron.

## Workflows

1. [Generate Scenarios](Generate-Scenarios): add UI and API test scenarios with the scenario-writer agents (or by hand), review and approve them.
2. [API Automation](API-Automation): turn API scenarios into tests with the API test engineer: plan, approve, implement, review, heal.
3. [UI Automation](UI-Automation): the same for UI scenarios, with the page inspector and the UI test engineer.

## Links

| | |
|---|---|
| Repository | [github.com/Zaytsman/SimpRight](https://github.com/Zaytsman/SimpRight) |
| Automation Portal (dashboard) | [zaytsman.github.io/SimpRight](https://zaytsman.github.io/SimpRight/) |
| UI Test Cases | [zaytsman.github.io/SimpRight/test-cases/ui](https://zaytsman.github.io/SimpRight/test-cases/ui/) |
| API Test Cases | [zaytsman.github.io/SimpRight/test-cases/api](https://zaytsman.github.io/SimpRight/test-cases/api/) |
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
