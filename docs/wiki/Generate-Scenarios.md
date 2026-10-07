<!-- Source: docs/wiki/Generate-Scenarios.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# Generate Scenarios

Test scenarios say **what** gets tested, in plain language, before any test code exists. They are the source of truth of the framework: every automated test implements exactly one scenario, and the [Test Cases pages](https://zaytsman.github.io/SimpRight/test-cases/ui/) list them all.

This page shows how to add scenarios for both layers with the AI agents, how to check and review them, and how to write one by hand.

```
API:  API source / OpenAPI spec ──/write-api-contracts──► contract ──/write-api-scenarios──► API scenarios
UI:   user story / bug report ──────────────────────────────────────/write-ui-scenarios───► UI scenarios
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
| `steps` | Actions, and checks that start with `Verify`, in the order they happen. At least one `Verify` |

Steps never hold secrets ("the default user's email", not the address). The full rules are in [CLAUDE.md](https://github.com/Zaytsman/SimpRight/blob/main/CLAUDE.md#scenarios-and-specs-conventions).

## Before you start

- Open the project in **[Claude Code](https://claude.com/claude-code)** (CLI, desktop app or IDE extension). The commands below are its slash commands, defined in `.claude/skills/`.
- Have the framework installed and `.env` set up ([Installation & Setup](Installation-&-Setup)): the UI writer looks at the live pages with the page inspector, which starts a test run.
- Prepare the input:
  - **API:** a contract in `docs/api/contracts/` for the API area. If there's none yet, write it first (see below).
  - **UI:** a user story with acceptance criteria in `docs/ui/user-stories/`, or a bug report.

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
/write-api-scenarios Users_API.md
/write-api-scenarios Users_API.md POST /users/login GET /users/me
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

## UI scenarios

### 1. Write or pick the user story

UI scenarios come from acceptance criteria. A story is a markdown file in `docs/ui/user-stories/`:

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

### 2. Ask for a proposal

```text
/write-ui-scenarios Product_Detail.md
/write-ui-scenarios Product_Detail.md AC3 AC4 AC5
```

For a story with more than about 6 criteria, Claude offers to start with the read-only ones (those that don't add to the cart, register, order or change a profile).

The `ui-scenario-writer` agent:

- **looks at the live pages** with the read-only page inspector (`npm run inspect:ui`), as the role the scenarios will use, so steps quote the labels, buttons and messages the app really shows. The inspector can click tabs and menus, tick filters and pick list options, but never types, submits or changes data;
- proposes per criterion: the criterion as written, its stated boundaries (a 3-40 character limit → 2 and 41 rejected, 3 and 40 accepted), and a regression scenario for a bug;
- makes every check **visible**: a text, a count, an order, a state, a message. When the story's outcome can't be seen on the page, it proposes a visible way and asks;
- writes steps in the user's language (`Click "Add to cart".`), never selectors or record ids.

It doesn't read the app's source code: what the app should do comes from the story, what it does from the inspector.

### 3. Review and approve the proposal

As for the API, plus:

- a **criteria map**: which scenario covers which criterion, and which criteria aren't covered and why;
- the flag `data` for a scenario that needs data the app may not always have (a product with a discount, an out-of-stock product);
- notes where the app and the story disagree.

Approve, or say what to change. If you approve a new area (`checkout`) or role, Claude adds it to `qa-agents-profile.yml` before the files are written.

### 4. Check the result

The agent writes `test-scenarios/ui/<area>/<feature>.yml` (`products/product-quantity.yml`), every scenario with a `ref` to its criterion and `status: manual`. Claude runs the validator and reports.

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
3. Keep the key order: `id`, `name`, `ref`, `status: manual`, `role`, `knownIssue`, `steps`.
4. Run `npm run validate:scenarios` again.

With the [YAML extension](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) in VS Code, the schema line at the top of each file gives autocomplete and checks while you type.

## Tips

- **Start small.** One contract area or a few criteria per run keep the proposal easy to review.
- **Answer the "Decisions needed".** They're the agent's way of asking: it can't ask questions while it works.
- **Known bugs are scenarios too.** A scenario with `knownIssue` documents the bug and turns red the day it's fixed, so nobody forgets it.
- **One reason to fail per scenario.** Different requests, actions or expected outcomes are different scenarios.
