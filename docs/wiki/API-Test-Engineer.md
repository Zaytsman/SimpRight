<!-- Source: docs/wiki/API-Test-Engineer.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# API Test Engineer

Automates **API scenarios** as Playwright specs: it plans the framework code and the tests, waits for your approval (including every test that changes live data), then writes the code, runs the specs, repeats them to catch flaky tests, and marks the scenarios `automated`.

| | |
|---|---|
| **Command** | `/implement-api-scenarios <scenario IDs \| scenario file \| area>` |
| **Agent** | `api-test-engineer` (`.claude/agents/api-test-engineer.md`) |
| **Skills** | `implement-api-scenarios` (the command); `api-scaffolding` and `api-test-from-scenario` (preloaded into the agent) |
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

The test stays as written and **fails**; the report shows the request, expected, actual and a proposal. You choose: add a `knownIssue` (the agent adds it and the test starts with `test.fail(true, 'Known issue BUG-001: ...')`), fix the scenario or contract, or leave it failing to investigate.

## The helper skills

These aren't commands: they're preloaded into the agent and describe how to write code in this project's style.

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
| **Tests** | One `test('<ID>: <name>')` each, name verbatim; `role` via `test.use`; known issue as the first line; no state shared between tests |
| **Action steps** | Client when the next step checks the status, service for setup; `attachJson` for request and response; `cleanup.add(...)` right after a create |
| **Verify steps** | Checks only, in the step's order; `assertMessage({ request, expected, actual })` on every assertion; secrets compared as a condition; exactly what the step says |
| **Things that bite** | Server-side caching (read back only records the test created); parse only after checking the status; exact status codes; no fixed sleeps |

## The rules it follows

- **The scenario is the specification:** every step, in order, verbatim; never a weakened check.
- **No invented contract details or test data:** what it can't find is a "Decision needed".
- **Live guardrails:** writes only when approved; `liveApi.dangerous` never.
- **Test-side code only**, additive changes to shared files; in scenario files only `status`, `automatedIn` and an approved `knownIssue`.
- **No secrets:** never opens `.env`; users and tokens come from fixtures.

## Tips

- Run `/review-tests` afterwards: the reviewer is independent of the engineer.
- Next: [Test Reviewer](Test-Reviewer), then commit.

See also: [API Automation](API-Automation), [API Scenario Writer](API-Scenario-Writer).
