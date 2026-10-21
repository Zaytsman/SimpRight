<!-- Source: docs/wiki/UI-Scenario-Writer.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# UI Scenario Writer

Turns **test steps you describe in plain text** (one or more manual test cases) into **UI test scenarios**: one YAML file per feature in `test-scenarios/ui/<area>/`, every scenario `status: manual`, ready for the [UI Test Engineer](UI-Test-Engineer). It looks at the live pages with the read-only page inspector, so steps quote what the app really shows.

The same agent also writes the UI items of a user story or bug report when the [Requirements Analyst](Requirements-Analyst) hands them over: stories and bugs go through `/analyze-requirements`, which decides first what the API can check.

| | |
|---|---|
| **Command** | `/write-ui-scenarios-from-steps <steps file \| pasted text> [ref]` |
| **Agent** | `ui-scenario-writer` (`.claude/agents/ui-scenario-writer.md`) |
| **Skill** | `write-ui-scenarios-from-steps` (`.claude/skills/write-ui-scenarios-from-steps/SKILL.md`) |
| **Input** | Test steps in plain text: a `.md` or `.txt` file, or text pasted into the chat |
| **Output** | `test-scenarios/ui/<area>/<feature>.yml` |
| **Live app** | Read-only, through the page inspector only |
| **Checkpoint** | A proposal you approve before any file is written |

## When to use it

- You have manual test cases (from a test management tool, a spreadsheet, your notes) and want them automated.
- You know exactly what to check and want it written in the project's scenario format.

For a user story, bug report or feature description, use [`/analyze-requirements`](Requirements-Analyst) instead.

## How to use it

```text
/write-ui-scenarios-from-steps checkout-cases.md
/write-ui-scenarios-from-steps checkout-cases.md TC-12
/write-ui-scenarios-from-steps
```

The first argument is a text file with the steps; without it, Claude asks you to paste them. The optional second argument is the `ref` the scenarios get (a test case or ticket ID, a document path); without one, they get none. Plain text is enough, for example:

```text
TC-12 Add a product to favourites
1. Log in as a customer.
2. Open the product "Combination Pliers".
3. Click "Add to favourites".
Expected: the message "Product added to your favorites list." is shown.
```

## What happens

### Phase 1: the proposal (nothing is written)

1. **Reads** the profile, conventions, your steps and the existing scenarios, and splits the text into test cases.
2. **Looks at the app** with the page inspector, as the role the scenarios will use, to check the labels, buttons and messages your steps name. Usually 2 to 6 inspections, 10-20 seconds each.
3. **Turns each test case into one scenario**, keeping your wording and order, and changing only what the conventions need:
   - the state you start from ("log in as a customer", "have a product in the cart") becomes `preconditions` and `role`;
   - one action per step, labels exactly as the app shows them;
   - expected results become `Verify` steps, one visible concern each;
   - secrets and record ids become descriptions.
4. **Flags** what needs a decision: the app differs from your steps (a possible bug or outdated steps), a case that checks unrelated things (split it?), a check that only proves a server rule (could it be an API scenario?), an existing scenario that already covers a case.

Claude shows the proposal: per feature a table and the **full steps**, a **steps map** (each of your test cases and its scenarios, or why it was dropped), the summary, and **Decisions needed**.

You approve or say what to change. A new area or role you approve is added to the profile by Claude before writing.

### Phase 2: the files

The **same agent** writes exactly the approved scenarios. New files get the schema line, `suite` (the feature's name) and `tags: ["@<area>"]`. Claude runs `npm run validate:scenarios` and reports.

## How it writes steps

- **The user's language:** `Click "Sign in".`, `Select "Price (High - Low)" in the sort list.`, `Click "Add to cart".` Labels quoted exactly as the app shows them. Never `data-test` ids, selectors, URLs with record ids or page object names.
- **One user action per step**; the starting state goes in `preconditions` (`The home page is open.`, `A product is in the cart.`: what's needed, not how to create it).
- **Checks** start with `Verify`, one visible concern each: `Verify the message "Product added to shopping cart." is shown.`
- **Records named by what users see** ("the product "Combination Pliers""), because ids change when the demo site re-seeds.
- **Roles:** none for the default customer, `guest` for a logged-out visitor, `admin` for admin pages.

## The rules it follows

- **Never invents anything:** every scenario traces to one of your test cases; no extra cases or boundaries you didn't write (it mentions obvious gaps instead).
- **The app only through the inspector, read-only:** it clicks tabs, menus and links, ticks filters, picks list options; never types, submits or changes data.
- **Not the app's source code:** what the app should do comes from your steps, what it does from the inspector.
- **Adds only**, **writes only scenario files**, **no secrets**.

## Tips

- One test case per numbered block, with its expected result, makes the steps map easy to read.
- Answer the "Decisions needed": they are how the agent asks questions.
- Next step: review the diff, then [UI Test Engineer](UI-Test-Engineer) (`/implement-ui-scenarios <file>`).

See also: [Generate Scenarios](Generate-Scenarios#from-test-steps), [Requirements Analyst](Requirements-Analyst).
