# The AI-driven test automation workflow

SimpRight is built so that AI agents can carry test automation through the whole cycle, from the first description of what the app does to a test that keeps passing:

1. **Describe** the app: API contracts from the API's source code or OpenAPI spec; user stories with acceptance criteria for the UI.
2. **Plan the tests:** test scenarios in YAML, written from the contracts and stories.
3. **Automate:** the framework code each scenario needs (page objects, clients, fixtures, test data) and the specs.
4. **Review** the tests against their scenarios and the project's conventions.
5. **Heal** failing tests: find out why they failed and fix what is the tests' fault.
6. **Track bugs** in the app: one bug file per root cause, linked to the scenarios that hit it, published on the portal's Bugs page.

Each step is a slash command in [Claude Code](https://claude.com/claude-code) that starts a specialised agent. The agents do the work; a person approves it at fixed checkpoints. Nothing is written, no live data is changed and no fix is applied without that approval.

```mermaid
flowchart LR
    src[API source code<br/>OpenAPI spec] -->|/write-api-contracts| contracts[API contracts<br/>docs/api/contracts]
    stories[User stories<br/>bug reports<br/>docs/ui/user-stories] -->|/write-ui-scenarios| scenarios
    stories -->|/analyze-requirements| analysis[Analysis + test plan<br/>API first<br/>docs/analysis]
    analysis -->|scenario writers| scenarios
    contracts -->|/write-api-scenarios| scenarios[Test scenarios<br/>test-scenarios/*.yml]
    scenarios -->|/implement-api-scenarios<br/>/implement-ui-scenarios| specs[Framework code + specs<br/>src/, tests/]
    specs -->|/review-tests| review[Ranked findings<br/>→ fixes]
    specs -->|CI / local runs| runs[Test results]
    runs -->|/heal-tests| heal[Verdicts<br/>→ fixes, known issues]
    review -.-> specs
    heal -.-> specs
    heal -.->|knownIssue| scenarios
    heal -->|app bug| bugrep
    reports[Bug reports<br/>suspected bugs<br/>in contracts] -->|/report-bug| bugrep[Bugs<br/>bugs/BUG-NNN.yml]
    bugrep -.->|knownIssue + bug| scenarios
```

## The commands

| Step | Command | Agent | Input | Output |
|---|---|---|---|---|
| Describe the API | `/write-api-contracts [update] <source> <spec> <areas>` | `api-contract-writer` | The API's source code and/or its OpenAPI spec | Contracts in `docs/api/contracts/`, one per API area |
| Analyse a work item | `/analyze-requirements <story or bug> [AC ...]` | `requirements-analyst`, then both scenario writers | A user story or bug report | An analysis and test plan in `docs/analysis/` (each check on the API unless only the UI can prove it), then API and UI scenarios |
| Plan API tests | `/write-api-scenarios <contract>` | `api-scenario-writer` | A contract | API scenarios (`API-NNNN`) |
| Plan UI tests | `/write-ui-scenarios <story or bug> [AC ...]` | `ui-scenario-writer` | A user story's acceptance criteria, a bug report | UI scenarios (`UI-NNN`) |
| Automate API tests | `/implement-api-scenarios <IDs \| file \| area>` | `api-test-engineer` | API scenarios | Clients, services, DTOs, fixtures, factories, specs |
| Automate UI tests | `/implement-ui-scenarios <IDs \| file \| area>` | `ui-test-engineer` | UI scenarios | Page objects, components, flows, fixtures, specs |
| Review | `/review-tests [spec \| file \| IDs \| commit]` | `test-reviewer` | Specs and the code they use (default: work not pushed yet) | Findings ranked blocker / should fix / nit |
| Heal | `/heal-tests [run id \| PR \| spec \| IDs]` | `test-healer` | A failed CI run, a PR's checks, the last local run | A verdict per failure, then the approved fixes |
| Track bugs | `/report-bug <description \| IDs> \| import <contract> \| recheck <IDs \| open>` | `bug-reporter` | What someone saw, failing scenarios, a contract's suspected bugs, open bugs | Bug files in `bugs/` (`BUG-NNN`), linked scenarios, fixed bugs closed |

The agents live in `.claude/agents/`, the commands and the skills they use in `.claude/skills/`.

## The steps in detail

### 1. Describe the app

**API contracts.** `/write-api-contracts` reads the API's source code, its OpenAPI spec, or both, and writes one markdown contract per API area: every endpoint, its parameters, request body, responses and error status codes, including the ones no test covers yet. The spec gives the structure; the source gives the real behaviour (validation rules, which role may call what, the error each case returns). Every fact carries its origin:

- `_(verified)_`: checked against the live API (the agent asks before calling it),
- `_(source)_`: read from the source code,
- `_(spec)_`: only in the OpenAPI spec.

Status codes the API returns where it shouldn't (a `500` for an unknown id) are documented as they are and marked as suspected bugs. In `update` mode the agent syncs existing contracts after the API changed, without losing verified facts. The format is in [CONTRACT_FORMAT.md](api/CONTRACT_FORMAT.md); the optional API coverage report measures the tests against these contracts, so the gaps show.

**User stories.** UI tests start from user stories with acceptance criteria in `docs/ui/user-stories/` (or from a bug report or feature description given to the command). They are written by people; the agents read them.

### 2. Plan the tests: scenarios

Scenarios are the single source of truth for what gets automated. Each is a short, readable test case in YAML, validated by a schema:

```yaml
- id: UI-013
  name: The product page shows the product's information and related products
  ref: docs/ui/user-stories/Product_Detail.md#AC1
  status: manual
  steps:
    - Open the product "Combination Pliers".
    - Verify the name "Combination Pliers" is shown.
    - Verify the price "$14.15" is shown.
```

Checks are ordinary steps that start with `Verify`. A scenario can name a `role` (`admin`, `guest` for a logged-out visitor) and a `knownIssue` with its `bug` (a file in `bugs/`, one per root cause) for behaviour that is a known bug.

The **scenario writers** work in two phases:

1. **Proposal:** the scenarios they would write, one line each, with the cases they left out and why, the questions they couldn't settle, and which scenarios would change data on the live app.
2. **Files:** after the user approves (or edits) the proposal, the YAML files, all with `status: manual`.

When a story or bug spans both layers, the **requirements analyst** comes first (`/analyze-requirements`). It summarises the work item in `docs/analysis/<name>.md` and splits each criterion into test items, each on the cheapest layer that can prove it: the API by default (rules, validation, permissions, stored data), the UI only for what the API can't show (rendering, validation done only in the browser, browser state, navigation), at most one UI journey per story. It reads the contracts and existing scenarios to avoid duplicates, and the app's source only to see where a rule is enforced. After the user approves the plan, it hands the API items to the API writer and the UI items to the UI writer; the user approves both proposals together, and the scenario IDs go back into the plan.

The API writer works from a contract: happy paths, every documented error status code, required fields and boundaries, roles. It never calls the API. The UI writer works from acceptance criteria and checks the real page with the **page inspector** (`npm run inspect:ui`), a read-only tool that lists a page's `data-test` elements and accessibility tree, so the steps use the labels and messages the app really shows.

### 3. Automate: framework code and specs

The **test engineers** turn `manual` scenarios into specs, again in two phases:

1. **Plan:** for each scenario file, the spec it becomes, the framework code that exists and what is missing (a page object method, a client, a DTO, a fixture, a test data factory), the locators and the app signals each action will wait for, and the list of **tests that change live data** (creating a product, adding to the cart). The user approves the plan and each of those writes.
2. **Implementation:** the agent adds only the missing pieces, in the style of the project's exemplar files, writes the specs, runs the typecheck and the scenario validator, runs each spec, then repeats it three times to catch flaky tests, and marks the scenarios `automated` with the spec path.

The specs follow the scenario step for step, so the HTML report and the trace read like the scenario:

```ts
// Scenarios: test-scenarios/ui/products/product-search.yml
test.describe('@products - Product search', () => {
  test('UI-001: Search by name shows only matching products', async ({ homePage }) => {
    await test.step('Open the home page.', async () => {
      await homePage.open();
    });
    await test.step('Verify the caption reads "Searched for: pliers".', async () => {
      await expect(homePage.searchCaption, 'The caption names the search term').toHaveText('Searched for: pliers');
    });
  });
});
```

The engineers' rules: the scenario is the specification, so a check is never weakened to make a test pass. When the app behaves differently from the scenario, the test is left failing and reported with a proposal: a `knownIssue` when it's a bug, a scenario fix when the scenario expected something the app never promised. Each engineer uses two helper skills: `api-scaffolding` / `ui-scaffolding` (the framework code) and `api-test-from-scenario` / `ui-test-from-scenario` (the spec).

### 4. Review

`/review-tests` runs the **test reviewer**, a read-only agent that reviews tests the way a senior engineer reviews a pull request. With checklists for both layers (`.claude/skills/review-tests/references/`), it looks for what the typecheck and the validator can't catch:

- a test that doesn't check what its scenario says, or a check that passes on an empty list,
- waits that race the app, fixed sleeps, data shared between parallel tests,
- convention breaks (a selector in a spec, an assertion without a message, a locator outside its page object),
- live data written without approval or cleanup, secrets that could leak into the public reports.

Every finding has a file and line, the code, what goes wrong and when, the rule it breaks and a concrete fix. The user picks the findings to apply; the main session applies them and re-runs the affected specs. The reviewer never edits anything itself, so it stays independent of the fixes.

### 5. Heal

`/heal-tests` runs the **test healer** on failed tests: a CI run, a pull request's checks, or the last local run. Its job is to find out **why** a test failed before anyone changes code, because on a live app a test fails for many reasons that aren't the test's fault.

1. **Diagnosis (read-only):** from the CI log or the local results (errors, page snapshots, traces), the code history, the page inspector, read-only `GET` calls to the API and re-runs of read-only tests, each failure gets a verdict with its evidence and a confidence level:

   | Verdict | Meaning | Proposed action |
   |---|---|---|
   | Test defect | The test code is wrong | The code fix |
   | Flaky | Passes and fails on the same code | Fix the cause (a wait, shared data); never retries or sleeps |
   | App changed | The app changed on purpose | Update the page object or client; scenario changes go to the user |
   | App bug | The app breaks what the scenario promises | A `knownIssue` and its bug (an existing one, or a new one, also with `/report-bug`) |
   | Data drift | The test's data changed under it (another visitor, a re-seed) | Make the test create its own data |
   | Environment | The site was slow or down for a while | A re-run, no code change |

   It also reports records a failed cleanup may have left on the live app.
2. **Fixes:** the user picks which causes to fix; the same agent applies them, runs the specs and repeats them, and reports.

Unlike a healer that edits tests until they pass, it never weakens a check, never skips a test and never adds retries: a test made green while the app is broken is the worst outcome. The demo site's known transient problems (its hourly re-seed, a cached endpoint, slow periods, data other visitors change) are listed in the project profile, so the healer can tell them from real failures.

### 6. Track bugs

`/report-bug` runs the **bug reporter**. The bugs it records are files in `bugs/`, one per **root cause** (`BUG-001.yml`): title, status, severity, the affected endpoints or pages, steps to reproduce, expected and actual result, evidence. A scenario that hits a bug names it with `bug` next to its `knownIssue`, and its test starts with `test.fail(true, 'Known issue BUG-001: ...')`. The portal's **Bugs page** lists them with each linked test's latest result.

1. **Draft (read-only):** it reproduces each item (read-only `GET` calls, the page inspector, re-runs of read-only tests; anything that writes waits for approval), checks the existing bugs for the same cause, and proposes new bugs, extensions of existing ones, the scenarios to link and the coverage gaps (bugs no scenario covers, with a proposed regression scenario).
2. **Files:** the user picks the items; the agent writes the bug files and the links, then runs the validator and the specs whose known-issue line changed.

It also **imports** the suspected bugs a contract marks, and **re-checks** open bugs: a bug that's gone is closed (`status: fixed`), and its scenarios and tests lose the known issue, so they check the fixed behaviour. The Bugs page flags a bug for a re-check when a test that expects it starts passing.

## What keeps the agents on track

- **Checkpoints.** Every agent that writes works in two phases: a proposal or plan, then the work after the user's approval. Agents can't ask questions mid-run, so open questions go into the proposal.
- **One source of truth per step.** Contracts describe the API, stories the UI, scenarios the tests. Writers never write test code; engineers never change a scenario's steps; reviewers and healers judge tests against their scenarios.
- **A project profile, not built-in knowledge.** The agents keep no facts about SimpRight. They read [`qa-agents-profile.yml`](../qa-agents-profile.yml): paths, commands, scenario ID rules, roles, exemplar files to copy the style of, layer rules and the live-app guardrails. The prose conventions stay in [CLAUDE.md](../CLAUDE.md). Pointing the agents at another project means writing its profile.
- **Live-app guardrails.** `liveApi.writes: ask` means any test or check that creates, changes or deletes data on the live app runs only after the user approved it; `liveApi.dangerous` lists what never runs (such as repeated failed logins that lock an account). Tests remove what they create through a `cleanup` fixture.
- **Deterministic checks.** The agents' work is checked by code, not only by review: `npm run typecheck`, `npm run validate:scenarios` (schema, IDs, file names, spec titles and the link between each scenario and its test), and the contract validator from the coverage package.
- **Safe reports.** Attachments and assertion messages mask passwords, tokens and test users' emails, because the HTML reports are published.

## A typical cycle

For a new API area:

```text
/write-api-contracts ../app/api carts        → docs/api/contracts/Carts_API.md
/write-api-scenarios Carts_API.md            → proposal → approve → test-scenarios/api/carts/*.yml
/implement-api-scenarios carts               → plan + writes → approve → specs, all passing
/review-tests                                → findings → pick → fixes applied
(commit, pull request, CI)
/heal-tests PR <n>                           → if CI fails: verdicts → pick → fixes or re-run
/report-bug API-0042                         → if it's an app bug: draft → approve → bugs/BUG-NNN.yml, scenario linked
```

For a new UI story:

```text
/write-ui-scenarios Product_Detail.md        → proposal → approve → test-scenarios/ui/products/*.yml
/implement-ui-scenarios product-detail.yml   → plan + writes → approve → page objects, specs
/review-tests product-detail.spec.ts         → findings → pick → fixes applied
```

For a story that spans both layers:

```text
/analyze-requirements Product_Detail.md AC3-AC9   → test plan → approve → docs/analysis/product-detail.md
                                                  → API + UI proposals → approve → test-scenarios/api/carts/*.yml
/implement-api-scenarios post-carts-by-cart-id.yml → API first, then /implement-ui-scenarios for the UI items
```

The person in the loop decides what to test and approves each step; the agents do the reading, writing, running and checking in between.
