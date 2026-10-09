---
name: heal-tests
description: Diagnose failing automated UI and API tests (from a CI run, a pull request's checks, the last local run or a spec) and fix the ones the user approves, with a checkpoint between the diagnosis and any change. Use when the user asks why tests failed, to triage, heal or fix failing tests, or to look at a red run or PR check, e.g. "/heal-tests", "/heal-tests 37281657082", "/heal-tests PR 22" or "/heal-tests product-detail.spec.ts".
argument-hint: "[CI run id | PR number | spec | scenario IDs]"
---

# Heal tests

The work is done by the `test-healer` subagent, in two phases: a diagnosis, then the approved fixes. Your part: settle the source, run the diagnosis, check it and get the user's choices, run the fixes, then check and report. A subagent can't ask the user anything, so the checkpoint happens here.

Arguments, if any: $ARGUMENTS

## 1. Settle the source

- **Profile:** `qa-agents-profile.yml` in the repository root. If there's none, stop: the agent needs one.
- **Source**, from the argument:
  - **A CI run id** (a long number) or a run URL: that run.
  - **A PR number** (`PR 22`, `#22`): its latest failed check run (`gh pr checks <n>`, then the run id of the failed check).
  - **A spec, a scenario file or IDs:** run those now (the agent reproduces them). Say which have writes: they run only if the user approved those writes before; ask otherwise.
  - **None:** the last local run (`test-results/.last-run.json`). If it passed or doesn't exist, show the latest failed CI runs (`gh run list --status failure --limit 5`) and ask which one.
- If the run passed, say so and stop.
- **Notes:** anything the user said that matters (a cause they suspect, tests to leave out).

## 2. Diagnose

Start the `test-healer` subagent with a brief that stands on its own (it can't see this conversation):

```
Profile: <absolute path of qa-agents-profile.yml>
Source: <CI run <id> in <owner/repo> | local results <absolute path of test-results> | run: <specs or IDs>>
Phase: diagnose
Writes approved for re-runs: <IDs or specs the user approved before, or "none">
Notes: <or "none">
```

Before showing the diagnosis, check each high-confidence verdict that proposes a code change against the code yourself (open the file at the line). If one doesn't hold, lower its confidence or drop it, and say why.

Show the diagnosis as the agent returned it. Then ask, in one message:
- which causes to fix, by number ("all", "none", or a list); say which fixes change what a test checks, touch a shared member other tests use, or add writes: those need an explicit yes;
- for each proposed known issue or its removal, and each scenario change, whether to make it (scenario changes are made by the user or with `/write-*-scenarios`, not by the healer). A known issue with a **new** bug can be approved here, or recorded with `/report-bug <scenario IDs>` afterwards, which reproduces it, checks for duplicates and links the scenarios; suggest that when the healer's bug note is thin or the bug may already exist under another cause;
- the answers to "Decisions needed";
- for records left behind on the live app, whether the user wants to remove them (removing them is a write: don't do it unasked).

Environment verdicts need no fix: suggest the re-run (`gh run rerun <id> --failed`, or the local command) and when, and run it only if the user asks.

## 3. Fix

If the user picked any fixes, continue **the same agent** with SendMessage:

```
Phase: fix
Fixes approved: <cause numbers, with the user's edits>
Known issues approved: <ID: bug ID (existing, or new with its title): text, or "none">
Writes approved: <IDs or specs, or "none">
Decisions: <the user's answers>
```

If the agent can't be continued, start a new `test-healer` with the brief from step 2, `Phase: fix`, the diagnosis pasted in full, and the lines above.

## 4. Check and report

1. Run `commands.typecheck` and `commands.validateScenarios` yourself, and run the changed specs once (`commands.runSpec`; for UI, `DISABLE_API_COVERAGE=true`).
2. Tell the user briefly: the causes fixed and how, the table of tests → result, the causes left and why, and anything left on the live app.
3. Suggest the next step: `/review-tests` on the changed files, then commit.

Don't commit anything unless the user asks.
