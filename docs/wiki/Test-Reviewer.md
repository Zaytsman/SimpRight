<!-- Source: docs/wiki/Test-Reviewer.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# Test Reviewer

Reviews **automated tests** of both layers, and the page objects, flows, fixtures, clients, services and test data they use, the way a senior test engineer reviews a pull request: against their scenarios and the project's conventions. It only reads and reports; Claude applies the findings you pick.

| | |
|---|---|
| **Command** | `/review-tests [spec \| scenario file \| IDs \| area \| commit \| range]` |
| **Agent** | `test-reviewer` (`.claude/agents/test-reviewer.md`) |
| **Skill** | `review-tests` (`.claude/skills/review-tests/`), with three checklists in `references/` |
| **Input** | By default the work not pushed yet; or the files a target maps to |
| **Output** | Findings ranked Blocker / Should fix / Nit, then the fixes you pick, applied and re-run |
| **Live app** | None: the reviewer never runs tests or the inspector |
| **Checkpoint** | You pick which findings to apply |

## When to use it

- After `/implement-api-scenarios` or `/implement-ui-scenarios`, before committing.
- Before pushing your own test changes, or on a commit someone else made.

## How to use it

```text
/review-tests
/review-tests product-detail.spec.ts
/review-tests product-detail.yml
/review-tests UI-013..017
/review-tests products
/review-tests 055e6d4
/review-tests abc123..def456
```

| Target | What gets reviewed |
|---|---|
| none | Uncommitted changes plus the commits the branch's upstream doesn't have |
| a commit or range | The files it touches |
| a spec, scenario file, IDs or area | The spec files they map to (only `automated` scenarios have tests) |

Only test code is reviewed: specs and what they use under `src/`, plus the scenario files. Docs, contracts, workflows and `.claude/` are left out (and Claude says so). More than about 15 files or 30 tests makes a review shallow, so Claude suggests one area or commit at a time.

## What happens

1. **Target:** Claude works out the files and their layer (`ui`, `api`, `shared`) and picks the checklists.
2. **Review:** the agent reads the profile, the conventions, the checklists, the change, every file in scope in full, each spec's scenario, and everything the tests use. It runs the typecheck and the scenario validator (their errors become blockers), then goes through the checklists item by item, walking each test's steps side by side with its scenario. It re-checks every finding against the code before reporting.
3. **Findings:** Claude checks each blocker against the code itself and drops any that don't hold, saying why. Then you pick: by number, "all blockers", "all" or "none". A finding that changes what a test checks, or a shared member other tests use, needs an explicit yes.
4. **Fixes:** Claude applies them in the project's style (never changing scenario steps), runs the typecheck and validator, runs the touched specs (and repeats them when a wait or locator changed; specs that write data only if their writes were approved), and reports.

## The report

```
## Review: <target>, <n> files, <m> tests
Static checks: typecheck passed, validator passed

### Blockers
1. **<title>** — `src/ui/pages/ProductPage.ts:45` (UI-013)
   Code: <the line>
   Problem: <what goes wrong, and when>
   Rule: <where it's written, or "correctness">
   Fix: <the concrete change>
### Should fix
### Nits
### Checked and fine
### Questions
```

| Severity | Means |
|---|---|
| **Blocker** | The test can pass while the scenario's check fails (missing, weakened or vacuous assertion, a step not done); it will fail or flake on a correct app (a race, shared data, a value the re-seed changes); it writes data without approval or cleanup; it can leak a secret; typecheck or validator fail |
| **Should fix** | Breaks a written convention without making the test wrong today: a selector in a spec, an assertion without a message, an unregistered page object |
| **Nit** | Naming, comments, small duplication; at most 5 |

**Checked and fine** says what was verified per category, so you know what the review covered. **Questions** holds scenario steps the reviewer thinks are wrong or ambiguous: the scenario is your call, not a finding against the test.

## The checklists

| File | Covers |
|---|---|
| `references/common.md` | Both layers, in six parts: the test matches its scenario (every step verbatim; a named value is compared; "every" covers every item; an empty list can't pass), assertions, stability (waits, races, shared data), test data, live app safety (approved writes, cleanup, secrets), shared code |
| `references/ui.md` | UI: specs (no selectors, fixtures, messages), page objects, components and dialogs (private locators and getters, locator priority, waits for the app's signal), data |
| `references/api.md` | API: specs (client vs service, `assertMessage`, `attachJson`, status codes, cleanup), clients, services and DTOs, contracts |

They point to the rules in CLAUDE.md and the profile; a finding cites the rule where it's written.

## The rules it follows

- **Read-only:** never edits, creates or deletes files, never commits. It runs only `git diff/show/log/blame`, the typecheck and the validator; **never tests or the inspector** (specs may write to the live app).
- **Evidence, not taste:** every finding has a file and line, the code, what goes wrong and when, and the rule. A preference with no consequence and no written rule isn't a finding.
- **Reviews the change, reads the context:** problems in unchanged code are reported only when the change depends on them, marked "existing code".
- **The scenario is the specification**; **approved readings stand** (a `// Approved reading:` comment records your decision); it doesn't repeat what the tools already check; no secrets.

## Tips

- Keeping the reviewer separate from the engineer is deliberate: it judges the tests without having written them.
- Next: commit, open a pull request; if CI fails, [Test Healer](Test-Healer).

See also: [API Automation](API-Automation#5-review-commit-ci), [UI Automation](UI-Automation#6-review-commit-ci).
