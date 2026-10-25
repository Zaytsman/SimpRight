# 12. AI agents

SimpRight ships QA agents for Claude Code that do the framework's routine work: they write contracts, scenarios and specs, review tests, heal failures and record bugs. They're part of the framework's design, not an add-on: the scenario files, the profile, the exemplars and the validator exist partly so the agents produce code that looks like the rest. The full workflow, with examples, is in [`docs/AI_WORKFLOW.md`](../AI_WORKFLOW.md); each agent has a wiki page.

## The chain

```
API source / OpenAPI spec ──/write-api-contracts──► docs/api/contracts/
                                                         │
user story / bug report ──/analyze-requirements──► docs/analysis/  (API vs UI, per check)
                                                         │
  /write-api-scenarios-from-contract, /write-*-scenarios-from-steps ──► test-scenarios/  (status: manual)
                                                         │
               /implement-api-scenarios, /implement-ui-scenarios ──► tests/ + framework code  (status: automated)
                                                         │
                        /review-tests ──► findings ──► fixes      /heal-tests ──► diagnosis ──► fixes
                                                         │
                                       /report-bug ──► bugs/ + knownIssue links
```

Every agent works in **two phases**: first a proposal (a plan, a draft, a diagnosis) that the user approves, then the files. Questions go through one shared format ([`.claude/skills/_shared/how-to-ask.md`](../../.claude/skills/_shared/how-to-ask.md)): context first, 2–4 options, the recommended one first.

## The agents ([`.claude/agents/`](../../.claude/agents/))

| Skill → agent | Does |
|---|---|
| `/write-api-contracts` → `api-contract-writer` | Writes or updates API contracts from the API's source, its OpenAPI spec or both; optional live checks (asks first) |
| `/analyze-requirements` → `requirements-analyst` | Summarises a story or bug and plans its tests, each on the API unless only the UI can prove it; writes the analysis, hands items to the scenario writers |
| `/write-api-scenarios-from-contract` → `api-scenario-writer` | Proposes API scenarios from a contract, writes the YAML after approval |
| `/write-api-scenarios-from-steps` → `api-scenario-writer` | Turns the user's API test cases (plain-text steps, request and response JSON, a Bruno collection) into scenarios, checking each against the contract; fields that change between runs are never compared by value |
| `/write-ui-scenarios-from-steps` → `ui-scenario-writer` | Turns the user's plain-text test steps into UI scenarios, checking labels in the live app with the read-only page inspector. From `/analyze-requirements` it writes the UI items of a story or bug |
| `/implement-api-scenarios` → `api-test-engineer` | Plans the code and the tests that change data, then writes and runs the specs (each passing spec three more times) and marks the scenarios automated |
| `/implement-ui-scenarios` → `ui-test-engineer` | The same for UI: inspects the pages, plans page objects, flows and fixtures |
| `/review-tests` → `test-reviewer` (read-only) | Checks tests against their scenarios and the conventions, returns findings ranked blocker / should fix / nit; the skill applies the ones the user picks |
| `/heal-tests` → `test-healer` | Diagnoses failed tests from CI logs or local results (test defect, flaky, app changed, app bug, data drift, environment) and fixes the approved ones. It never weakens a check or skips a test. |
| `/report-bug` → `bug-reporter` | Reproduces, checks for a bug with the same root cause, proposes bug files and the scenarios to link; `recheck` closes fixed bugs |

The engineers are given the scaffolding and spec-writing skills (`api-scaffolding`, `api-test-from-scenario`, `ui-scaffolding`, `ui-test-from-scenario`), and the reviewer gets the checklists in [`.claude/skills/review-tests/references/`](../../.claude/skills/review-tests/references/) (`common.md`, `api.md`, `ui.md`).

## What the agents read

The agents keep **no project facts of their own**. They read:

1. **[`simpright.yml`](../../simpright.yml)**: paths, commands, ID rules, roles, the exemplars, the known-issue snippet, agent-critical rules, live-app guardrails ([9](09-scenarios-and-bugs.md#the-project-profile)).
2. **[`CLAUDE.md`](../../CLAUDE.md)**: the conventions (the profile's `project.conventions`).
3. **The exemplars**, the files whose style new code copies:

| Layer | Exemplar keys → files |
|---|---|
| API | `client` ProductsClient, `service` ProductsService, `dto` product.ts, `fixtures` api fixtures.ts, `spec` get-products-search.spec.ts, `helpers` assertHelpers.ts, **`checks` apiChecks.ts**, **`steps` apiSteps.ts**, `cleanup` base.ts, `constants` TestConstants.ts, `testDataUtils` |
| UI | `page` HomePage, `basePage`, `component` ProductGrid, `baseComponent`, `dialog` BaseDialog, `flow` ShoppingFlow, `fixtures` ui fixtures.ts, `preconditionFixture` openHomePageTest, `fixturesIndex` index.ts, `spec` product-search.spec.ts, `constants` |

Because the agents copy the exemplars, the exemplars must show the best current style; the review fixed them first when they didn't.

## Guardrails

- **Live writes need approval** (`liveApi.writes: ask`): a test that creates, changes or deletes data on the shared demo site, UI tests included, runs only after the user approves it.
- **Dangerous actions** are listed in the profile: repeated failed logins lock accounts, so lockout tests use throwaway customers.
- **Known transient problems** (the hourly re-seed, Cloudflare on `/checkout` from CI runners, caches, slowdowns) are listed in the profile, so the healer checks failures against them and never re-runs inside the re-seed window.
- **No secrets:** agents don't open `.env`, never print credentials, and mask the test users' emails even when quoting logs.
- **Test-side code only:** agents never edit the app under test or a scenario's intent; changes to shared framework code are additive unless the user approves a change.
- **The validator and the step-title check** catch what an agent gets wrong in titles and links.

## Changed in the review

- The profile names the shared API helpers as exemplars (`checks`, `steps`) and adds a rule to reuse them. The API engineer reads every exemplar before writing code, but it had never been pointed at these files, which is how 161 spec-local helpers had piled up before the review.
- The review checklists name the new rules: `parseJson`, `expectStatus`, `sendAndAttach` with `AUTH`, templates through literal `test()` calls, `expectSomeItems`, redirects from config, role tokens for long tests (API); `parseAmount`, `waitForApiResponse`, setup never a step and `Setup:` errors, the checkout through `CartPage.open()`, the base page's toast (UI).
- The four code-writing skills say the same, and `CLAUDE.md` describes the shared checks and templates.
- The API exemplar spec's API-0001 now uses its own spec's send helper, like the other tests in the file.

Details: [13. Code review, October 2026](13-code-review-2026-10.md).
