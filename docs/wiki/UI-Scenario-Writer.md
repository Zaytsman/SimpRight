<!-- Source: docs/wiki/UI-Scenario-Writer.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# UI Scenario Writer

Proposes and writes **UI test scenarios** from a user story's acceptance criteria, a bug report or a feature description: one YAML file per feature in `test-scenarios/ui/<area>/`, every scenario `status: manual`, ready for the [UI Test Engineer](UI-Test-Engineer). It looks at the live pages with the read-only page inspector, so steps quote what the app really shows.

| | |
|---|---|
| **Command** | `/write-ui-scenarios <story or bug file \| pasted text> [AC ...]` |
| **Agent** | `ui-scenario-writer` (`.claude/agents/ui-scenario-writer.md`) |
| **Skill** | `write-ui-scenarios` (`.claude/skills/write-ui-scenarios/SKILL.md`) |
| **Input** | A story in `docs/ui/user-stories/`, a bug report, or text pasted into the chat |
| **Output** | `test-scenarios/ui/<area>/<feature>.yml` |
| **Live app** | Read-only, through the page inspector only |
| **Checkpoint** | A proposal you approve before any file is written |

## When to use it

- A new user story is ready, or more of its criteria should be covered.
- A bug was found and needs a regression scenario.

## How to use it

```text
/write-ui-scenarios Product_Detail.md
/write-ui-scenarios Product_Detail.md AC3 AC4 AC5
/write-ui-scenarios Product_Overview.md AC1-AC5
/write-ui-scenarios BUG-45.md
```

The first argument is the document: a path, or a name in `docs/ui/user-stories/` (any case, `.md` optional). You can also paste a story or bug into the chat; Claude offers once to save it in the stories folder, so scenarios can point to it in `ref`. The rest of the arguments pick criteria. For a story with more than about 6 criteria, Claude offers to start with the read-only ones (no cart, registration, order or profile change).

## What happens

### Phase 1: the proposal (nothing is written)

1. **Reads** the profile, conventions, document and existing scenarios.
2. **Looks at the app** with the page inspector, as the role the scenarios will use (`--logged-out` for `guest`), using its steps to reach the states the criteria describe (a sort order, a ticked filter, an open menu). Usually 2 to 6 inspections, 10-20 seconds each.
3. **Picks scenarios** with a fixed checklist:
   - the criterion as written (more than one when it lists cases with different actions);
   - its stated boundaries only (a 3-40 character limit → 2 and 41 rejected, 3 and 40 accepted);
   - for a bug: one regression scenario, with a `knownIssue` if the bug is still there;
   - **every check observable**: a text, a count, an order, a state, a message. If the story's outcome can't be seen, it proposes a visible way and asks;
   - drops what's already covered; flags `writes`, `dangerous` and `data` (needs data the app may not always have, such as a discounted product).

Claude shows the proposal: per feature a table and the **full steps**, a **criteria map** (which scenario covers which criterion, what's not covered and why), the summary, and **Decisions needed**, including where the app and the story disagree.

You approve or say what to change. A new area or role you approve is added to the profile by Claude before writing.

### Phase 2: the files

The **same agent** writes exactly the approved scenarios. Each gets a `ref` to its criterion (`docs/ui/user-stories/Product_Detail.md#AC3`). New files get the schema line, `suite` (the feature's name) and `tags: ["@<area>"]`. Claude runs `npm run validate:scenarios` and reports.

## How it writes steps

- **The user's language:** `Open the home page.`, `Select "Price (High - Low)" in the sort list.`, `Click "Add to cart".` Labels quoted exactly as the app shows them. Never `data-test` ids, selectors, URLs with record ids or page object names.
- **One user action per step**; the starting state first (`A product is in the cart.`: what's needed, not how to create it).
- **Checks** start with `Verify`, one visible concern each: `Verify the message "Product added to shopping cart." is shown.`
- **Records named by what users see** ("the product "Combination Pliers""), because ids change when the demo site re-seeds.
- **Roles:** none for the default customer, `guest` for a logged-out visitor, `admin` for admin pages.

## The rules it follows

- **Never invents anything:** every scenario traces to a criterion or the bug; behaviour it sees in the app but the document doesn't describe isn't covered.
- **The app only through the inspector, read-only:** it clicks tabs, menus and links, ticks filters, picks list options; never types, submits or changes data.
- **Not the app's source code:** what the app should do comes from the document, what it does from the inspector.
- **Adds only**, **writes only scenario files**, **no secrets**.

## Tips

- Number the criteria in your stories (`AC1`, `AC2`...): scenarios point to them and the criteria map uses them.
- Answer the "Decisions needed": they are how the agent asks questions.
- Next step: review the diff, then [UI Test Engineer](UI-Test-Engineer) (`/implement-ui-scenarios <file>`).

See also: [Generate Scenarios](Generate-Scenarios#ui-scenarios).
