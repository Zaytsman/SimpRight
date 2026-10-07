<!-- Source: docs/wiki/API-Scenario-Writer.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# API Scenario Writer

Proposes and writes **API test scenarios** from an API contract: one YAML file per endpoint in `test-scenarios/api/<area>/`, every scenario `status: manual`, ready for the [API Test Engineer](API-Test-Engineer).

| | |
|---|---|
| **Command** | `/write-api-scenarios <contract> [endpoint ...]` |
| **Agent** | `api-scenario-writer` (`.claude/agents/api-scenario-writer.md`) |
| **Skill** | `write-api-scenarios` (`.claude/skills/write-api-scenarios/SKILL.md`) |
| **Input** | A contract in `docs/api/contracts/` |
| **Output** | `test-scenarios/api/<area>/<method>-<path>.yml` |
| **Live app** | None: it works from documents only |
| **Checkpoint** | A proposal you approve before any file is written |

## When to use it

- A new contract was written, or an existing one gained endpoints.
- The coverage report shows documented status codes no test covers yet.

## How to use it

```text
/write-api-scenarios Users_API.md
/write-api-scenarios users
/write-api-scenarios Users_API.md POST /users/login GET /users/me
/write-api-scenarios Products_API.md /products/{productId}
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

## Tips

- One contract area at a time keeps the proposal reviewable.
- `unconfirmed` scenarios may fail because the spec was wrong, not the API: worth a look before automating.
- Next step: review the diff of `test-scenarios/`, then [API Test Engineer](API-Test-Engineer) (`/implement-api-scenarios <file>`).

See also: [Generate Scenarios](Generate-Scenarios#api-scenarios), [API Contract Writer](API-Contract-Writer).
