---
name: implement-api-scenarios
description: Automate API test scenarios (the YAML files in the project's scenario folder) as test specs, with a checkpoint where the user approves the plan and the tests that change data before any code is written. Use when the user asks to implement, automate or write tests for API scenarios, a scenario file or an API area, e.g. "/implement-api-scenarios get-products-by-product-id.yml".
argument-hint: "<scenario IDs | scenario file | area>"
---

# Implement API scenarios

The work is done by the `api-test-engineer` subagent, in two phases: a plan, then the code and the test runs. Your part: settle the brief, run the plan, get the user's approval, run the implementation, then check and report. A subagent can't ask the user anything, so the checkpoints happen here.

Arguments, if any: $ARGUMENTS

## 1. Settle the brief

- **Profile:** `qa-agents-profile.yml` in the repository root. If there's none, stop: the agent needs one.
- **Scenarios:** from the arguments, resolved against the API scenario folder (`<paths.scenarios>/api/`):
  - IDs (`API-0020 API-0021`, or a range `API-0020..0022`);
  - a scenario file: a path as given, or a file name (with or without `.yml`, any letter case) found in the area folders;
  - an area folder name (`products`): every scenario in it.
  
  If nothing was given or nothing matches, list the scenario files with their count of `manual` scenarios and ask.
- Only `status: manual` scenarios are in scope. If the selection has `automated` ones, say they're skipped, unless the user asked to redo them.
- **Size:** more than about 15 scenarios or 3 files in one run makes the plan hard to review. Say so, and suggest starting with one file; go on if the user wants all of them.
- **Notes:** anything the user said that matters.

## 2. Plan

Start the `api-test-engineer` subagent with a brief that stands on its own (it can't see this conversation):

```
Profile: <absolute path of qa-agents-profile.yml>
Scenarios: <IDs or files, as absolute paths where they're files>
Phase: plan
Notes: <or "none">
```

Show the user the plan as the agent returned it. Then ask, in one message:
- whether the plan is approved, or what to change;
- for each scenario under "Writes needing approval" (the profile's `liveApi.writes` is `ask`), whether its test may create, change or delete data on the live API. Offer "all of them" as an option;
- the answers to "Decisions needed".

Write nothing before a clear yes.

## 3. Implementation

Continue **the same agent** with SendMessage:

```
Phase: implement
Approved, with these edits: <edits, or "none">
Writes approved: <IDs, "all", or "none">
Decisions: <the user's answers>
```

If the agent can't be continued, start a new `api-test-engineer` with the brief from step 2, `Phase: implement`, the plan pasted in full, and the lines above.

## 4. Check and report

1. Run the profile's `commands.typecheck` and `commands.validateScenarios` yourself and confirm they pass.
2. Tell the user briefly: the files changed by group, the table of scenario → result, the contract facts now `_(verified)_`, the live writes the tests make and their cleanup, and the assumptions to confirm.
3. **Failing on app behaviour:** show each one with its request, expected, actual and the agent's proposal, and ask the user what to do with each: add the proposed `knownIssue`, fix the scenario or contract, or leave it failing to investigate. For approved known issues, continue the agent (`Known issues approved: <ID: text>`) so it adds them and re-runs the specs; scenario and contract fixes are the user's call, so don't make them unless asked.
4. Suggest the next step: review the diff, then commit.

Don't commit anything unless the user asks.
