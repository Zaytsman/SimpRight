<!-- Source: docs/wiki/Add-API-Scenarios.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# Add API Scenarios

Test scenarios say **what** gets tested, in plain language, before any test code exists. Every automated test implements exactly one scenario, and the [API Test Cases page](https://zaytsman.github.io/SimpRight/test-cases/api/) lists them all. This page shows the four ways to add API scenarios, and how to check them.

| You have | Use | Section |
|---|---|---|
| A user story, bug report or feature description | `/analyze-requirements` | [From a story or bug](#from-a-story-or-bug) |
| An API area to cover endpoint by endpoint | `/write-api-scenarios-from-contract` | [From a contract](#from-a-contract) |
| Test cases you already have: steps, request/response JSON, a Bruno collection | `/write-api-scenarios-from-steps` | [From test steps](#from-test-steps) |
| One scenario you know exactly | your editor | [By hand](#by-hand) |

```
story / bug ──────────────/analyze-requirements──────────► analysis (API first) ──► API (and UI) scenarios
API source / spec ──/write-api-contracts──► contract ──/write-api-scenarios-from-contract──► API scenarios
steps, JSON, Bruno ──────/write-api-scenarios-from-steps───────────────────────────────────► API scenarios
                                                                                                  │
                                                                              /implement-api-scenarios
```

## What an API scenario looks like

One YAML file per endpoint in `test-scenarios/api/<area>/`, named after it: `GET /products/{productId}` → `get-products-by-product-id.yml`.

```yaml
# yaml-language-server: $schema=../../scenarios.schema.json
suite: Users API
tags: ["@users-api"]
scenarios:
  - id: API-0100
    name: Current user endpoint returns the admin-only fields to an admin
    status: manual
    role: admin
    steps:
      - Send GET /users/me with the admin's token.
      - Verify the response status is 200.
      - Verify the body's role is "admin".
```

| Key | Meaning |
|---|---|
| `suite`, `tags` | The file's suite name and tag (`@<area>-api`); they become the spec's `test.describe` |
| `id` | `API-NNNN`, numbered across the whole layer, never reused |
| `name` | One sentence: what the scenario proves. It becomes the test title |
| `ref` | Optional: where it comes from (a story criterion, `BUG-45`, a test case ID) |
| `status` | `manual` for a new scenario; `automated` (with `automatedIn`, the spec path) once a test exists |
| `role` | Optional: `admin`, or `guest` for no token. Absent means the default customer |
| `knownIssue`, `bug` | Optional: the API has a known bug here (`bug` is its ID in `bugs/`); the test is expected to fail until it's fixed |
| `steps` | Requests, and checks that start with `Verify`, in the order they happen. The status code is its own first `Verify` step |

Steps never hold secrets ("the default user's email", not the address). The full rules are in [CLAUDE.md](https://github.com/Zaytsman/SimpRight/blob/main/CLAUDE.md#scenarios-and-specs-conventions).

## Before you start

- Open the project in **[Claude Code](https://claude.com/claude-code)** (CLI, desktop app or IDE extension). The commands below are its slash commands, defined in `.claude/skills/`.
- Have the framework installed ([Installation & Setup](Installation-&-Setup)): the agents run the scenario validator.
- Every agent works in **two phases**: a proposal you approve (nothing is written before it), then the files. Its open questions come as **Decisions needed**: answer them, they're the agent's only way to ask.

## From a story or bug

For a user story with acceptance criteria (in `docs/ui/user-stories/`), a bug report or a feature description, let [/analyze-requirements](Analyze-Requirements) decide where each check belongs. It puts every check on the API unless only the UI can prove it, so a story usually yields more API scenarios than UI ones.

```text
/analyze-requirements Product_Detail.md
/analyze-requirements Product_Detail.md AC3-AC9
/analyze-requirements BUG-45.md
```

1. **Checkpoint 1, the test plan.** The analyst splits every criterion into test items, each on the API or the UI with a one-line reason. It lists what existing scenarios already cover and the endpoints no contract documents yet (`contract gap`). Approve, or move items between layers.
2. It writes the analysis document, `docs/analysis/<name>.md`. A contract gap you want filled is filled now with `/write-api-contracts`.
3. **Checkpoint 2, the scenarios.** The `api-scenario-writer` proposes scenarios for the API items (and the `ui-scenario-writer` for the UI items, shown together). Approve once.
4. The files are written; the scenario IDs go into the analysis document's test plan.

Only local files and pasted text are read: paste a Jira or Azure DevOps item's text instead of its link. Details: [/analyze-requirements](Analyze-Requirements).

## From a contract

Use it to cover an API area endpoint by endpoint, without a story: a new area, endpoints a contract gained, or status codes the coverage report shows untested.

### 1. Make sure there's a contract

The writer works from a contract: one markdown file per API area in `docs/api/contracts/`, listing every endpoint, its parameters, body, responses and error codes. If the area has none, or the API changed:

```text
/write-api-contracts ../practice-software-testing/sprint5/API carts
/write-api-contracts update ../practice-software-testing/sprint5/API products
```

Every fact gets an origin tag (`_(verified)_`, `_(source)_`, `_(spec)_`). The format is in [CONTRACT_FORMAT.md](https://github.com/Zaytsman/SimpRight/blob/main/docs/api/CONTRACT_FORMAT.md); details: [/write-api-contracts](Write-API-Contracts).

### 2. Ask for a proposal

```text
/write-api-scenarios-from-contract Users_API.md
/write-api-scenarios-from-contract Users_API.md POST /users/login GET /users/me
```

The first argument is the contract (a file name is enough); the rest optionally limits the endpoints. The `api-scenario-writer` goes through a fixed checklist per endpoint, so two runs propose the same things:

- a **happy path** per success status code, with the response-shape checks;
- **parameters** that change the result (filters, sorting, paging) and their documented boundaries;
- **errors** a client can trigger: 401 (no token, invalid token), 403 (wrong role), 404 (unknown id), 409, 415, 422 (one scenario for all required fields, plus one per documented rule);
- **suspected bugs** the contract marks (a 500 that should be a 404), asserting the correct behaviour with a `knownIssue`;
- a **read-back** step after every create, change or delete.

It never calls the API.

### 3. Review and approve

The proposal shows per endpoint a table (ID, name, the triggering request, the expected status, the contract fact's origin, flags), the **full steps** of every scenario, what was dropped or is already covered, and the decisions. Flags:

- `writes`: the test will create, change or delete live data;
- `dangerous`: something the project never runs (repeated wrong passwords that lock an account);
- `known issue`, `unconfirmed` (rests on an OpenAPI-only fact), `optional` (lowest priority).

Approve, or say what to change: drop, merge, rename, reword. Details: [/write-api-scenarios-from-contract](Write-API-Scenarios-From-Contract).

## From test steps

Use it when you already have API test cases: from a test management tool, a spreadsheet, your notes, or saved requests.

```text
/write-api-scenarios-from-steps add-to-cart-cases.md
/write-api-scenarios-from-steps login-request.json login-response.json TC-7
/write-api-scenarios-from-steps ../bruno/Toolshop/Carts
```

- **Inputs:** text files or pasted steps; `.json` request and expected-response files (paired by name, such as `login-request.json` and `login-response.json`, or by what you write); a Bruno collection folder or JSON export. For a collection with more than about 10 requests, Claude asks which folders or requests to take. The optional last argument is the `ref` the scenarios get.
- **One scenario per test case**, keeping your intent and order. A case with several requests (create, then read) is one scenario in the file of the endpoint it tests.
- **Requests** become action steps with `{param}` names. Literal values stay only when they're stable (seeded data, enum values, the invalid value the case is about); record ids are described, because they change when the site re-seeds.
- **Expected responses** become `Verify` steps: the status first, then one step per field. Fields that change between runs (ids, timestamps, tokens, totals) are checked for presence or type, never by value, and the whole body is never compared. The proposal lists what it left out of the value checks.
- **Bruno:** `body:json` is the request, `assert` and `tests` the expected results, `auth` the role. The collection's `environments/` and `.env` files are never opened, and a token or password written inline is never copied.
- **Checked against the contract:** an endpoint the contracts don't have, or a case that contradicts the contract or an existing scenario (it expects 422 where the contract says 404), is your decision: a possible bug (the scenario keeps your expectation and gets a `knownIssue`) or an outdated case.

The proposal adds a **source map**: each of your cases and its scenarios, or why it was dropped. It adds no cases you didn't write. Details: [/write-api-scenarios-from-steps](Write-API-Scenarios-From-Steps).

## By hand

The agents are optional. To add a scenario yourself:

1. Run `npm run validate:scenarios` and note the next free API ID it prints.
2. Add the scenario to the endpoint's file in `test-scenarios/api/<area>/`, or create the file: `<method>-<path>.yml` in kebab-case, a path parameter as `by-<name>` (`GET /products/{productId}` → `get-products-by-product-id.yml`). Copy the header of an existing file (the schema line, `suite`, `tags`). A new area folder needs an entry in `ids.areas` in `simpright.yml`.
3. Keep the key order: `id`, `name`, `ref`, `status: manual`, `role`, `knownIssue`, `bug`, `steps`.
4. Check the endpoint in its contract in `docs/api/contracts/`: steps assert only what the contract states.
5. Run `npm run validate:scenarios` again.

With the [YAML extension](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) in VS Code, the schema line at the top of each file gives autocomplete and checks while you type.

## Check the result

After every way above, run the validator (the agents run it too):

```bash
npm run validate:scenarios
```

It checks the schema, unique IDs, file names, and that scenarios and specs point to each other, and prints the **next free ID** of each layer. Then:

1. **Review the diff** of `test-scenarios/` like any other change: the scenarios are the specification of the tests that follow.
2. **Commit** them on `develop` (or a feature branch).
3. **Automate** them: [API Automation](API-Automation). A scenario can also stay `manual` for a while: the Test Cases page shows it either way.

## Tips

- **Start small.** One contract area or a few criteria per run keep the proposal easy to review.
- **Known bugs are scenarios too.** A scenario with `knownIssue` documents the bug and turns red the day it's fixed, so nobody forgets it.
- **One reason to fail per scenario.** Different requests or expected status codes are different scenarios.
- `unconfirmed` scenarios may fail because the spec was wrong, not the API: worth a look before automating.

See also: [Add UI Scenarios](Add-UI-Scenarios), [/write-api-scenarios-from-contract](Write-API-Scenarios-From-Contract), [/analyze-requirements](Analyze-Requirements).
