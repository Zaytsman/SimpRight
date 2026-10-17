---
name: implement-ui-scenarios
description: Automate UI test scenarios (the YAML files in the project's scenario folder) as browser test specs, with a checkpoint where the user approves the plan and the tests that change data before any code is written. Use when the user asks to implement, automate or write tests for UI scenarios, a UI scenario file or an area, e.g. "/implement-ui-scenarios product-sorting.yml" or "/implement-ui-scenarios UI-008..011".
argument-hint: "<scenario IDs | scenario file | area>"
---

# Implement UI scenarios

The work is done by the `ui-test-engineer` subagent, in two phases: a plan, then the code and the test runs. Your part: settle the brief, run the plan, get the user's approval, run the implementation, then check and report. A subagent can't ask the user anything, so the checkpoints happen here.

Arguments, if any: $ARGUMENTS

## How to ask

Every question to the user in this skill goes through the AskUserQuestion tool, following `../_shared/how-to-ask.md` (next to this skill's folder): the context as text first, 2–4 options, "(Recommended)" only with a reason, plain text when the tool is missing.

## 1. Settle the brief

- **Profile:** `qa-agents-profile.yml` in the repository root. If there's none, or it has no `ui` section, stop: the agent needs one.
- **Scenarios:** from the arguments, resolved against the UI scenario folder (`<paths.scenarios>/ui/`):
  - IDs (`UI-008 UI-009`, or a range `UI-008..011`);
  - a scenario file: a path as given, or a file name (with or without `.yml`, any letter case) found in the area folders;
  - an area folder name (`products`): every scenario in it.
  
  If nothing was given or nothing matches, list the UI scenario files with their count of `manual` scenarios and ask which to take: up to 4 files as options (the smallest first), with the rest named through "Other".
- Only `status: manual` scenarios are in scope. If the selection has `automated` ones, say they're skipped, unless the user asked to redo them.
- **Size:** more than about 10 scenarios or 2 files in one run makes the plan hard to review. Ask: "Start with <first file> (Recommended)" (a plan that size is easy to review), "All of them".
- **Notes:** anything the user said that matters.

## 2. Plan

Start the `ui-test-engineer` subagent with a brief that stands on its own (it can't see this conversation):

```
Profile: <absolute path of qa-agents-profile.yml>
Scenarios: <IDs or files, as absolute paths where they're files>
Phase: plan
Notes: <or "none">
```

The agent inspects the pages with the read-only page inspector (each logged-in run also registers and deletes the run's throwaway customer, like every test run).

Show the user the plan as the agent returned it. Then ask in one AskUserQuestion call:
1. **Plan:** "Approve", "Approve with edits" (the edits go in "Other"), "Rework" (say what's wrong in "Other"). Recommend "Approve" unless the plan has open assumptions or decisions that change its shape.
2. **Writes** (only when the plan lists "Writes needing approval"; the profile's `liveApi.writes` is `ask`): may these tests create, change or delete data on the live app? "All of them", "None", and with more than one scenario "Some" (the IDs in "Other"). Up to 3 scenarios: a multi-select with one option per scenario instead. Recommend "All of them" only when every write has a cleanup in the plan; name the cleanups in the description.
3. **Decisions needed:** one question per decision, with the agent's alternatives as the options and its preference first. More than 2 decisions go in a second call.

"Approve" or "Approve with edits" is the clear yes; write nothing before it. On "Rework", continue the agent in `Phase: plan` with the user's notes and ask again.

## 3. Implementation

Continue **the same agent** with SendMessage:

```
Phase: implement
Approved, with these edits: <edits, or "none">
Writes approved: <IDs, "all", or "none">
Decisions: <the user's answers>
```

If the agent can't be continued, start a new `ui-test-engineer` with the brief from step 2, `Phase: implement`, the plan pasted in full, and the lines above.

## 4. Check and report

1. Run the profile's `commands.typecheck` and `commands.validateScenarios` yourself and confirm they pass, and run the new specs once yourself (`commands.runSpec`).
2. Tell the user briefly: the files changed by group, the table of scenario → result, the live writes the tests make and their cleanup, and the assumptions to confirm.
3. **Failing on app behaviour:** show each one with its step, expected, actual and the agent's proposal, then ask one question per failure (failures with the same cause and proposal share one question): "Add the known issue" (naming the bug: existing ID, or new with its title), "Fix the scenario", "Leave it failing". Recommend "Add the known issue" only when the agent reproduced the behaviour and matched or drafted a bug; otherwise recommend nothing. For approved known issues, continue the agent (`Known issues approved: <ID: bug ID (existing, or new with its title): text>`) so it adds them and re-runs the specs; scenario fixes are the user's call, so don't make them unless asked.
4. Suggest the next step: review the diff, then commit.

Don't commit anything unless the user asks.
