<!-- Source: docs/wiki/Implement-API-Scenarios.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# /implement-api-scenarios

Automates **API scenarios** as Playwright specs. It plans the framework code and the tests, then waits for your approval, including every test that changes live data. Then it writes the code, runs the specs, repeats them to catch flaky tests, and marks the scenarios `automated`.

| | |
|---|---|
| **Command** | `/implement-api-scenarios <scenario IDs \| scenario file \| area>` |
| **Agent** | [`api-test-engineer`](https://github.com/Zaytsman/SimpRight/blob/main/.claude/agents/api-test-engineer.md) |
| **Skill files** | [`implement-api-scenarios`](https://github.com/Zaytsman/SimpRight/blob/main/.claude/skills/implement-api-scenarios/SKILL.md) (the command); [`api-scaffolding`](https://github.com/Zaytsman/SimpRight/blob/main/.claude/skills/api-scaffolding/SKILL.md) and [`api-test-from-scenario`](https://github.com/Zaytsman/SimpRight/blob/main/.claude/skills/api-test-from-scenario/SKILL.md), preloaded into the agent (not commands) |
| **Input** | Scenarios with `status: manual` in `test-scenarios/api/`, and the area's contract |
| **Output** | Specs in `tests/api/<area>/`; clients, services, DTOs, fixtures, factories as needed; scenarios marked `automated`; contract facts tagged `_(verified)_` |
| **Live app** | Runs the specs against the live API; tests that write data only with your approval |
| **Checkpoint** | A plan you approve, with the list of writes, before any code is written |

## When to use it

- New API scenarios have been written and approved.
- You want a whole area automated (`/implement-api-scenarios users`) or a few IDs.

## How to use it

```text
/implement-api-scenarios get-products-by-product-id.yml
/implement-api-scenarios API-0078 API-0079
/implement-api-scenarios API-0078..0084
/implement-api-scenarios users
```

Only `manual` scenarios are in scope (`automated` ones are skipped unless you ask to redo them). More than about 15 scenarios or 3 files makes the plan hard to review, so Claude suggests one file at a time.

## What happens

### Phase 1: the plan (nothing is written)

The agent reads the profile, the conventions, the scenarios, the contract, the existing framework code and the exemplars, and returns per scenario file:

- the spec it becomes (new or extended), and a table of the scenarios with role, writes and known issues;
- **Needs:** each client method, service method, DTO, fixture and factory function, `exists` or `new` (existing code is reused, not rewritten);
- **Test data:** where each value comes from;
- **Cleanup:** what the tests create and how each record is removed, by which role.

Then **Writes needing approval**, **Can't automate as written** and **Decisions needed**. Claude asks once: approve the plan, which writes may run (each or "all of them"), and the answers.

### Phase 2: implementation

1. **Scaffold** only what the plan lists as new (`api-scaffolding`).
2. **Write the specs** (`api-test-from-scenario`).
3. **Check:** `npm run typecheck`, `npm run validate:scenarios`.
4. **Run** each spec, then `--repeat-each=3`.
5. **Fix loop**, at most 3 rounds per spec: a test-code mistake is fixed; a flaky test gets its cause fixed (shared data, server-side caching, ordering), never retries, sleeps or longer timeouts; a disagreement with the API stops work on that test (see below).
6. **Finish:** `status: automated` + `automatedIn` on each scenario; in the contract, `_(verified)_` on each fact a **passing** test asserted exactly.

Claude then runs the typecheck and validator again and reports: files by group, scenario → result, newly verified contract facts, the live writes and their cleanup, and assumptions to confirm.

### When the API disagrees with the scenario

The test stays as written and **fails**; the report shows the request, expected, actual and a proposal. You choose: add a `knownIssue` (the agent adds it and `test.fail(true, 'Known issue BUG-001: ...')` before the test's first step), fix the scenario or contract, or leave it failing to investigate. To record the bug, use [/report-bug](Report-Bug).

## The preloaded skills

They describe how to write code in this project's style; the agent follows them, you never call them.

### `api-scaffolding`

| Part | Rules |
|---|---|
| **Clients** | One per API area, one method per endpoint (1:1), returning the raw response; no parsing or status checks. All HTTP through `BaseClient`; a missing HTTP method (such as `QUERY`) is added to `BaseClient` in the same style |
| **Services** | Happy paths over a client: parse into a DTO, throw with status and body otherwise. Only for endpoints a step uses as a happy path, setup or cleanup |
| **DTOs** | Types from the contract: `?` for optional, `\| null` for nullable; existing fields only made more precise |
| **Fixtures** | Every new client and service registered like the existing ones. Different auth (no token, invalid token, an admin for cleanup) gets its own fixture, never a token setter on a shared one |
| **Test data** | Shared seeded values in `TestConstants`; payload builders in `<Area>Factory.ts` with `uniqueName()`; factories never call the API or hard-code seeded ids |
| **Keep it small** | No abstraction for one call site; a shared setup helper moves to a shared module only when a second spec needs it; additive changes only |

### `api-test-from-scenario`

| Part | Rules |
|---|---|
| **File** | Same name as the scenario file; `// Scenarios: <yml path>`; imports from `@fixtures`, DTOs, test data and the assertion helpers; one `test.describe('<tags> - <suite>')` |
| **Tests** | One `test('<ID>: <name>')` each, name verbatim; `role` via `test.use`; known issue right before the first step, after any setup; no state shared between tests |
| **Reuse** | The shared checks (`src/utils/apiChecks.ts`) and step helpers (`src/api/fixtures/apiSteps.ts`, the area's `*Steps.ts`) before writing new ones; tests that differ only in their data share one template, called from one `test()` per scenario |
| **Action steps** | Client when the next step checks the status, service for setup; `sendAndAttach` for the call, its request and its response (the token named with an `AUTH` label); `cleanup.add(...)` right after a create |
| **Verify steps** | Checks only, in the step's order; `expectStatus` and `parseJson` for the status and the body; `expectSomeItems` before an "every item" check; `assertMessage({ request, expected, actual })` on every assertion; secrets compared as a condition; exactly what the step says |
| **Things that bite** | Server-side caching (read back only records the test created); parse only after checking the status; exact status codes; no fixed sleeps |

## What the agent never does

- **Change what a scenario checks:** every step, in order, verbatim; never a weakened check.
- **Invent contract details or test data:** what it can't find is a "Decision needed".
- **Write to the live app unasked:** writes only when approved; what `liveApi.dangerous` lists never.
- **Touch more than test-side code:** additive changes to shared files; in scenario files only `status`, `automatedIn` and an approved `knownIssue`.
- **Touch secrets:** it never opens `.env`; users and tokens come from fixtures.

## Tips

- Run [/review-tests](Review-Tests) afterwards: the reviewer is independent of the engineer.
- Next: review, then commit.

See also: [API Automation](API-Automation), [/write-api-scenarios-from-contract](Write-API-Scenarios-From-Contract).
