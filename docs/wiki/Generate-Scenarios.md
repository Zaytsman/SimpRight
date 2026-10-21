<!-- Source: docs/wiki/Generate-Scenarios.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# Generate Scenarios

Test scenarios say **what** gets tested, in plain language, before any test code exists. They are the source of truth of the framework: every automated test implements exactly one scenario, and the [Test Cases pages](https://zaytsman.github.io/SimpRight/test-cases/ui/) list them all.

This page shows how to add scenarios for both layers with the AI agents, how to check and review them, and how to write one by hand.

```
API:   API source / OpenAPI spec ──/write-api-contracts──► contract ──/write-api-scenarios-from-contract──► API scenarios
Story: user story / bug report ──/analyze-requirements──► analysis + test plan (API first) ──► API and UI scenarios
Steps: test steps, request/response JSON, Bruno ──/write-api-scenarios-from-steps──────────► API scenarios
       test steps in plain text ──────────────────/write-ui-scenarios-from-steps───────────► UI scenarios
                                                                                              │
                                                    /implement-api-scenarios, /implement-ui-scenarios
```

## What a scenario looks like

One YAML file per endpoint (API) or per feature (UI), in `test-scenarios/<layer>/<area>/`:

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
| `suite`, `tags` | The file's suite name and tags (`@<area>` for UI, `@<area>-api` for API); they become the spec's `test.describe` |
| `id` | `API-NNNN` or `UI-NNN`, numbered across the whole layer, never reused |
| `name` | One sentence: what the scenario proves. It becomes the test title |
| `ref` | Optional: where it comes from (`docs/ui/user-stories/Product_Detail.md#AC3`, `BUG-45`) |
| `status` | `manual` for a new scenario; `automated` (with `automatedIn`, the spec path) once a test exists |
| `role` | Optional: `admin`, or `guest` for a logged-out visitor. Absent means the default customer |
| `knownIssue` | Optional: the app has a known bug here; the test is expected to fail until it's fixed |
| `bug` | With `knownIssue` only: the ID of the bug in `bugs/` (`BUG-001`); scenarios with the same root cause share one bug |
| `steps` | Actions, and checks that start with `Verify`, in the order they happen. At least one `Verify` |

Steps never hold secrets ("the default user's email", not the address). The full rules are in [CLAUDE.md](https://github.com/Zaytsman/SimpRight/blob/main/CLAUDE.md#scenarios-and-specs-conventions).

## Before you start

- Open the project in **[Claude Code](https://claude.com/claude-code)** (CLI, desktop app or IDE extension). The commands below are its slash commands, defined in `.claude/skills/`.
- Have the framework installed and `.env` set up ([Installation & Setup](Installation-&-Setup)): the UI writer looks at the live pages with the page inspector, which starts a test run.
- Prepare the input:
  - **A whole API area:** a contract in `docs/api/contracts/`. If there's none yet, write it first (see below).
  - **A user story or bug report** (either layer or both): a story with acceptance criteria in `docs/ui/user-stories/`, or a bug report. The [Requirements Analyst](Requirements-Analyst) decides which checks go to the API and which to the UI (see [From a story or bug](#from-a-story-or-bug)).
  - **Test cases you already have:** UI steps in plain text; API steps, request and expected-response JSON or a Bruno collection (see [From test steps](#from-test-steps)).

## API scenarios

### 1. Make sure there's a contract

The API writer works only from a contract: one markdown file per API area, listing every endpoint, its parameters, body, responses and error codes. If the area has none, or the API changed:

```text
/write-api-contracts ../practice-software-testing/sprint5/API carts
/write-api-contracts update ../practice-software-testing/sprint5/API products
```

The arguments are the API's source code and/or its OpenAPI spec and the areas. The agent asks before checking facts against the live API, and every fact gets an origin tag (`_(verified)_`, `_(source)_`, `_(spec)_`). The format is in [CONTRACT_FORMAT.md](https://github.com/Zaytsman/SimpRight/blob/main/docs/api/CONTRACT_FORMAT.md).

### 2. Ask for a proposal

```text
/write-api-scenarios-from-contract Users_API.md
/write-api-scenarios-from-contract Users_API.md POST /users/login GET /users/me
```

The first argument is the contract (a file name in `docs/api/contracts/` is enough); the rest optionally limits the endpoints. For a contract with more than about 8 endpoints, Claude offers to start with a subset.

The `api-scenario-writer` agent goes through a fixed checklist per endpoint, so two runs propose the same things:

- a **happy path** per success status code, with the response-shape checks;
- **parameters** that change the result (filters, sorting, paging) and their documented boundaries;
- **errors** a client can trigger: 401 (no token, invalid token), 403 (wrong role), 404 (unknown id), 409, 415, 422 (one scenario for all required fields, plus one per documented rule);
- **suspected bugs** the contract marks (a 500 that should be a 404) as scenarios that assert the correct behaviour, with a `knownIssue`;
- a **read-back** step after every create, change or delete (`Verify GET /products/{id} returns the new name.`).

It never calls the API and never writes test code.

### 3. Review and approve the proposal

Nothing is written yet. The proposal shows, per endpoint:

- a table of the scenarios: ID, name, the request that triggers it, the expected status, the contract fact's origin, and flags:
  - `writes`: the test will create, change or delete live data;
  - `dangerous`: something the project never runs (such as repeated wrong passwords that lock an account);
  - `known issue`, `unconfirmed` (rests on an OpenAPI-only fact), `optional` (lowest priority);
- the **steps of every scenario, in full**: this wording is what gets written, so read it;
- what was dropped and why, and what existing scenarios already cover;
- **Decisions needed**: open questions the agent couldn't settle from the contract.

Answer with approval, or with changes: drop, merge, rename, reword, and the answers to the decisions. Claude passes them on and the same agent writes the files.

### 4. Check the result

The agent writes or extends `test-scenarios/api/<area>/<method>-<path>.yml` (`post-users-login.yml`, `get-products-by-product-id.yml`), every new scenario `status: manual`. Then Claude runs the validator and reports the files and IDs. Run it yourself any time:

```bash
npm run validate:scenarios
```

It checks the schema, unique IDs, file names, and that scenarios and specs point to each other. It also prints the **next free ID** of each layer.

## From a story or bug

User stories and bug reports go through the [Requirements Analyst](Requirements-Analyst), even when you expect only UI tests: it puts each check on the API unless only the UI can prove it, and hands the UI items to the `ui-scenario-writer`.

### 1. Write or pick the user story

A story is a markdown file in `docs/ui/user-stories/`:

```text
As a visitor, I want to view a product's details, add it to my cart, or save it to my favorites,
so that I can purchase it or come back to it later.

Acceptance Criteria
AC3 – Quantity selector
Given the product is in stock
Then a quantity input field is displayed with plus (+) and minus (-) buttons
And the default quantity is 1.
```

Number the criteria (`AC1`, `AC2`, ...) so scenarios can point to them. A bug report works too, as a file or pasted into the chat.

### 2. Ask for an analysis

```text
/analyze-requirements Product_Detail.md AC3-AC9
/analyze-requirements BUG-45.md
```

1. **Checkpoint 1, the test plan.** The analyst splits every criterion into test items and puts each on the API unless only the UI can prove it (what only the page shows, validation done only in the browser, browser state, navigation), with the reason. It lists the items existing scenarios already cover and the endpoints that have no contract yet. Approve the plan, or move items between layers.
2. It writes the analysis document, `docs/analysis/<name>.md`. A contract gap you want filled is filled now with `/write-api-contracts`.
3. **Checkpoint 2, the scenarios.** The API and UI scenario writers propose scenarios for the items on their layer, shown together; approve them once.
4. The writers write the files; Claude adds the scenario IDs to the analysis document's test plan and runs the validator.

For the UI items, the `ui-scenario-writer` agent:

- **looks at the live pages** with the read-only page inspector (`npm run inspect:ui`), as the role the scenarios will use, so steps quote the labels, buttons and messages the app really shows. The inspector can click tabs and menus, tick filters and pick list options, but never types, submits or changes data;
- makes every check **visible**: a text, a count, an order, a state, a message. When the story's outcome can't be seen on the page, it proposes a visible way and asks;
- flags `data` for a scenario that needs data the app may not always have (a product with a discount, an out-of-stock product), and notes where the app and the story disagree;
- writes steps in the user's language (`Click "Add to cart".`), never selectors or record ids. It doesn't read the app's source code: what the app should do comes from the story, what it does from the inspector.

Then automate the API scenarios first: they're the cheaper, faster half of the plan.

## From test steps

When you already have test cases (manual ones from a test management tool or a spreadsheet, saved requests), turn them into scenarios directly. The agents keep your cases and their intent, and change only what the project's format needs.

### UI: steps in plain text

```text
/write-ui-scenarios-from-steps checkout-cases.md
/write-ui-scenarios-from-steps checkout-cases.md TC-12
```

A text file (or text pasted into the chat), one or more numbered test cases with their expected results; the optional last argument is the `ref` the scenarios get. The `ui-scenario-writer` checks the labels and messages your steps name with the page inspector, moves the starting state to `preconditions` and `role`, makes each expected result a visible `Verify` step, and proposes one scenario per test case with a **steps map** (each case and its scenarios). Where the app differs from your steps, or a check would be cheaper on the API, it asks. Details: [UI Scenario Writer](UI-Scenario-Writer).

### API: steps, JSON or a Bruno collection

```text
/write-api-scenarios-from-steps add-to-cart-cases.md
/write-api-scenarios-from-steps login-request.json login-response.json
/write-api-scenarios-from-steps ../bruno/Toolshop/Carts
```

The `api-scenario-writer` turns each request into an action step and each expected response into `Verify` steps (the status, then one field per step; values that change between runs are checked for presence or type only). It never opens a collection's `environments/` and never copies a token or password from a request. It checks every case against the contract: an endpoint the contracts don't have, or a case that contradicts the contract, is your decision (a possible bug, or an outdated case). Details: [API Scenario Writer](API-Scenario-Writer#from-test-steps).

Both proposals are reviewed and approved like the others, and Claude runs the validator after the files are written.

## After the scenarios are written

1. **Review the diff** of `test-scenarios/` like any other change: the scenarios are the specification of the tests that follow.
2. **Commit** them (on `develop` or a feature branch).
3. **Automate** them: [API Automation](API-Automation), [UI Automation](UI-Automation). A scenario can also stay `manual` for a while: the Test Cases pages show it either way.

## Writing a scenario by hand

The agents are optional. To add one yourself:

1. Run `npm run validate:scenarios` and note the next free ID of the layer.
2. Add the scenario to the right file in `test-scenarios/<layer>/<area>/`, or create the file (copy the header of an existing one: the schema line, `suite`, `tags`).
   - API file names follow the endpoint: `GET /products/{productId}` → `api/products/get-products-by-product-id.yml`.
   - UI file names follow the feature, in kebab-case: `ui/cart/add-to-cart.yml`.
   - A new area folder needs an entry in `ids.areas` in `qa-agents-profile.yml`.
3. Keep the key order: `id`, `name`, `ref`, `status: manual`, `role`, `knownIssue`, `bug`, `preconditions` (UI: the starting state, such as `The home page is open.`), `steps`.
4. Run `npm run validate:scenarios` again.

With the [YAML extension](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) in VS Code, the schema line at the top of each file gives autocomplete and checks while you type.

## Tips

- **Start small.** One contract area or a few criteria per run keep the proposal easy to review.
- **Answer the "Decisions needed".** They're the agent's way of asking: it can't ask questions while it works.
- **Known bugs are scenarios too.** A scenario with `knownIssue` documents the bug and turns red the day it's fixed, so nobody forgets it.
- **One reason to fail per scenario.** Different requests, actions or expected outcomes are different scenarios.
