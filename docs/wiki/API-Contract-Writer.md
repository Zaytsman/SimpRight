<!-- Source: docs/wiki/API-Contract-Writer.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# API Contract Writer

Writes and updates the **API contracts**: one markdown file per API area in `docs/api/contracts/`, describing every endpoint, its parameters, body, responses and error status codes. Contracts are where API testing starts: the [API Scenario Writer](API-Scenario-Writer) turns them into scenarios, and the optional coverage report measures the tests against them.

| | |
|---|---|
| **Command** | `/write-api-contracts [update] [source path] [spec file or URL] [areas]` |
| **Agent** | `api-contract-writer` (`.claude/agents/api-contract-writer.md`) |
| **Skill** | `write-api-contracts` (`.claude/skills/write-api-contracts/`), with reference guides and a helper script |
| **Input** | The API's source code, its OpenAPI spec, or both |
| **Output** | `docs/api/contracts/<Area>_API.md` |
| **Live app** | Only if you allow it: read-only checks by default, writes only on an explicit yes |
| **Checkpoint** | Before it starts (inputs, mode, live checks); you review the diff afterwards |

## When to use it

- A new API area needs testing and has no contract yet.
- The API changed (endpoints added, removed or changed): run it in `update` mode.
- You want existing facts checked against the running API (`_(verified)_`).

## How to use it

```text
/write-api-contracts ../practice-software-testing/sprint5/API carts
/write-api-contracts ../practice-software-testing/sprint5/API ./openapi.json products users
/write-api-contracts update ../practice-software-testing/sprint5/API products
```

| Argument | Meaning |
|---|---|
| `update` | Sync existing contracts with a changed API. Without it the mode is `create`: write missing contracts and fill gaps, **never remove** anything |
| source path | A checkout of the API's source code (the best evidence of real behaviour) |
| spec file or URL | An OpenAPI spec (gives the structure; often incomplete) |
| areas | The API areas to document, such as `products users`. Default: all |

At least one input (source or spec) is required. Claude works out the rest from the project, and asks in one question what it couldn't settle. It always asks whether **live checks** are allowed (it recommends read-only checks against a test environment). For an update with a spec, it can first show what changed in seconds, before any agent starts.

## What happens

1. **Brief:** Claude settles the mode, inputs, areas, base URL and live-check permission, and checks that the contract commands from the optional coverage package can run. Without the package, the agent can still write from source, but can't convert a spec or validate its work.
2. **The agent works**, in its own context so a large codebase doesn't fill the conversation. For a big API (more than about six areas), Claude starts several agents in parallel, each with its own areas.
   - **Lists the endpoints** per area: from the spec (converted to a draft by the package), from the source's routes, or both, comparing them.
   - **Collects the facts** per endpoint: auth, parameters, body, success response, every error status and its trigger, and the data a caller needs first (tokens, ids, unique values).
   - **Checks against the running API**, if allowed. What it observes wins over the sources, and the contradiction is reported.
   - **Writes the contract** in the exact format the coverage parser reads ([CONTRACT_FORMAT.md](https://github.com/Zaytsman/SimpRight/blob/main/docs/api/CONTRACT_FORMAT.md)).
   - **Validates** it with the package's validator.
3. **Report:** Claude runs the validator again and tells you the files, the endpoint counts, how many status codes are verified / from source / spec only, and the findings: spec vs code disagreements, suspected bugs, what couldn't be determined. After an update it leads with the change log: endpoints added, removed and changed, and verified facts that need re-checking.

## Origin tags

Every fact carries where it came from, in this order of trust:

| Tag | Meaning |
|---|---|
| `_(verified)_` | Observed against the running API. Changed only after checking again |
| `_(source)_` | Read in the source code |
| `_(spec)_` | Only in the OpenAPI spec |

When source and spec disagree, the source wins for behaviour. The test engineers later upgrade facts to `_(verified)_` when a passing test asserts them exactly.

## The rules it follows

- **Never invents anything.** Every endpoint, field, status code and auth rule traces to a route, a validation rule, a handler, the spec or a live response. Ambiguities are written down, not guessed.
- **Measures what's real.** A status code is documented under an endpoint only when that endpoint can return it. Framework-wide codes go once in "Error Handling"; a `500` is listed only when a client can trigger it reliably, marked as a suspected bug.
- **Read-only outside the contract folder.** It never changes the API's source or spec, and writes no tests, scenarios or profile changes.
- **No secrets.** It never opens `.env`. A token for live checks comes only from an environment variable you name, never echoed.
- **Guardrails:** calls in the profile's `liveApi.dangerous` (failed logins that lock an account) are never made, whatever the brief allows.

## The skill and its files

| File | Role |
|---|---|
| `write-api-contracts/SKILL.md` | The command: settles the brief, starts the agent(s), validates and reports |
| `references/from-openapi.md` | How to convert a spec into a draft and correct it |
| `references/from-source.md` | Where each fact lives in source code, and how to read it systematically |
| `references/live-checks.md` | Which live calls are safe and how to record what they show |
| `references/updating.md` | Update mode: find what changed, apply only that, keep a change log |
| `scripts/shape.js` | Prints the shape of a JSON response (keys and types, never values), so live data isn't copied into contracts |

The contract commands (`validate`, `diff`, `from-openapi`) come from the optional coverage package; the profile's `commands.validateContracts`, `diffContracts` and `contractsFromOpenApi` name them.

## Tips

- Give it **both** source and spec when you can: the spec gives the shape, the source the real behaviour.
- Review the diff of `docs/api/contracts/` before writing scenarios: a wrong contract leads to tests that fail for the wrong reason.
- Next step: [API Scenario Writer](API-Scenario-Writer) (`/write-api-scenarios <contract>`).

See also: [Generate Scenarios](Generate-Scenarios#api-scenarios).
