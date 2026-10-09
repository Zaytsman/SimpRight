<!-- Source: docs/wiki/Test-Healer.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# Test Healer

Finds out **why automated tests failed**, UI or API, and fixes what is the tests' fault. It diagnoses first, with a verdict and evidence for every failure, and changes nothing until you pick the fixes. Unlike a healer that edits tests until they pass, it never weakens a check, never skips a test and never adds retries: a test made green while the app is broken is the worst outcome.

| | |
|---|---|
| **Command** | `/heal-tests [CI run id \| PR number \| spec \| scenario IDs]` |
| **Agent** | `test-healer` (`.claude/agents/test-healer.md`) |
| **Skill** | `heal-tests` (`.claude/skills/heal-tests/SKILL.md`) |
| **Input** | A failed CI run, a pull request's failed check, the last local run, or specs to reproduce |
| **Output** | A diagnosis (a verdict per cause, with evidence and a proposed action), then the approved fixes, run and repeated |
| **Live app** | Read-only while diagnosing: the inspector, `GET` calls without a token, re-runs of read-only tests |
| **Checkpoint** | You pick the fixes, known issues and writes after the diagnosis |

## When to use it

- A scheduled regression or a pull request's `verify` check is red.
- A local run failed and you want to know whether it's the test, the app or the site.
- A known-issue test suddenly passes (the bug may be fixed).

## How to use it

```text
/heal-tests
/heal-tests 37281657082
/heal-tests https://github.com/Zaytsman/SimpRight/actions/runs/37281657082
/heal-tests PR 22
/heal-tests product-detail.spec.ts
/heal-tests UI-013 UI-014
```

| Source | Meaning |
|---|---|
| none | The last local run (`test-results/.last-run.json`); if it passed, Claude lists the latest failed CI runs and asks |
| a run id or URL | That CI run |
| `PR <n>` or `#<n>` | The pull request's latest failed check run |
| a spec, scenario file or IDs | Run them now to reproduce; tests that write data only if you approved their writes before |

## What happens

### Phase 1: diagnosis (changes nothing)

1. **Collects the failures:** for a CI run, its info and failed log (not the multi-MB artifacts; downloading one is a decision for you); for a local run, `.last-run.json`, `error-context.md`, screenshots and traces. Failures come from Playwright's summary, not the ✘ marks: a known-issue test that fails is an expected failure.
2. **Gathers evidence**, cheapest first: the error itself, the time, `git log` of the test's files since the last green run, a `GET` to the API, a page inspection, a re-run (once, then repeated for flakiness; never inside the site's known bad windows such as the hourly re-seed, never right after a lock).
3. **Looks across failures:** the same minutes, endpoint, seeded record or shared member usually means one cause.
4. **Checks what the run left behind:** a cleanup that failed may have left a record on the live app.

Claude checks each high-confidence verdict that proposes a code change against the code itself, then shows the diagnosis:

```
## Diagnosis: CI run <id>, <n> failed, <f> flaky, <u> unexpectedly passed
### 1. Environment: <short cause> — high
Tests: ...
Evidence: ...
Cause: ...
Proposed action: re-run after <time>, no code change
Changes what a test checks: no
Writes: none
### 2. ...
## Left behind on the live app
## Decisions needed
```

### The verdicts

| Verdict | Meaning | Proposed action |
|---|---|---|
| **Test defect** | The test code is wrong: a locator, a missing wait, a wrong expected value, broken setup or cleanup | The concrete code fix |
| **Flaky** | Passes and fails on the same code and app | Fix the cause (wait for the app's signal, isolate data); never retries, sleeps or longer timeouts |
| **App changed** | The app changed on purpose | Update the page object, client or DTO; a scenario change is proposed to you |
| **App bug** | The app breaks what the scenario promises | A `knownIssue` text and its bug: an open one with the same cause, or a new bug file (steps, expected, actual, evidence); or record it with [`/report-bug`](Bug-Reporter) |
| **Data drift** | The test's data changed under it: another visitor changed a seeded product, the re-seed replaced ids, a stale cache | Make the test create its own data through the API (a write, so it needs approval) |
| **Environment** | The site was slow, down or locked for a while | No code change: a re-run, and when |

Each cause has a confidence (high / medium / low); below high, it says what would confirm it. A known-issue test that **passes** is reported as "unexpectedly passed", with a proposal to remove the known issue.

You then answer in one message: which causes to fix (by number), which known issues to add or remove, which writes to allow, the decisions, and whether to remove records left behind (a write, never done unasked). Environment verdicts need no fix: Claude suggests the re-run (`gh run rerun <id> --failed`) and runs it only if you ask.

### Phase 2: fixes

The same agent applies only the approved fixes, adds or removes approved known issues, runs the typecheck and validator, runs each changed spec and repeats it (every spec that uses a changed shared member, too), at most 3 rounds. Claude runs the checks and the changed specs once more and reports: causes fixed and how, tests → result, causes left and why, anything left on the live app. Next step it suggests: `/review-tests` on the changed files, then commit.

## The rules it follows

- **The scenario is the specification:** never removes or loosens a check, widens a timeout, adds retries or sleeps, or marks a test `fixme`/`skip`. A scenario change or a known issue is your decision.
- **Evidence before verdict**, with a confidence level.
- **Read-only diagnosis:** only reading results and code, the CI log, the inspector, `GET` calls without a token, and re-runs of read-only or approved tests. It may read the app's source code (if a checkout is nearby) to judge whether behaviour is intended, and says so.
- **Knows the site's bad moments:** the profile's `liveApi.transient` lists them (the hourly re-seed, a 5-minute cache on `GET /products`, slowdowns ending in login 500s, other visitors editing products, locks). Known-issue tests inside a bad window prove nothing.
- **Test-side code only**; in scenarios only an approved `knownIssue` and `bug`, in `bugs/` only an approved new bug or status change. **No secrets**: credentials and test users' emails are masked as `***` even in quoted logs.

## Tips

- On this public demo site, **environment** and **data drift** are the most common verdicts: check them before changing code.
- Don't re-run right on the hour: the site re-seeds at :00.

See also: [CI Runs](CI-Runs#where-the-results-are), [Local Runs](Local-Runs#read-the-results).
