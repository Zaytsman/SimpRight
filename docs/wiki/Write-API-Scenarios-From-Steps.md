<!-- Source: docs/wiki/Write-API-Scenarios-From-Steps.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# /write-api-scenarios-from-steps

Turns **API test cases you already have** (steps in plain text, request and expected-response JSON, a Bruno collection) into **API test scenarios**: YAML files in `test-scenarios/api/<area>/`, every scenario `status: manual`, ready for [/implement-api-scenarios](Implement-API-Scenarios). It keeps your cases and checks each one against the API contracts. For whole-endpoint coverage from a contract, use [/write-api-scenarios-from-contract](Write-API-Scenarios-From-Contract).

| | |
|---|---|
| **Command** | `/write-api-scenarios-from-steps <steps \| JSON files \| Bruno collection> [ref]` |
| **Agent** | [`api-scenario-writer`](https://github.com/Zaytsman/SimpRight/blob/main/.claude/agents/api-scenario-writer.md), the same agent as `/write-api-scenarios-from-contract` |
| **Skill file** | [`.claude/skills/write-api-scenarios-from-steps/SKILL.md`](https://github.com/Zaytsman/SimpRight/blob/main/.claude/skills/write-api-scenarios-from-steps/SKILL.md) |
| **Input** | Text files or pasted steps, request and expected-response JSON files, a Bruno collection folder or JSON export |
| **Output** | `test-scenarios/api/<area>/<method>-<path>.yml` |
| **Live app** | None: it works from your files and the contracts only |
| **Checkpoint** | A proposal you approve before any file is written |

## When to use it

- You have API test cases from a test management tool, a spreadsheet, your notes or a Bruno collection, and want them automated.
- You have a request and the response you expect, and want it as a scenario.

## How to use it

```text
/write-api-scenarios-from-steps add-to-cart-cases.md
/write-api-scenarios-from-steps login-request.json login-response.json TC-7
/write-api-scenarios-from-steps ../bruno/Toolshop/Carts
```

Give it text files, request and expected-response JSON files (paired by name, such as `login-request.json` and `login-response.json`, or by what you write), a Bruno collection folder or JSON export, or paste the steps. The optional last argument is the `ref` the scenarios get (a test case or ticket ID). For a collection with more than about 10 requests, Claude asks which folders or requests to take.

## What happens

### Phase 1: the proposal (nothing is written)

The agent reads the profile, the conventions, your cases, the contracts and the existing scenarios, then turns your cases into scenarios:

- **One scenario per test case**, keeping your intent and order. A case with several requests (create, then read) becomes one scenario in the file of the endpoint it tests.
- **Requests** become action steps with `{param}` names; literal values stay only when they're stable (seeded data, enum values, the invalid value the case is about); record ids are described, because they change when the site re-seeds.
- **Expected responses** become `Verify` steps: the status first, then one step per field. Fields that change between runs (ids, timestamps, tokens, totals) are checked for presence or type, never by value, and the whole body is never compared.
- **Bruno:** `body:json` is the request, `assert` and `tests` the expected results, `auth` the role.
- **Checked against the contract:** an endpoint missing from the contracts, or a case that expects something the contract contradicts (422 where the contract says 404), is a decision for you: a possible bug (the scenario keeps your expectation and gets a `knownIssue`) or an outdated case. Where the contract is silent, the scenario is marked `unconfirmed`.
- **Existing scenarios:** a case an existing scenario already covers, or that only differs from one by its role or data, is flagged; one that contradicts an existing scenario is a decision for you.

Claude shows the proposal: per endpoint a table and the **full steps**, a **source map** (each of your cases and its scenarios, or why it was dropped), what was left out of the value checks and why, and **Decisions needed**. You approve, or say what to change.

### Phase 2: the files

The **same agent** writes exactly the approved scenarios. If you approved a new area, Claude adds it to `ids.areas` in the profile first. Then Claude runs `npm run validate:scenarios` and reports.

## What the agent never does

- **Add cases you didn't write:** whole-endpoint coverage is `/write-api-scenarios-from-contract`'s job; obvious gaps are mentioned, not written.
- **Read secrets:** it never opens a Bruno collection's `environments/` or `.env` files, and a token or password written inline in a request is never copied: the report says only where it was found.
- **Change existing scenarios**, write anything but scenario files, or call the API.

## Tips

- One test case per numbered block, with its expected result, makes the source map easy to read.
- `unconfirmed` scenarios rest on your case alone: worth a look before automating.
- Next step: review the diff of `test-scenarios/`, then [/implement-api-scenarios](Implement-API-Scenarios) `<file>`.

See also: [Add API Scenarios](Add-API-Scenarios#from-test-steps).
