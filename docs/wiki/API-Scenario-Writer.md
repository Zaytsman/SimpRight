<!-- Source: docs/wiki/API-Scenario-Writer.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# API Scenario Writer

Proposes and writes **API test scenarios**: one YAML file per endpoint in `test-scenarios/api/<area>/`, every scenario `status: manual`, ready for the [API Test Engineer](API-Test-Engineer). It works from one of three sources:

- **a contract**, endpoint by endpoint: `/write-api-scenarios-from-contract` (most of this page);
- **test cases you already have** (steps in plain text, request and expected-response JSON, a Bruno collection): `/write-api-scenarios-from-steps` (see [From test steps](#from-test-steps));
- **the API items of a story's analysis**, handed over by the [Requirements Analyst](Requirements-Analyst).

| | |
|---|---|
| **Commands** | `/write-api-scenarios-from-contract <contract> [endpoint ...]`, `/write-api-scenarios-from-steps <steps \| JSON files \| Bruno collection> [ref]` |
| **Agent** | `api-scenario-writer` (`.claude/agents/api-scenario-writer.md`) |
| **Skills** | `write-api-scenarios-from-contract`, `write-api-scenarios-from-steps` (`.claude/skills/<name>/SKILL.md`) |
| **Input** | A contract in `docs/api/contracts/`, or your test cases (checked against the contracts) |
| **Output** | `test-scenarios/api/<area>/<method>-<path>.yml` |
| **Live app** | None: it works from documents only |
| **Checkpoint** | A proposal you approve before any file is written |

## When to use it

- A new contract was written, or an existing one gained endpoints.
- The coverage report shows documented status codes no test covers yet.

## How to use it

```text
/write-api-scenarios-from-contract Users_API.md
/write-api-scenarios-from-contract users
/write-api-scenarios-from-contract Users_API.md POST /users/login GET /users/me
/write-api-scenarios-from-contract Products_API.md /products/{productId}
```

The first argument is the contract: a path, or a file name in `docs/api/contracts/` (any case, `.md` optional). The rest limit the endpoints; a path alone means every method on it. Without arguments, Claude lists the contracts and asks. For a contract with more than about 8 endpoints, Claude offers to start with a subset.

## What happens

### Phase 1: the proposal (nothing is written)

The agent reads the profile, the conventions, the contract and the existing scenarios, then goes through a **fixed checklist** per endpoint, so two runs propose the same things:

1. **Candidates:** a happy path per success status (with response-shape checks as extra steps); each parameter that changes the result and its documented boundaries; each error a client can trigger (401 no/invalid token, 403 wrong role, 404 unknown id, 409, 415, 422 for all required fields plus one per rule); suspected bugs the contract marks, as scenarios that assert the **correct** behaviour with a `knownIssue`.
2. **Filter:** drops framework-wide codes and untriggerable `500`s, and what existing scenarios already cover; flags writes and dangerous calls.
3. **Combine or split:** one reason to fail per scenario.
4. **Order:** happy path, parameters, auth, validation, not found, conflicts, known issues; the lowest-priority ones marked `optional` when an endpoint has many.

Claude shows the proposal in full:

- per endpoint, a table: ID, name, the request that triggers it, expected status, the contract fact's origin, and **flags**: `writes`, `dangerous`, `admin` (role), `known issue`, `unconfirmed` (rests only on a `_(spec)_` fact), `optional`;
- **the steps of every scenario**, worded as they'll be written;
- what was dropped and why, and what's already covered;
- a summary and **Decisions needed**.

You approve, or say what to change: drop, merge, rename, reword, answer the decisions.

### Phase 2: the files

The **same agent** writes exactly the approved scenarios with your edits; anything it would still change is reported, not done. If you approved a new area, Claude adds it to `ids.areas` in the profile first. Then Claude runs `npm run validate:scenarios` and reports the files, IDs and flags.

## How it writes steps

- **Action steps** say what is sent: `Send GET /products/{productId} with an existing product's id.` Data is described when no literal value is known ("a unique product name", "a well-formed id that doesn't exist").
- **Read the change back:** a create, change or delete ends with a `Verify` that reads it back with a GET.
- **Checks** start with `Verify`: the status code first, then one body concern per step. Only what the contract states.
- **Setup** (creating a record first) is a step; cleanup is not (the test's `cleanup` fixture does it).
- **No secrets:** "the default user's email", never the address.

## The rules it follows

- **Never invents anything:** every scenario traces to a line of the contract; vague facts become "Decisions needed".
- **Adds only:** never changes, reorders or removes existing scenarios.
- **Writes only scenario files:** no test code, no contracts, no profile changes.
- **No live calls.**

## From test steps

```text
/write-api-scenarios-from-steps add-to-cart-cases.md
/write-api-scenarios-from-steps login-request.json login-response.json TC-7
/write-api-scenarios-from-steps ../bruno/Toolshop/Carts
```

Give it text files, request and expected-response JSON files (paired by name, such as `login-request.json` and `login-response.json`, or by what you write), a Bruno collection folder or JSON export, or paste the steps. The optional last argument is the `ref` the scenarios get. For a collection with more than about 10 requests, Claude asks which folders or requests to take.

- **One scenario per test case**, keeping your intent and order. A case with several requests (create, then read) becomes one scenario in the file of the endpoint it tests.
- **Requests** become action steps with `{param}` names; literal values stay only when they're stable (seeded data, enum values, the invalid value the case is about); record ids are described, because they change when the site re-seeds.
- **Expected responses** become `Verify` steps: the status first, then one step per field. Fields that change between runs (ids, timestamps, tokens, totals) are checked for presence or type, never by value, and the whole body is never compared. The proposal lists what it left out of the value checks and why.
- **Bruno:** `body:json` is the request, `assert` and `tests` the expected results, `auth` the role. It never opens the collection's `environments/` or `.env` files, and a token or password written inline in a request is never copied: the report says only where it was found.
- **Checked against the contract:** an endpoint missing from the contracts, or a case that expects something the contract contradicts (422 where the contract says 404), is a decision for you: a possible bug (the scenario keeps your expectation and gets a `knownIssue`) or an outdated case. Where the contract is silent, the scenario is marked `unconfirmed`.
- The proposal adds a **source map** (each of your cases and its scenarios, or why it was dropped). It adds no cases you didn't write: whole-endpoint coverage is the contract mode's job.

## Tips

- One contract area at a time keeps the proposal reviewable.
- `unconfirmed` scenarios may fail because the spec was wrong, not the API: worth a look before automating.
- Next step: review the diff of `test-scenarios/`, then [API Test Engineer](API-Test-Engineer) (`/implement-api-scenarios <file>`).

See also: [Add API Scenarios](Add-API-Scenarios#from-a-contract), [API Contract Writer](API-Contract-Writer).
