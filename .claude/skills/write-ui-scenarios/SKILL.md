---
name: write-ui-scenarios
description: Propose and write UI test scenarios (YAML files in the project's scenario folder) from a user story with acceptance criteria, a bug report or a feature description, with a checkpoint where the user approves the proposal before any file is written. Use when the user asks to write, propose or fill gaps in UI test scenarios for a story, bug or feature, e.g. "/write-ui-scenarios Product_Detail.md AC3 AC8".
argument-hint: "<story or bug file | pasted text> [AC ...]"
---

# Write UI scenarios from a user story or bug

The work is done by the `ui-scenario-writer` subagent, in two phases: a proposal, then the files. Your part: settle the brief, run the proposal, get the user's approval, run the writing, then check and report. A subagent can't ask the user anything, so the checkpoint happens here.

Arguments, if any: $ARGUMENTS

## 1. Settle the brief

- **Profile:** `qa-agents-profile.yml` in the repository root. If there's none, stop: tell the user the agent needs a profile (paths, ID codes, roles), and that `CLAUDE.md` and the profile's schema describe it.
- **Document:** the first argument, resolved in this order: an existing path as given; `<paths.userStories>/<name>` from the profile; a case-insensitive match of the name (with or without `.md`) in that folder. If the user pasted the story or bug into the conversation instead, use the text. If there's neither, list the files in the stories folder and ask which one.
  - Pasted text: offer once to save it in the stories folder first (so scenarios can reference it in `ref`); go on with the text if the user doesn't want that.
- **Criteria:** the remaining arguments (`AC3 AC8`, `AC1-AC5`). Default: every criterion. For a document with more than about 6 criteria, say how many there are and offer to start with a subset (suggest the read-only ones first: those that don't add to the cart, register, order or change a profile); go on with all of them if the user doesn't want a subset.
- **Notes:** anything the user said that matters (criteria to skip, known bugs, priorities).

## 2. Proposal

Start the `ui-scenario-writer` subagent with a brief that stands on its own (it can't see this conversation):

```
Profile: <absolute path of qa-agents-profile.yml>
Document: <absolute path, or "pasted:" followed by the full text>
Criteria: <list or "all">
Phase: propose
Notes: <or "none">
```

The agent runs the page inspector against the live site (read-only; each run also registers and deletes the run's throwaway customer, like every test run).

Show the user the proposal as the agent returned it: the tables, the steps, the criteria map and "Decisions needed". Don't shorten the steps, because they are what the user approves. Then ask the user to approve it, or to say what to change (drop, rename, merge, reword, answer the decisions). Write nothing before a clear yes.

If the user approves a new area or role, add it to `ids.areas` or `roles` in the profile yourself before the writing phase (the agent doesn't change the profile). A new area also needs a folder option in the custom UI workflow, which the test engineer adds with the first spec.

## 3. Writing

Continue **the same agent** with SendMessage:

```
Phase: write
Approved, with these edits: <the user's edits and decisions, or "none">
```

If the agent can't be continued, start a new `ui-scenario-writer` with the brief from step 2, `Phase: write`, and the approved proposal pasted in full, followed by the edits.

## 4. Check and report

1. Run the profile's `commands.validateScenarios` yourself and confirm it passes.
2. Tell the user briefly: the files created and extended with their IDs, the validator result, the flagged scenarios (writes, data, dangerous, known issues), the criteria not covered, any ID renumbering, and what the agent noticed but didn't change.
3. Suggest the next step: review the diff of the scenario folder, then automate the scenarios (the UI test engineer comes in the next phase of the UI agents).

Don't commit anything unless the user asks.
