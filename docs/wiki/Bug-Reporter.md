<!-- Source: docs/wiki/Bug-Reporter.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# Bug Reporter

Records **bugs in the app under test** as files in `bugs/`, one per root cause, and links them to the scenarios that hit them. It reproduces each bug before filing it, checks the existing bugs so the same defect isn't filed twice, and changes nothing until you approve the draft. The bugs are published on the [Bugs Page](Bugs-Page).

| | |
|---|---|
| **Command** | `/report-bug <description \| scenario IDs \| spec> \| import <contract> \| recheck <bug IDs \| open>` |
| **Agent** | `bug-reporter` (`.claude/agents/bug-reporter.md`) |
| **Skill** | `report-bug` (`.claude/skills/report-bug/SKILL.md`) |
| **Input** | What someone saw, failing scenarios or tests, a contract's suspected bugs, open bugs to re-check |
| **Output** | A draft (reproduction, duplicate check, proposed bug files, scenarios to link, coverage gaps), then the files |
| **Live app** | Read-only: `GET` calls without a token, the page inspector, re-runs of read-only tests; a reproduction that writes runs only after you approve it |
| **Checkpoint** | You approve the items, their wording and severity, and any writes |

## When to use it

- You (or a tester) saw the app misbehave and want it on record.
- A test fails because of the app: the [Test Healer](Test-Healer) or a test engineer says "app bug".
- A contract marks responses as suspected bugs and you want them tracked.
- The Bugs page flags a bug for a **re-check**, or you want to know which open bugs are still there.

## How to use it

```text
/report-bug the cart accepts quantity 0 on the product page
/report-bug UI-024 UI-025
/report-bug tests/api/products/get-products.spec.ts
/report-bug import Users_API.md
/report-bug recheck BUG-005
/report-bug recheck open
```

| Mode | Input | What it does |
|---|---|---|
| **report** (default) | A description, scenario IDs, a spec or a failed test, another agent's bug note | Reproduces it, finds its root cause, files a new bug or extends an existing one, links the scenarios |
| **import** | A contract (or `all`) | Turns the responses and notes marked "suspected bug" into bugs, skipping those already tracked |
| **recheck** | Bug IDs, or `open` | Reproduces each bug; a bug that's gone is closed |

## What happens

### Phase 1: draft (changes nothing)

1. **Reads** the profile, the conventions, the bug schema and every existing bug.
2. **Finds the root cause** of each item and checks it against the existing bugs: different symptoms of one defect are one bug (BUG-001 covers `POST`, `PUT` and `PATCH` without a token), one symptom with two causes is two.
3. **Reproduces** it, cheapest first: the contract or the app's source, a `GET`, the page inspector, a re-run of a read-only test. A reproduction that creates or changes data is listed under "Writes needed" for you to approve.
4. **Finds the scenarios** that hit it, and the gaps: a bug no scenario covers gets a proposed regression scenario (to add with the scenario writers).

Claude checks the draft against the existing bugs and the evidence for secrets, then shows it:

```
## Bug draft: report UI-024 UI-025, 1 item (0 new bugs, 1 existing extended, 0 to close, 0 not filed)
### 1. Extends BUG-008: Cart quantity stops at 99 instead of the story's range of 1 to 999,999,999
Root cause: ...
Reproduced: ...
Bug file: <the changed keys>
Scenarios to link: UI-024: <knownIssue text> (manual), UI-025: ...
Coverage gap: none
## Writes needed
## Decisions needed
```

You answer in one message: which items to write (by number) with any edits, which writes to allow, the decisions, and whether to add the proposed regression scenarios now.

### Phase 2: files

The same agent runs the approved writes (with cleanup), writes the bug files, links the scenarios (`knownIssue`, `bug`, and the known-issue line as the first line of an automated test), runs the validator and the typecheck, and runs the specs whose known-issue line changed: a newly linked test must pass as an expected failure. Claude checks it again (validator, typecheck, the Bugs page build, the changed specs) and reports.

### Re-checking and closing

A **recheck** reproduces each bug from its steps. When the bug is gone, the agent proposes to close it: `status: fixed` with today's `resolved` date, and the known issue removed from every scenario and test of that bug, so the tests check the fixed behaviour and fail if the bug comes back. A bug you decide to accept becomes `wont-fix`; its scenarios change only if you change what they check. Bug files are never deleted.

## The rules it follows

- **One bug per root cause**, checked against every existing bug before a new one is proposed.
- **Reproduced, or says where it comes from:** a bug is filed with today's evidence, or marked as read from the source or a test run. Never a guess.
- **Read-only by default**; writes only when approved, with cleanup; never what `liveApi.dangerous` names.
- **The schema and the conventions:** keys in order, the next free `BUG-NNN`, layer and area where the defect is, steps a person can follow.
- **Masked evidence:** no tokens, passwords or test users' emails, because the Bugs page is public.
- **Only the link in scenarios and tests:** `knownIssue`, `bug` and the known-issue line; never steps, names or other test code. New regression scenarios are proposals for the scenario writers.

See also: [Bugs Page](Bugs-Page), [Test Healer](Test-Healer), [Generate Scenarios](Generate-Scenarios).
