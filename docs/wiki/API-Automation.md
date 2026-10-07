<!-- Source: docs/wiki/API-Automation.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# API Automation

How to turn API scenarios into running tests with the AI agents: one command, a plan you approve, then the code, the test runs and a report. After that come the review, the commit and, if CI fails, the healing.

```
manual API scenarios ──/implement-api-scenarios──► plan ──approve──► clients, services, DTOs, fixtures, specs
                                                                       │
                       /review-tests ◄─────────────────────────────────┘ ──► commit, PR, CI ──/heal-tests (if red)
```

## Before you start

- **Scenarios with `status: manual`** in `test-scenarios/api/<area>/`. See [Generate Scenarios](Generate-Scenarios).
- **A contract** for the area in `docs/api/contracts/`: the engineer takes endpoints, fields, status codes and messages from it, never from guesses.
- The framework installed, `.env` set up and a passing run ([Installation & Setup](Installation-&-Setup)): the agent runs the new specs against the live API.
- The project open in **[Claude Code](https://claude.com/claude-code)**.

## 1. Start the run

```text
/implement-api-scenarios post-users-login.yml
/implement-api-scenarios API-0078 API-0079
/implement-api-scenarios API-0078..0084
/implement-api-scenarios users
```

The argument is a scenario file (the name is enough), scenario IDs or a range, or an area folder. Without one, Claude lists the files with their count of `manual` scenarios and asks.

Only `manual` scenarios are in scope; `automated` ones are skipped unless you ask to redo them. For more than about 15 scenarios or 3 files, Claude suggests starting with one file, so the plan stays reviewable.

## 2. Review the plan

The `api-test-engineer` agent reads the scenarios, the contract, the existing framework code and the project's exemplar files (named in `qa-agents-profile.yml`), and returns a plan. **Nothing is written yet.**

Per scenario file:

| Part | What it tells you |
|---|---|
| **Spec** | The spec it becomes: `tests/api/<area>/<same name>.spec.ts`, new or extended |
| **Scenario table** | Each scenario's role, whether it writes data, whether it's a known issue |
| **Needs** | Every client method, service method, DTO, fixture and factory function the tests use, marked `exists` (reused) or `new` |
| **Test data** | Where each piece of data comes from: a step, `TestConstants`, a factory |
| **Cleanup** | Which records the tests create and how each is removed, including which role deletes it |

Then, for the whole run:

- **Writes needing approval:** every test that creates, changes or deletes data on the live API, with what it writes. The profile's `liveApi.writes: ask` means none of them run without your yes.
- **Can't automate as written:** a step that needs something dangerous, data that doesn't exist, or a step the contract contradicts.
- **Decisions needed:** data the agent couldn't find, choices with more than one reasonable answer, contract gaps.

Claude asks in one message: approve the plan or say what to change; which writes are allowed (each one, or "all of them"); and the answers to the decisions.

## 3. Implementation

After your approval, the same agent:

1. **Adds the missing framework code**, only what the plan listed as new, in the style of the exemplars (the `api-scaffolding` skill):
   - client methods in `src/api/clients/` that map 1:1 to endpoints, on top of `BaseClient`;
   - service methods in `src/api/services/` for the happy paths (typed bodies, throw on errors);
   - request and response types in `src/api/dto/`;
   - fixtures in `src/api/fixtures/fixtures.ts`;
   - payload builders in `src/data/factories/<Area>Factory.ts`, with `uniqueName()` for every created record.
2. **Writes the specs** step for step (the `api-test-from-scenario` skill).
3. **Checks** with `npm run typecheck` and `npm run validate:scenarios`.
4. **Runs** each spec, and when it passes, **three more times** (`--repeat-each=3`) to catch flaky tests.
5. **Fixes its own mistakes**, at most 3 rounds per spec: a wrong path or parsing is fixed; a flaky test gets its cause fixed (shared data, caching, ordering), never retries, sleeps or longer timeouts.
6. **Finishes:** sets `status: automated` and `automatedIn` on each scenario, and in the contract changes the origin tag of each fact a passing test asserted exactly to `_(verified)_`.

The engineer changes only test-side code. It never edits a scenario's steps, and **never weakens a check to make a test pass**.

### What a generated spec looks like

```ts
// Scenarios: test-scenarios/api/users/get-users-me.yml
test.describe('@users-api - Users API', () => {
  test("API-0063: Current user endpoint returns the logged-in user's profile", async ({ usersClient }) => {
    const request = { method: 'GET', path: '/users/me' };
    let response: ApiResponse;

    await test.step("Send GET /users/me with the default user's token.", async () => {
      response = await usersClient.me();
      await attachJson('Current User Request', request);
      await attachJson('Current User Response', { status: response.status, body: response.body });
    });

    await test.step('Verify the response status is 200.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 200', actual: response.status })).toBe(200);
    });
  });
});
```

- One `test.step` per scenario step, titled with the step text, so the report reads like the scenario.
- `attachJson` attaches requests and responses; `assertMessage` puts the request, the expected and the actual value in every failure. Both mask passwords, tokens and the test users' emails, because the reports are published.
- Status-code checks use the **client** (raw response); happy-path data comes from **services**.
- Records a test creates are removed by the `cleanup` fixture after the test, pass or fail.

## 4. Read the report

Claude runs the typecheck and the validator once more and reports:

- the files changed, grouped (specs, clients/services/DTOs, fixtures, test data, scenarios, contracts);
- a table: scenario → spec → result (passed, passed on repeat, known issue, failing on app behaviour, not implemented and why);
- the contract facts now `_(verified)_`;
- the live writes the tests make and their cleanup;
- assumptions to confirm.

### When the API disagrees with the scenario

If the API behaves differently from what the scenario says, the agent stops working on that test and **leaves it failing**. Claude shows each one with the request, the expected and the actual result, and the agent's proposal. You choose:

| Choice | When | Result |
|---|---|---|
| **Add a `knownIssue`** | The API has a bug | The scenario gets `knownIssue: <text>`, the test starts with `test.fail(true, 'Known issue: ...')` and passes as an expected failure. The dashboard lists it under Known Issues |
| **Fix the scenario or contract** | The scenario expected something the API never promised | You (or Claude, if you ask) correct the YAML or the contract, and the test is run again |
| **Leave it failing** | You want to investigate first | Nothing changes |

## 5. Review, commit, CI

1. **Review the tests:** `/review-tests` (by default the work not pushed yet; or a spec, a scenario file, IDs). The read-only `test-reviewer` agent checks each test against its scenario and the conventions and ranks its findings blocker / should fix / nit. You pick the findings to apply; Claude applies them and re-runs the specs.
2. **Read the diff** yourself, then **commit** on `develop` (or a feature branch) and open a pull request into `main`. `verify` runs the specs your change affects.
3. **If CI fails:** `/heal-tests PR <number>` or `/heal-tests <run id>`. The `test-healer` agent diagnoses each failure first (test defect, flaky, app changed, app bug, data drift, environment) with evidence, and changes nothing until you pick the fixes.

## A full example

```text
/write-api-contracts ../practice-software-testing/sprint5/API carts   → docs/api/contracts/Carts_API.md
/write-api-scenarios Carts_API.md                                     → proposal → approve → test-scenarios/api/carts/*.yml
/implement-api-scenarios carts                                        → plan + writes → approve → specs, all passing
/review-tests                                                         → findings → pick → fixes applied
(commit, pull request, CI)
/heal-tests PR <n>                                                    → only if CI fails
```

## Doing it by hand

The agents follow the same conventions a person does, so you can write any part yourself:

1. Add what's missing: a client method, a service method, DTOs, fixtures (see [Project Structure](Project-Structure#where-new-code-goes)).
2. Write `tests/api/<area>/<scenario file name>.spec.ts`: a `// Scenarios: <yml path>` comment at the top, `test.describe('<tags> - <suite>')`, one `test('<ID>: <name>')` per scenario, one `test.step` per step, `assertMessage` on every assertion, `attachJson` for payloads, `cleanup.add(...)` for created records.
3. Set `status: automated` and `automatedIn: <spec path>` on the scenario.
4. Run `npm run typecheck`, `npm run validate:scenarios`, the spec, and the spec with `--repeat-each=3`.

The exemplar spec to copy is `tests/api/products/get-products-search.spec.ts`; the full rules are in [CLAUDE.md](https://github.com/Zaytsman/SimpRight/blob/main/CLAUDE.md#scenarios-and-specs-conventions).

See also: [UI Automation](UI-Automation).
