# SimpRight framework documentation

How the SimpRight test framework works: its parts, what each one is responsible for, how they fit together, and what the October 2026 code review changed. One document per area, so each stays short enough to read in one sitting.

These pages explain the **design** of the framework. Other documents cover the rest:

| You want to... | Read |
|---|---|
| Install, run tests, schedule CI runs, use the agents | The [GitHub wiki](https://github.com/Zaytsman/SimpRight/wiki) (source in [`docs/wiki/`](../wiki/)) |
| Know the exact rules a new test must follow | [`CLAUDE.md`](../../CLAUDE.md): the conventions, which the agents and the validator use |
| See how the AI agents chain together | [`docs/AI_WORKFLOW.md`](../AI_WORKFLOW.md) |
| Read an API area's contract | [`docs/api/contracts/`](../api/contracts/) |

When a page here and `CLAUDE.md` disagree, `CLAUDE.md` is the rule and this page is out of date.

## The documents

| # | Document | What it covers |
|---|---|---|
| 1 | [Architecture](01-architecture.md) | The layers, the folders, what happens during a run, the design principles |
| 2 | [Configuration](02-configuration.md) | Environments, secrets, `env.ts`, `playwright.config.ts`, projects, the run's customer, login modes |
| 3 | [Fixtures](03-fixtures.md) | The fixture tree: shared, API and UI fixtures, precondition fixtures, cleanup, what `@fixtures` exports |
| 4 | [API layer](04-api-layer.md) | `BaseClient`, clients, services, DTOs, tokens, error handling, the coverage hook |
| 5 | [API specs](05-api-specs.md) | How an API test is written: steps, shared checks, step helpers, templates, attachments |
| 6 | [UI layer](06-ui-layer.md) | Pages, components, dialogs, flows, waits, visitor state, Cloudflare handling |
| 7 | [UI specs](07-ui-specs.md) | How a UI test is written: preconditions, setup helpers, steps and checks |
| 8 | [Test data](08-test-data.md) | Seeded constants, factories, unique names, throwaway users, cleanup, shared-data safety |
| 9 | [Scenarios and bugs](09-scenarios-and-bugs.md) | Scenario files, bug files, the project profile, the validator, the step-title check, the smoke set |
| 10 | [Reporting and secrets](10-reporting-and-secrets.md) | Reporters, attachments, assertion messages, masking, what never reaches a report |
| 11 | [CI and publishing](11-ci-and-publishing.md) | The workflows, the reusable test job, GitHub Pages, hardening, Dependabot |
| 12 | [AI agents](12-ai-agents.md) | The agents and skills, the profile they read, the exemplars they copy |
| 13 | [Code review, October 2026](13-code-review-2026-10.md) | What the global review found and changed, slice by slice, with the numbers |

Every area document ends with a **"Changed in the review"** section: the short list for that area. Document 13 has the full story.

## Reading paths

- **New to the project:** 1 → 2 → 3, then 4–5 (API) or 6–7 (UI).
- **Writing an API test:** 5, with 4 and 8 for the parts it uses.
- **Writing a UI test:** 7, with 6 and 8.
- **Reviewing or maintaining CI:** 11 and 10.
- **Working with the agents:** 12 and 9.

## Numbers (2026-10-18)

| | Count |
|---|---|
| Scenarios | 769 (731 automated: all 671 API, 60 of 98 UI) |
| Spec files / tests | 96 (85 API, 11 UI) / 731 |
| API clients / services / DTO modules | 14 / 12 / 14 |
| API fixtures | 63 |
| Area step-helper modules | 11 (`apiSteps.ts` plus one per area) |
| Page objects / components / flows | 5 pages + `AppPage` and `BasePage` / 8 + `BaseComponent` / 1 |
| UI precondition fixtures | 8 |
| Bugs on file | 49 (47 open) |
| API contracts | 13 |
| QA agents / skills | 9 / 13 |
