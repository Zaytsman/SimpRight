# 13. Code review, October 2026

In October 2026 the whole framework was reviewed, not just a change, with three goals: the best code quality possible, no duplicated or redundant code, and test-automation best practices. This page records how the review worked, what it found and what changed, slice by slice, with the numbers.

## How the review worked

- **Scope:** the framework code (`src/`, `playwright.config.ts`), all 96 specs, the CI workflows and shell scripts, and (only to align them with the changes) the agents, skills and docs. Out of scope: the page build scripts (`scripts/*.mts`), the portal pages, the app under test, bug files and contracts.
- **Slices:** a baseline, then seven slices, each with the same routine:
  1. Read the slice and every caller of what it holds.
  2. Report numbered findings, ranked **blocker** (wrong results or a leak), **should fix** or **nit**.
  3. The user picks which to apply (every slice: all).
  4. Make **behaviour-preserving** changes.
  5. Run the typecheck, the validator and the affected specs against the live app (writes approved per slice).
  6. Commit per theme on `develop`.
- **Checklist:**
  - duplication and dead code;
  - layering (HTTP only through `BaseClient`, no logic or selectors in specs, no assertions in page objects, config only through `env.ts`);
  - test-automation practice (independence, cleanup, web-first assertions, waits for the app's signals, no vacuous checks, no timeouts as fixes, masked secrets, API over UI);
  - TypeScript precision;
  - whether the exemplars show the style the agents should copy.
- **Tooling:** one-off scans through `npx`, nothing added to `package.json`:
  - [jscpd](https://github.com/kucherenko/jscpd) for duplicates;
  - [knip](https://knip.dev) for unused exports and files;
  - for the tooling decision, ESLint and Prettier from a scratch folder.
- **Invariant:** every slice ended with the same counts as the baseline: 769 scenarios, 731 automated, 731 tests in 96 files.

## Results at a glance

| Slice | Area | Findings | Commits |
|---|---|---|---|
| 0 | Baseline: typecheck, validator, counts, jscpd, knip, greps | | |
| 1 | Core: config, utils, fixtures, globalSetup, auth | 14 (7 should fix, 7 nits) | 6 |
| 2 | API framework: clients, services, DTOs, coverage | 13 (**1 blocker**, 7 should fix, 5 nits) | 5 |
| 3 | API setup and data: fixtures, step helpers, factories, constants | 14 (8 should fix, 6 nits) + 1 design question | 6 |
| 4 | API specs: all 85 | 8 (5 should fix, 3 nits) + 2 decisions | 8 |
| 5 | UI: pages, components, flows, fixtures, 11 specs | 9 (6 should fix, 3 nits) | 2 |
| 6 | CI: 9 workflows, Dependabot, 3 shell scripts | 8 (3 should fix, 5 nits) | 2 |
| 7 | Propagate: checklists, CLAUDE.md, profile, skills, wiki, tooling | 7 (5 should fix, 2 nits) + 2 decisions | 2 |

**31 commits** in all, every finding applied.

| Measure | Before | After |
|---|---|---|
| Duplicated code (jscpd, `src` + `tests` + `.github`) | 11.5% (3,600 lines, 297 clones) | 6.9% (1,984 lines) |
| Duplicated code in the UI layer | 4.0% | 3.6% (the rest: the scenarios' own repeated steps) |
| `tests/api` | 20,910 lines | 18,778 lines |
| `src` | 8,681 lines | 8,399 lines |
| Unused locals and parameters | not checked | fail the typecheck (0 today) |
| Step titles checked against scenarios | by review only | after every CI run: 731/731 on the final run |
| Final full run (api + ui, 2026-10-18) | | 729/731. The 2 failures are the PDF tests, on the site's slow PDF queue (below) |

## Slice 1: core

| # | Finding | Change |
|---|---|---|
| 1 | `CI` read outside the config (`playwright.config.ts`, twice in `globalSetup.ts`) | `env.isCI` everywhere |
| 2 | Two separate 2-minute token margins (`TokenService`, `authState`) | One `TOKEN_EXPIRY_MARGIN_MS` |
| 3 | `src/fixtures/index.ts` re-exported about 150 names by hand | `export *` per step module; 29 names used only in their own module unexported |
| 4 | `runUser` decided "transient" by matching error text | `ApiError` with a `status` |
| 5 | `JSON.parse` without context in the shared checks (and 167 in specs) | `parseJson(request, response)`: a non-JSON body fails with the request, status and body start |
| 6 | `expectFieldMessages(response, field, request)`: an argument order unlike the other checks (75 calls) | `(request, response, field)`, like the rest |
| 7 | `parseAmount('')` returned 0 | Throws on text without digits |
| 12 | `src/ui/auth/` held visitor-state helpers and `newCustomerFixtures` | `src/ui/visitor/`, `src/ui/fixtures/newCustomerFixtures.ts` |
| nits | `Record<string, any>` for the env file, an orphaned doc comment, `expect` re-exported from 10 modules, alias vs relative imports mixed in `src`, `node:crypto` vs global `crypto` in TOTP, `redact` recomputing the secret list per string | `RawEnvFile`; fixed; removed; relative imports in `src`; one crypto source; computed once |

## Slice 2: API framework

**Blocker B1: request errors leaked the bearer token.** When a request failed without a response (a dropped connection, a timeout), `BaseClient` rethrew Playwright's error, whose call log lists every request header, `Authorization: Bearer ...` included. That text reached test errors in the published HTML report, cleanup warnings in stdout, public CI logs (the run customer's retry) and the coverage report. A local probe with a fake token confirmed it. The fix, `describeRequestError`, masks `Authorization`, `Cookie` and `Set-Cookie` lines before the error is rethrown or reported, and the probe confirmed the token no longer shows.

| # | Finding | Change |
|---|---|---|
| S1 | The QUERY-with-body branch copied in 7 clients | `BaseClient.queryBody` |
| S2 | Query strings built by hand in 9 methods (`page=`, `name[]=`, a Categories helper of its own) | `queryString(params)` |
| S3 | `{ accept, maxRedirects }` passed field by field in 4 places | `RequestOptions` with a spread |
| S4 | `BaseClient.setToken` (no caller), `config` (never read), a mutable `baseUrl`, public verb helpers, `post(path, data, query)` unlike the others | Removed; read-only; `protected`; one `(path, { data, query })` shape |
| S5 | `parseOk` parsed a 2xx body without context | Fails with the action and the body's start |
| S6 | `CartProduct` and `FavoriteProduct` repeated `Product`'s 9 fields; inline category and brand shapes | Derived from `Product`, `Category`, `Brand` |
| S7 | `PaymentMethod` defined twice | Once |
| nits | `UpdateUserResponse` unused; the 404-is-done delete ×4; the same JSDoc ×17; the coverage package name exported | Removed; `assertOkOrNotFound`; one block in `BaseClient`; private to its loader |

## Slice 3: API setup and data

| # | Finding | Change |
|---|---|---|
| S1 | Role and admin fixtures took their token once, when built; a test over 5 minutes (the PDF polls) sent an expired admin token in its cleanup | `AccessToken` can be a function; `roleToken(tokenService, role)` reads the token per request |
| S2 | `usersClient` meant "with a token" and `usersClientWithoutToken` "without", the opposite of every other area | Renamed (168 uses in about 20 files) |
| S3 | The send + request record + attach pattern copied 19 times in step modules and 54 in specs | `sendAndAttach` (`apiSteps.ts`) |
| S4 | Three page summaries, three page attachers, two "status hiding the body" checks | `pageSummary`, `describePage`, `expectStatus(…, describeBody)` |
| S5, S6 | Product create-and-cleanup in 4 versions; `takeFirstProduct` = `takeFirstProductId` | One `createProduct` with `removeIfCreated`; one helper |
| S7 | Token labels in 5 maps with different wording, plus "admin's token" inline about 80 times | One `AUTH` map in the scenarios' wording |
| S8 | 12 helpers returned a step's result through a `let` and `!` | Returned from `test.step` (18 helpers after the specs were included) |
| nits | The unknown-id ULID ×9; Brand and Category factories sharing 12 methods; UI-only helpers in the API's `productSteps.ts`; the fixture doc repeated ×10; an inline status check with a bare `JSON.parse`; an exported prefix constant | `UNKNOWN_ID`; `nameAndSlugPayloads`; moved to `src/ui/fixtures/productSetup.ts`; one doc block; shared checks; unexported |

**Design question:** keep the explicit fixture matrix (`xClient`, `xClientWithToken`, `adminXService`, ...) or replace it with one factory fixture. **Decision: keep the matrix.** The names match the scenarios' wording and show in each test's parameters. A factory would save about 300 lines but rewrite all 85 specs and the exemplars. A full API run afterwards passed every write path (669 of 671; the 2 PDF tests below).

## Slice 4: API specs

The findings cut across all areas. Newer specs (invoices, messages) already used the step helpers; older ones (products, carts, users, brands, categories) built everything inline. The specs had 161 spec-local helpers, 167 `JSON.parse` calls, 80 inline status checks, 163 token-label literals and 82 hand-built response attachments.

| # | Finding | Change |
|---|---|---|
| F1 | Step mechanics copied in every spec | A scripted pass, then manual batches: 71 `expectStatus`, 128 `parseJson`, 29 `sendAndAttach` + 52 send helpers, 118 `AUTH` labels |
| F2 | Spec-local copies of shared code (`expectStatus` ×5, `expectMessage` ×3, `sendSearch` ×4, `checkRedirect` ×2) | Removed in favour of the shared ones |
| F3 | Families of identical tests copied whole (PUT/PATCH products, cart items, message status, registration) | Templates: `checkStatusAndMessage` (about 90 tests in 37 specs), `checkRejectedBody`, `checkValidationRedirect`, `checkRejectedRegistration` (14), `checkInvalidProductChange`, `checkUnknownRef`, `checkRejectedQuantity`, ... |
| F4 | "Every item" loops that passed on an empty response list | `expectSomeItems` before 23 of them |
| F5 | The redirect's Location hard-coded as the TEST environment's URL in 2 specs | Compared with `config.apiBaseUrl` |
| nits | `body.success` checked inline ×6; the test-product name check copied; QUERY setup copied between two specs | `expectSuccess`; `ProductFactory.isTestProduct`; `sendQueryAndAttach`, `JSON_QUERY_HEADERS` |

**Decisions:**

- **D1, templates:** families of three or more scenarios that differ only in data go through one template that takes the step titles and the data; every other step is a one-line call to a shared helper. Each test keeps its own literal `test()` with its verbatim title, because the validator finds titles that way. Families whose checks differ keep their own steps.
- **D2, how to make the changes:** the mechanical part as one scripted pass over all specs, the rest by hand per batch.

After every batch, a step-title check compared each test's steps with its scenario (0 mismatches), and a full API run passed (669/669 without the PDF tests).

## Slice 5: UI

| # | Finding | Change |
|---|---|---|
| 1 | Price getters used `Number(...)`, so an unrendered price read as 0: UI-017 could pass as 0 = 3 × 0, and the sorting checks too | `parseAmount` |
| 2 | `createProductInStock` was a `test.step` that no scenario has, for UI-002's precondition | Setup code with a `Setup:` error |
| 3 | The cart fixtures opened `/`, then `CartPage.open()` loaded it again (12 tests); `ShoppingFlow.goToCart` duplicated it | `open()` loads `/` only when no app page is open; `goToCart` removed |
| 4 | `CartPage.open()` couldn't tell "the cart didn't load" from "it rendered slowly" | It waits for `GET /carts/{id}` and fails with what happened |
| 5 | Five hand-written network-wait predicates | `waitForApiResponse(page, method, path, matches?)` |
| 6 | Repeated checks in specs | Spec-local check functions ([7](07-ui-specs.md#changed-in-the-review)) |
| nits | Dead code (`addProductToCart`, `NavBar.openHome`/`openSignIn`, `ProductGrid.noResults`, the `loginPage` fixture, an exported token key, a favourites cleanup of a brand-new customer); `BaseDialog` not a component and with an unused `config`; toasts per page, a product lookup ×2, customer registration ×2 | Removed; `BaseDialog extends BaseComponent`; `BasePage.toast`, `findProductByName`, `registerCustomerForTest` |

The first triple run of the cart specs found two more problems. UI-055 lost a click on the cart link made right after a fresh page load: this was the cause of the old "cart never rendered" flake. UI-050 got the cart's `GET` answer only after the 10-second wait. `CartPage.open()` now waits for the home page to load first and reports a missing answer clearly. After that the cart specs passed three times in a row (51/51), and the whole UI project passed (60/60).

## Slice 6: CI

| # | Finding | Change |
|---|---|---|
| S1 | `actions/checkout` left the `contents: write` token in `.git/config` for the whole job, readable by every npm package and the tests (and `develop` only blocks force pushes) | `persist-credentials: false`; `GH_TOKEN` only in the publish steps; `npm ci --ignore-scripts` |
| S2 | 11 actions on moving tags | Pinned to the commits of their current releases, with version comments |
| S3 | Nightlies at :00, against the project's own advice (re-seed, GitHub's busiest minute); recent runs started 4.5–8 hours late | :15 |
| nits | `secrets: inherit` ×5; inputs pasted into shell code; `verify` installing a package nothing there loads; redundant `chmod +x`; the portal copy ×2; fetch errors mistaken for "no gh-pages branch"; an unknown script argument ignored; no Dependabot cooldown | Named secrets; `env:`; no package token or `packages: read` in `verify`; removed; in `ghp_publish`; `git ls-remote --exit-code`; fails with the usage; 7 days |

Checked locally: the publish scripts against a bare repository (first publish, normal publish, a bad argument, an unreachable origin), a fork install without a token (npm skips the private package after the 401, and the typecheck and validator pass), and a rule check over all workflows. On CI: a manual run on `develop` installed, tested and pushed to gh-pages with the new token handling.

## Slice 7: propagate

The sweep found no references to removed code. The gaps were in what the agents are told to reuse ([12](12-ai-agents.md#changed-in-the-review)):

- **The profile** had no exemplar for `apiChecks.ts` or `apiSteps.ts`, so the API engineer never read them. This was the root of the spec-local helpers. Added as `checks` and `steps`, with a reuse rule.
- **The review checklists, `CLAUDE.md`, the four code-writing skills and the wiki** now name the rules the slices set. This includes the wiki's sample API spec, which showed the style from before the review.
- **The API exemplar** spec now uses its own send helper everywhere.
- **8 non-null assertions** that TypeScript already narrows were removed. A one-off lint scan flagged 9, but TypeScript 7 still needs one inside a closure.

**Tooling decision:**

- **Kept:** `noUnusedLocals` and `noUnusedParameters` are now on (0 findings).
- **No ESLint for now.** A typed scan found no unawaited or misused promises and no `any`. 468 of its 515 hits were false positives: the checks sit in shared helpers the rule doesn't see. Also, `typescript-eslint` supports TypeScript only below 6.1.
- **No Prettier for now:** it would reformat 122 of the 209 files.
- **Revisit** ESLint when `typescript-eslint` supports TypeScript 7.

**Step-title check:** it became [`scripts/check-step-titles.mts`](../../scripts/check-step-titles.mts). CI runs it after every test run and warns without failing the job, because a wrong title is a naming defect, not an app failure.

## Checked and left as they are

- The explicit API fixture matrix (slice 3 decision).
- Per-endpoint `{ success }` / `{ message }` / `{ error }` DTOs: they follow the contracts, which can diverge.
- Families whose checks differ, not only their data (product filters, cart deletes, invoice PATCH read-backs, postcode lookups).
- `ProductFilters.checkBrand` waits only for the marker; the app sets `filter_started` synchronously, so there's no race.
- The two custom-run workflows (GitHub can't share inputs between workflows; one per layer keeps the area menu valid).
- The browser cache in CI (3 s to restore, 13 s to install on a hit).

## Open after the review

- **The PDF tests (API-0468, API-0471)** failed on the day of the review: the site's PDF queue kept the invoice status at INITIATED through the whole 210-second poll, and the download answered 404. It's an environment problem, not a code change, and it's left for `/heal-tests` (a longer poll budget; the role tokens are already read per request).
- **36 token labels** are still passed as plain strings (`'none'`, `'invalid token'`) into spec-local send helpers in about 10 specs. Slice 4's `AUTH` pass covered request records but not these call arguments.
- The page builds write a `generatedAt` timestamp, so every Test Cases publish commits even when nothing changed (in `scripts/*.mts`, out of the review's scope).
- A validator check that the custom workflows' `area` options match the test folders (today a "keep in sync" comment).
- The repository setting "Require actions to be pinned to a full-length commit SHA" can now be turned on.

## The commits

| Slice | Commits |
|---|---|
| 1 | `61703ad` CI through the config, typed env file · `134c979` one token margin · `911aa91` `export *`, unused exports · `b044c09` `ApiError` status, `parseJson` · `6db2089` small shared helpers · `bf6c738` visitor-state moves |
| 2 | `59f2e47` **masked credential headers** · `29b4dbf` query-string and QUERY-body helpers · `4dc1385` `parseOk` context, 404-is-done · `00f3777` derived DTO shapes · `b9b0b9b` coverage package name private |
| 3 | `ff2f820` tokens per request · `50db5cc` users fixtures naming · `830af6b` send-and-attach, page summaries, `AUTH` · `2cdd4f6` one product create · `5f6e3bb` step results from `test.step` · `0527da4` shared payload builders, `UNKNOWN_ID` |
| 4 | `1ab081d` shared step helpers in the specs · `a6de507` product templates · `7fb02a4` every-item guards · `ef8cb57` users templates · `d190d14` redirect check, carts template · `bbd9169` brands, categories, messages templates · `a068c15` reports access template · `2c935fe` status-and-message template |
| 5 | `3cd2bb9` page objects: prices, waits, opening the cart · `9f478df` setup out of steps, shared checks |
| 6 | `9579581` CI hardening · `e04eac5` nightlies off the full hour |
| 7 | `1d4f05a` unused-code checks, needless `!` · `147e8af` step-title check, docs and agents aligned |
