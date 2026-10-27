# 9. Scenarios, bugs and validation

SimpRight is **scenario-driven**: every test comes from a YAML scenario, every known failure from a bug file, and a validator keeps the three (scenarios, specs, bugs) in step. Agents write the scenarios and the specs ([12](12-ai-agents.md)); the validator and the step-title check catch what drifts.

```
docs/api/contracts/  docs/ui/user-stories/          the inputs
        │                    │
        ▼                    ▼
test-scenarios/<layer>/<area>/<name>.yml  ──────────► tests/<layer>/<area>/<name>.spec.ts
        │  knownIssue + bug                                 test.fail(true, 'Known issue BUG-0xx: ...')
        ▼
bugs/BUG-0xx.yml
        all three checked by:  npm run validate:scenarios    (static, also in the PR check)
        step titles checked by: npm run check:step-titles    (after a run, on CI after every run)
```

## Scenario files

[`test-scenarios/`](../../test-scenarios/), validated by [`scenarios.schema.json`](../../test-scenarios/scenarios.schema.json):

```yaml
# yaml-language-server: $schema=../../scenarios.schema.json
suite: Product search
tags: ["@products"]
scenarios:
  - id: UI-001
    name: Search by name shows only matching products
    ref: docs/ui/user-stories/Product_Overview.md#AC4
    tags: ["@smoke"]
    status: automated
    automatedIn: tests/ui/products/product-search.spec.ts
    preconditions:
      - The home page is open.
    steps:
      - Search for "pliers".
      - 'Verify the caption reads "Searched for: pliers".'
      - Verify every product name contains "pliers" (case-insensitive).
```

| Part | Rule |
|---|---|
| Location | `test-scenarios/<layer>/<area>/<name>.yml`, the same folders as the spec. API: one file per endpoint, `<method>-<path>.yml` (`get-products-by-product-id.yml`); UI: named after the spec |
| File keys | `suite`, `tags` (at least one: `@<area>` for UI, `@<area>-api` for API), `scenarios` |
| Scenario keys, in order | `id`, `name`, `ref`, `tags`, `status`, `automatedIn`, `role`, `knownIssue`, `bug`, `preconditions`, `steps` |
| IDs | `API-0001` (4 digits), `UI-001` (3 digits), numbered across the whole layer; the validator prints the next free one |
| `status` | `manual` for a new scenario; `automated` together with `automatedIn` (the spec path) |
| `role` | One of the profile's roles; absent = the run's customer; `guest` = logged out |
| `preconditions` (UI) | Statements, not actions: "A product that is in stock is in the cart." |
| `steps` | Start with the first user action. Checks are steps that start with `Verify`, in the order they happen; every scenario has at least one. No secret values ("the default user's email", never the address) |

## Bug files

[`bugs/`](../../bugs/), one `<ID>.yml` per **root cause**, validated by [`bug.schema.json`](../../bugs/bug.schema.json): `id`, `title`, `status` (`open`, `fixed`, `wont-fix`), `severity`, `layer`, `area`, `affects` (endpoints or pages), `found`, `resolved` (exactly when not open), `ref`, `upstream`, `description`, `steps`, `expected`, `actual`, `evidence`.

The lifecycle:

1. A scenario that hits a bug gets `knownIssue` (one sentence naming the wrong behaviour) and `bug: BUG-0xx`; several scenarios with the same cause share one bug.
2. Its test gets `test.fail(true, 'Known issue BUG-0xx: <the same sentence>')` right before its first `test.step`, after setup. The test passes while the bug is there, and **fails when the bug is fixed**, which is the signal to re-check.
3. When the bug is fixed: `status: fixed` with `resolved`, and the `knownIssue`, `bug` and `test.fail` line are removed from every scenario and test. `/report-bug recheck` does this.

Bug files are published (the Bugs page), so they never hold secret values.

## The project profile

[`simpright.yml`](../../simpright.yml) (schema: [`simpright.schema.json`](../../simpright.schema.json)) is the project config that the agents and scripts read; tests never read it (their config is `src/envs/<ENV>.json` and `.env`, [2](02-configuration.md)). It holds paths, commands (`runSpec`, `inspectUi`, ...), ID prefixes and digits, the area folders, file-name patterns, roles, the exemplar files per layer (the `api` and `ui` sections, each optional), the known-issue snippet, agent-critical rules, and live-app guardrails (`liveApi.writes: ask`, the dangerous actions, the app's known transient problems). Five sections describe the framework's parts: `parts` (the optional parts in use), `core` (the framework's core files and the seams they may import, [1](01-architecture.md#the-core-and-the-app)), `ci` (the workflows' Node version and secret names), `runs` (one entry per test run, [11](11-ci-and-publishing.md#the-runs-in-simprightyml)) and `portal` (the portal's text and health thresholds, which the portal pages show). It points to the conventions (`project.conventions`: `CLAUDE.md` and [`conventions.md`](conventions.md)) instead of repeating them. More in [12](12-ai-agents.md).

## The validator: `npm run validate:scenarios`

[`scripts/validate-scenarios.mts`](../../scripts/validate-scenarios.mts) is static: it reads files and runs no tests. It runs locally, in the PR check (`verify`) and before every Test Cases publish. It checks that:

- the profile matches its schema, and every path it names exists;
- every run in `runs` matches its caller of `playwright-run.yml`, an area picker's options are the test folders, and the secrets and Node version match `ci` ([11](11-ci-and-publishing.md#the-runs-in-simprightyml));
- every core file and seam in `core` exists, and a core code file imports only core files, the seams and packages ([1](01-architecture.md#the-core-and-the-app)); a document such as the conventions isn't scanned;
- every bug file is `bugs/<ID>.yml`, matches the bug schema, keeps the key order, and has a `resolved` date exactly when it isn't open;
- every scenario file is in `<layer>/<area>/` with a valid file name, matches the schema, and keeps the key order;
- IDs are unique and well-formed; roles are known; a `knownIssue` comes with an open bug, and a bug with a `knownIssue`;
- a `@smoke` scenario is automated, has no known issue, and its test's tag option matches;
- `automatedIn` exists and is named after the scenario file, and the spec has the `// Scenarios:` comment, the describe `'<tags> - <suite>'`, a test titled `'<ID>: <name>'` verbatim, and the known-issue line with the right bug and text;
- every test in `tests/` has an ID with a scenario automated in that spec.

It ends with the counts (`Runs OK: 5 run(s), each with its workflow.`, `Core OK: 21 file(s), importing only each other, 2 seam(s) and packages.`) and the next free IDs: `Next free IDs: UI-099, API-0672, BUG-052`.

**It finds titles as literal `test('<ID>: <name>'` calls**, which is why tests are never generated in a loop and templates are called from one `test()` per scenario ([5](05-api-specs.md#templates-tests-that-differ-only-in-data)).

## The step-title check: `npm run check:step-titles`

Step titles are often template parameters, so only a run shows them. [`scripts/check-step-titles.mts`](../../scripts/check-step-titles.mts) reads a Playwright JSON report (default `test-results/results.json`, which CI writes) and compares each test's top-level `test.step` titles with its scenario's steps, verbatim and in order. A failed or skipped test is compared only up to the step it reached.

- Locally: `PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/results.json npx playwright test --reporter=list,json`, then `npm run check:step-titles`. It exits with 1 on a mismatch.
- On CI: a step after the tests in `playwright-run.yml` adds a warning annotation on the spec for each mismatch. It doesn't fail the job, because a wrong title is a naming defect, not an app failure.

## The smoke set

The scenarios tagged `@smoke` (25 today: 16 API, 9 UI): critical happy paths only, automated, no known issue, only writes the test cleans up itself (so no invoices or messages), fast and stable. The user picks the set; agents remove `@smoke` only together with a new known issue. `npm run test:smoke` runs it locally (`--grep @smoke`, both projects), and `smoke-tests.yml` on CI by hand (about 2–3 minutes).

## Pages built from the files

- **Test Cases pages** (`npm run test-cases:build`): a browsable catalog per layer, a tree by area and file, with search, status and known-issue filters, steps, the YAML, and links to the spec line and the user story.
- **Bugs page** (`npm run bugs:build`): every bug with its linked tests and their latest regression result. An open bug whose known-issue test passed is flagged for a re-check.

Both are published from `main` ([11](11-ci-and-publishing.md)).

## The page inspector

`npm run inspect:ui -- <path> [--role <role> | --logged-out] [--then <step> ...]` opens a page as a role and prints every `data-test` element (role, label or text, field limits, visibility) and the accessibility tree, masked like the reports. Steps are `click:<data-test>`, `check:<label>` and `select:<data-test>=<option>`, which only change what the page shows. It's read-only: it never types or submits. The UI agents use it so scenarios and locators use the real labels.

## Changed in the review

- New: `scripts/check-step-titles.mts`, `npm run check:step-titles`, and the CI step that warns about mismatches. During the review, an earlier version of this check confirmed after each slice that no step title had drifted. On the final full run, all 731 tests matched.
- The profile names the shared API helpers as exemplars (`checks`: `src/utils/apiChecks.ts`, `steps`: `src/api/fixtures/apiSteps.ts`; two new optional keys in the schema), with a rule to reuse them.
- The UI rules in the profile name `waitForApiResponse`, `parseAmount` and the UI setup helpers; the Cloudflare note describes `CartPage.open()` as it is now.

Details: [13. Code review, October 2026](13-code-review-2026-10.md).
