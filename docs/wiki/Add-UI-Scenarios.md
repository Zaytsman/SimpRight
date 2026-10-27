<!-- Source: docs/wiki/Add-UI-Scenarios.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# Add UI Scenarios

Test scenarios say **what** gets tested, in plain language, before any test code exists. Every automated test implements exactly one scenario, and the [UI Test Cases page](https://zaytsman.github.io/SimpRight/test-cases/ui/) lists them all. This page shows the three ways to add UI scenarios, and how to check them.

| You have | Use | Section |
|---|---|---|
| A user story, bug report or feature description | `/analyze-requirements` | [From a story or bug](#from-a-story-or-bug) |
| Test steps you already have, in plain text | `/write-ui-scenarios-from-steps` | [From test steps](#from-test-steps) |
| One scenario you know exactly | your editor | [By hand](#by-hand) |

There's no UI counterpart of the API's contract mode: what a page should do comes from a story or from your steps.

```
story / bug ───────/analyze-requirements───────► analysis (API first) ──► UI (and API) scenarios
test steps ────────/write-ui-scenarios-from-steps─────────────────────► UI scenarios
                                                                               │
                                                                 /implement-ui-scenarios
```

## What a UI scenario looks like

One YAML file per feature in `test-scenarios/ui/<area>/`, in kebab-case and named after the spec (`products/product-sorting.yml`).

```yaml
# yaml-language-server: $schema=../../scenarios.schema.json
suite: Product sorting
tags: ["@products"]
scenarios:
  - id: UI-011
    name: Sort by price from low to high
    ref: docs/ui/user-stories/Product_Overview.md#AC9
    status: automated
    automatedIn: tests/ui/products/product-sorting.spec.ts
    preconditions:
      - The home page is open.
    steps:
      - Select "Price (Low - High)" in the sort list.
      - Verify the products are sorted by price, lowest first.
```

| Key | Meaning |
|---|---|
| `suite`, `tags` | The file's suite name and tag (`@<area>`); they become the spec's `test.describe` |
| `id` | `UI-NNN`, numbered across the whole layer, never reused |
| `name` | One sentence: what the scenario proves. It becomes the test title |
| `ref` | Optional: where it comes from (a story criterion, `BUG-45`, a test case ID) |
| `status` | `manual` for a new scenario; `automated` (with `automatedIn`, the spec path) once a test exists |
| `role` | Optional: `admin`, or `guest` for a logged-out visitor. Absent means the default customer |
| `knownIssue`, `bug` | Optional: the app has a known bug here (`bug` is its ID in `bugs/`); the test is expected to fail until it's fixed |
| `preconditions` | Optional: the state the test starts from, as statements (`A product is in the cart.`): what's needed, not how to create it |
| `steps` | User actions, and checks that start with `Verify`, in the order they happen |

Steps speak the user's language: labels quoted exactly as the app shows them (`Click "Add to cart".`), never `data-test` ids, selectors or URLs with record ids, and never secrets ("the default user's email"). The full rules are in [conventions.md](https://github.com/Zaytsman/SimpRight/blob/main/docs/framework/conventions.md#scenarios-and-specs).

## Before you start

- Open the project in **[Claude Code](https://claude.com/claude-code)** (CLI, desktop app or IDE extension). The commands below are its slash commands, defined in `.claude/skills/`.
- Have the framework installed and `.env` set up ([Installation & Setup](Installation-&-Setup)): the UI writer looks at the live pages with the page inspector, which starts a test run.
- Every agent works in **two phases**: a proposal you approve (nothing is written before it), then the files. Its open questions come as **Decisions needed**: answer them, they're the agent's only way to ask.

## How the agents look at the app

The `ui-scenario-writer` checks every page its scenarios touch with the read-only **page inspector** (`npm run inspect:ui`), as the role the scenarios will use, so steps quote the labels, buttons and messages the app really shows. The inspector can click tabs and menus, tick filters and pick list options, but never types, submits or changes data. Usually 2 to 6 inspections, 10-20 seconds each.

- Every check is **visible**: a text, a count, an order, a state, a message. When an outcome can't be seen on the page (cards don't show a category), it proposes a visible way and asks.
- Where the app and the story or your steps disagree (another label, another message), it asks: a possible bug (`knownIssue`) or an outdated story or step.
- It flags `writes` (adds to the cart, registers, orders, changes a profile), `dangerous`, and `data` (needs data the app may not always have, such as a discounted product).

## From a story or bug

For a user story with acceptance criteria, a bug report or a feature description, let [/analyze-requirements](Analyze-Requirements) decide where each check belongs, even when you expect only UI tests: it puts each check on the API unless only the UI can prove it (what only the page shows, validation done only in the browser, browser state, navigation), so the UI gets only what needs a browser.

### 1. Write or pick the story

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

Number the criteria (`AC1`, `AC2`, ...) so scenarios can point to them. A bug report works too, as a file or pasted into the chat (Claude offers to save it first, so scenarios can link to it). Only local files and pasted text are read: paste a Jira or Azure DevOps item's text instead of its link.

### 2. Ask for an analysis

```text
/analyze-requirements Product_Detail.md
/analyze-requirements Product_Detail.md AC3-AC9
/analyze-requirements BUG-45.md
```

1. **Checkpoint 1, the test plan.** The analyst splits every criterion into test items, each on the API or the UI with a one-line reason; at most one UI item per story is the end-to-end journey. Approve, or move items between layers.
2. It writes the analysis document, `docs/analysis/<name>.md`.
3. **Checkpoint 2, the scenarios.** The `ui-scenario-writer` proposes scenarios for the UI items (and the `api-scenario-writer` for the API items, shown together), with the inspector as above. Approve once.
4. The files are written; the scenario IDs go into the analysis document's test plan, each with a `ref` to its criterion.

Then automate the API scenarios first: they're the cheaper, faster half of the plan. Details: [/analyze-requirements](Analyze-Requirements).

## From test steps

Use it when you already have UI test cases: from a test management tool, a spreadsheet or your notes. Plain text is enough:

```text
TC-12 Add a product to favourites
1. Log in as a customer.
2. Open the product "Combination Pliers".
3. Click "Add to favourites".
Expected: a message confirms the product was added to the favourites.
```

```text
/write-ui-scenarios-from-steps favourites-cases.md
/write-ui-scenarios-from-steps favourites-cases.md TC-12
/write-ui-scenarios-from-steps
```

The first argument is a `.md` or `.txt` file; without it, Claude asks you to paste the steps. The optional second argument is the `ref` the scenarios get.

- **One scenario per test case**, keeping your wording and order. A case that checks unrelated things is proposed split.
- **Only what the format needs changes:** the state you start from ("log in as a customer", "have a product in the cart") becomes `preconditions` and `role`; one action per step, labels as the app shows them; expected results become visible `Verify` steps; secrets and record ids become descriptions.
- **Decisions** where the app differs from your steps, where a case repeats an existing scenario (also with only another role or other data), or where a check only proves a server rule and could be a cheaper API scenario.

The proposal adds a **steps map**: each of your cases and its scenarios, or why it was dropped. It adds no cases you didn't write. Details: [/write-ui-scenarios-from-steps](Write-UI-Scenarios-From-Steps).

## By hand

The agents are optional. To add a scenario yourself:

1. Run `npm run validate:scenarios` and note the next free UI ID it prints.
2. Add the scenario to the feature's file in `test-scenarios/ui/<area>/`, or create the file in kebab-case, named after the feature (`cart/add-to-cart.yml`). Copy the header of an existing file (the schema line, `suite`, `tags`). A new area folder needs an entry in `ids.areas` in `simpright.yml`.
3. Keep the key order: `id`, `name`, `ref`, `status: manual`, `role`, `knownIssue`, `bug`, `preconditions`, `steps`.
4. Check the labels you quote with the page inspector: `npm run inspect:ui -- <path> [--role <role> | --logged-out]` ([UI Automation](UI-Automation)).
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
3. **Automate** them: [UI Automation](UI-Automation). A scenario can also stay `manual` for a while: the Test Cases page shows it either way.

## Tips

- **Start small.** A few criteria or test cases per run keep the proposal easy to review.
- **Name records by what users see** ("the product "Combination Pliers""): ids change when the demo site re-seeds.
- **Known bugs are scenarios too.** A scenario with `knownIssue` documents the bug and turns red the day it's fixed.
- **One reason to fail per scenario.** A different starting state, different actions or a different outcome is a different scenario.

See also: [Add API Scenarios](Add-API-Scenarios), [/write-ui-scenarios-from-steps](Write-UI-Scenarios-From-Steps), [/analyze-requirements](Analyze-Requirements).
