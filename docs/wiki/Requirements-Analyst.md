<!-- Source: docs/wiki/Requirements-Analyst.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# Requirements Analyst

Reads a **user story, bug report or feature description**, writes a short **analysis document** with a **test plan**, and decides for every check whether it's tested through the **API or the UI**, preferring the API because it's cheaper, faster and more stable. Then the [API Scenario Writer](API-Scenario-Writer) and the [UI Scenario Writer](UI-Scenario-Writer) turn the plan into scenarios, so one command takes a work item to scenarios on both layers.

| | |
|---|---|
| **Command** | `/analyze-requirements <story or bug file \| pasted text> [AC ...]` |
| **Agent** | `requirements-analyst` (`.claude/agents/requirements-analyst.md`), then `api-scenario-writer` and `ui-scenario-writer` |
| **Skill** | `analyze-requirements` (`.claude/skills/analyze-requirements/SKILL.md`, with `references/layer-rules.md` and `references/analysis-format.md`) |
| **Input** | A story or bug in `docs/ui/user-stories/`, or text pasted into the chat. Trackers (Azure DevOps, Jira) aren't read yet: paste the work item's text |
| **Output** | `docs/analysis/<name>.md`, plus scenarios in `test-scenarios/api/` and `test-scenarios/ui/` |
| **Reads** | The contracts, the existing scenarios of both layers, the app's source when it's next to the repo (only to see where a rule is enforced), the page inspector (at most 3 runs) |
| **Checkpoints** | Two: the test plan, then the scenarios of both layers together |

## When to use it

- A story touches both the API and the UI, and you want the tests on the cheapest layer that can prove each criterion.
- A bug was reported from the UI, and you want to know whether the API can reproduce it.
- You want a short written record of what a work item asks for and how it's tested.

For a story you know is UI-only, [`/write-ui-scenarios`](UI-Scenario-Writer) is enough; for an API area without a story, [`/write-api-scenarios`](API-Scenario-Writer).

## How to use it

```text
/analyze-requirements Product_Detail.md
/analyze-requirements Product_Detail.md AC3-AC9
/analyze-requirements BUG-45.md
```

The first argument is the document: a path, or a name in `docs/ui/user-stories/` (any case, `.md` optional). You can also paste the work item into the chat; Claude offers once to save it in the stories folder, so the analysis and the scenarios can link to it. The rest of the arguments pick criteria (default: all).

## What happens

### 1. The analysis (checkpoint 1, nothing is written)

The analyst:

1. **Reads** the document and restates each criterion as Given / When / Then.
2. **Finds what it touches:** the API endpoints behind each criterion (with the contract and section), the pages, and the data the tests need. An endpoint with no contract is a **contract gap**.
3. **Finds existing coverage** in the scenarios of both layers, so nothing is planned twice.
4. **Splits each criterion into test items** (`T1`, `T2`, ...), each with a layer, the reason for that layer and flags (`writes`, `data`, `dangerous`, `known issue`, `contract gap`).

Claude shows the summary, the test plan table and the **Decisions needed** (vague criteria, where the story, the contract and the app disagree, contract gaps, layer choices that could go either way). You approve, or move items between layers, drop or reword them. Then the analyst writes `docs/analysis/<name>.md`.

If there's a contract gap you want filled, Claude runs [`/write-api-contracts`](API-Contract-Writer) for that area now (it asks about the scope and live checks), before the scenarios are written.

### 2. The scenarios (checkpoint 2)

Claude starts the two scenario writers in parallel, each with the items on its layer, the analysis document and the contracts. They write scenarios only for those items (the UI writer never repeats a check the API covers), each with a `ref` to the story's criterion. Claude shows both proposals together; you approve them once, or say what to change per layer. A layer with no new items is skipped.

### 3. Link and check

Claude fills in the analysis document's **Scenarios** column (`API-0114`, `UI-018 (existing)`), refreshes the notes that changed (a filled contract gap, a new area), runs `npm run validate:scenarios` and reports.

## How it chooses the layer

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

## The rules it follows

- **Never invents requirements:** every item traces to a criterion. Behaviour it sees in a contract, the app or its source but the story doesn't describe is listed as "not tested", never planned.
- **The app's source only for the layer:** it reads where a rule is enforced (the server, the browser, both), never what the app should do.
- **Read-only:** no API calls; the inspector at most 3 times, never typing or submitting.
- **Writes only the analysis document**; the scenario writers write the scenarios.
- **No secrets.**

## Tips

- Number the criteria in your stories (`AC1`, `AC2`...): items, scenarios and the test plan point to them.
- Answer the "Decisions needed" at checkpoint 1: they decide the layers and the known issues.
- Next step: review the diff (`docs/analysis/` and `test-scenarios/`), then automate, API first: [API Test Engineer](API-Test-Engineer), then [UI Test Engineer](UI-Test-Engineer).

See also: [Generate Scenarios](Generate-Scenarios#from-a-story-to-both-layers).
