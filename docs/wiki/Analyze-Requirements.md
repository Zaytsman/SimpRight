<!-- Source: docs/wiki/Analyze-Requirements.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# /analyze-requirements

Takes a **user story, bug report or feature description** to scenarios on both layers. It writes a short **analysis document** with a **test plan** and picks a layer for every check. A check goes on the **API** unless only the **UI** can prove it, because API tests are cheaper, faster and more stable. Then it hands the API items to the API scenario writer and the UI items to the UI scenario writer.

| | |
|---|---|
| **Command** | `/analyze-requirements <story or bug file \| pasted text> [AC ...]` |
| **Agents** | [`requirements-analyst`](https://github.com/Zaytsman/SimpRight/blob/main/.claude/agents/requirements-analyst.md) (the analysis), then [`api-scenario-writer`](https://github.com/Zaytsman/SimpRight/blob/main/.claude/agents/api-scenario-writer.md) and [`ui-scenario-writer`](https://github.com/Zaytsman/SimpRight/blob/main/.claude/agents/ui-scenario-writer.md) in parallel (the scenarios) |
| **Skill files** | [`.claude/skills/analyze-requirements/`](https://github.com/Zaytsman/SimpRight/tree/main/.claude/skills/analyze-requirements): `SKILL.md`, `references/layer-rules.md`, `references/analysis-format.md` |
| **Input** | A story or bug in `docs/ui/user-stories/`, or text pasted into the chat. Trackers (Azure DevOps, Jira) aren't read: paste the work item's text |
| **Output** | `docs/analysis/<name>.md`, plus scenarios in `test-scenarios/api/` and `test-scenarios/ui/` |
| **Live app** | No API calls; the page inspector at most 3 times, read-only |
| **Checkpoints** | Two: the test plan, then the scenarios of both layers together |

## When to use it

- A story touches both the API and the UI, and you want the tests on the cheapest layer that can prove each criterion.
- A bug was reported from the UI, and you want to know whether the API can reproduce it.
- You want a short written record of what a work item asks for and how it's tested.

Use it for a story you expect to be UI-only too: it may find checks the API proves faster. For an API area without a story, use [/write-api-scenarios-from-contract](Write-API-Scenarios-From-Contract); for test cases you already have, [/write-ui-scenarios-from-steps](Write-UI-Scenarios-From-Steps) or [/write-api-scenarios-from-steps](Write-API-Scenarios-From-Steps).

## How to use it

```text
/analyze-requirements Product_Detail.md
/analyze-requirements Product_Detail.md AC3-AC9
/analyze-requirements BUG-45.md
```

The first argument is the document: a path, or a name in `docs/ui/user-stories/` (any case, `.md` optional). You can also paste the work item into the chat; Claude offers once to save it in the stories folder, so the analysis and the scenarios can link to it. The rest of the arguments pick criteria (default: all).

## What happens

### 1. The analysis (checkpoint 1, nothing is written)

The `requirements-analyst` agent:

1. **Reads** the document and restates each criterion as Given / When / Then.
2. **Finds what it touches:** the API endpoints behind each criterion (with the contract and section), the pages, and the data the tests need. An endpoint with no contract is a **contract gap**.
3. **Finds existing coverage** in the scenarios of both layers, so nothing is planned twice.
4. **Splits each criterion into test items** (`T1`, `T2`, ...), each with a layer, the reason for that layer and flags (`writes`, `data`, `dangerous`, `known issue`, `contract gap`).

Claude shows the summary, the test plan table and the **Decisions needed** (vague criteria, where the story, the contract and the app disagree, contract gaps, layer choices that could go either way). You approve, or move items between layers, drop or reword them. Then the analyst writes `docs/analysis/<name>.md`.

If there's a contract gap you want filled, Claude runs [/write-api-contracts](Write-API-Contracts) for that area now (it asks about the scope and live checks), before the scenarios are written.

### 2. The scenarios (checkpoint 2)

Claude starts `api-scenario-writer` and `ui-scenario-writer` in parallel, each with the items on its layer, the analysis document and the contracts. They write scenarios only for those items (the UI writer never repeats a check the API covers), each with a `ref` to the story's criterion. Claude shows both proposals together; you approve them once, or say what to change per layer. A layer with no new items is skipped.

### 3. Link and check

Claude fills in the analysis document's **Scenarios** column (`API-0114`, `UI-018 (existing)`), refreshes the notes that changed (a filled contract gap, a new area), runs `npm run validate:scenarios` and reports.

## How the layer is chosen

The rules are in [`layer-rules.md`](https://github.com/Zaytsman/SimpRight/blob/main/.claude/skills/analyze-requirements/references/layer-rules.md). In short:

- **API by default:** business rules and calculations, validation the server enforces, permissions and roles, data that is stored and read back, filters, sorting and search done by the server, bugs that show in a response.
- **UI only when the API can't prove it:** what only the page shows (layout, badges, a strikethrough price, disabled controls), validation done only in the browser, state kept in the browser (localStorage, location), navigation, accessibility.
- **At most one UI journey per story**: the happy path end to end; the rules along the way are API items.
- **Split, don't duplicate:** a rule the server enforces and the page shows is an API item with every case, plus one UI item for what the user sees.
- **Bugs** go to the lowest layer where they show.
- **When in doubt**, the API, with the choice listed under "Decisions needed".

## The analysis document

One file per work item in `docs/analysis/` (template: [`analysis-format.md`](https://github.com/Zaytsman/SimpRight/blob/main/.claude/skills/analyze-requirements/references/analysis-format.md)):

| Section | Holds |
|---|---|
| Header table | Source (a link to the story), type, criteria in scope, date |
| Summary | 3-6 sentences: who wants what and why, the main rules |
| Acceptance criteria | Each one as Given / When / Then |
| What it touches | API endpoints with contract sections, pages, test data |
| Test plan | Item, criterion, what to check, layer, why this layer, flags, scenarios |
| Open questions, Notes | Decisions you made, gaps, mismatches, existing UI tests that could move to the API |

Example: [`docs/analysis/product-detail.md`](https://github.com/Zaytsman/SimpRight/blob/main/docs/analysis/product-detail.md), the pilot run on the Product detail story's AC3-AC9: 13 items, the 9 UI items already covered by existing scenarios, the 4 API items written as API-0114..0118 after the carts contract gap was filled.

## What the agents never do

- **Invent requirements:** every item traces to a criterion. Behaviour seen in a contract, the app or its source but not described by the story is listed as "not tested", never planned.
- **Read the app's source for anything but the layer:** only where a rule is enforced (the server, the browser, both), never what the app should do.
- **Write anything but their own files:** the analyst writes only the analysis document; the scenario writers write only scenario files.
- **Copy secrets** into the analysis or the scenarios.

## Tips

- Number the criteria in your stories (`AC1`, `AC2`...): items, scenarios and the test plan point to them.
- Answer the "Decisions needed" at checkpoint 1: they decide the layers and the known issues.
- Next step: review the diff (`docs/analysis/` and `test-scenarios/`), then automate, API first: [/implement-api-scenarios](Implement-API-Scenarios), then [/implement-ui-scenarios](Implement-UI-Scenarios).

See also: [Add API Scenarios](Add-API-Scenarios#from-a-story-or-bug), [Add UI Scenarios](Add-UI-Scenarios#from-a-story-or-bug).
