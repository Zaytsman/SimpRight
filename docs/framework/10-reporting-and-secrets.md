# 10. Reporting and secrets

SimpRight's reports are **public**: every CI run publishes its HTML report to GitHub Pages, and CI logs of a public repository can be read by anyone. So the framework treats everything that can reach a report or a log (assertion messages, attachments, errors, warnings) as published, and masks secrets before they get there.

## What a run produces

| Output | Where | When |
|---|---|---|
| List output | the console | always |
| HTML report | `playwright-report/` | always (opens on failure locally) |
| JUnit | `test-results/junit.xml` | CI |
| JSON | `test-results/results.json` | CI: the portal's trends and known issues, and the step-title check |
| Screenshots, videos | `test-results/<test>/`, in the report | UI failures only |
| API coverage | `test-results/api-coverage/` (`index.html`, `summary.json`) | when the optional package is installed and `DISABLE_API_COVERAGE` isn't set |
| Traces | **never** | `trace: 'off'` for every project (below) |

## What a failure says

**API assertions** pass `assertMessage({ request, expected, actual })` ([`src/utils/assertHelpers.ts`](../../src/utils/assertHelpers.ts)):

```
[Request] {"method":"GET","path":"/invoices/INV-2026000035/download-pdf-status","auth":"the new user's access_token"}
[Expected] status is "COMPLETED"
[Actual] { "status": "INITIATED" }
```

The request record says what was sent and with which token (in the scenarios' words, [5](05-api-specs.md#sending-sendandattach-and-request-records)); `expected` says the check in words; `actual` shows the value or the relevant part of the body. The shared checks (`expectStatus`, `parseJson`, ...) build their messages the same way, so a status failure shows the start of the body, and a body that isn't JSON shows the status and the body's start instead of a bare `SyntaxError`.

**UI assertions** carry a plain-text message saying what is checked: `expect(homePage.searchCaption, 'The caption names the search term')`.

**Setup failures** start with `Setup:` (UI) or come from a service's `ApiError` (`Failed to create product "...": 500 ...`), so a broken setup reads differently from a failed check.

## Attachments

Every API step attaches what it sent and what came back, so a reader can follow the test in the HTML report:

- `sendAndAttach(name, request, call)` attaches "<name> Request" and "<name> Response" (status and body; `withHeaders` adds the headers).
- `attachJson(name, data)` attaches anything else as pretty JSON.
- A page that may list other visitors (an admin's list of users, invoices or messages) is attached as a **summary** (`describePage`, `pageSummary`): pagination fields and a reduced view of each item, never other people's names, emails or addresses.

Both go through `redact` (below). Specs never call `test.info().attach` directly.

## Masking

`redact(value)` returns a masked copy of anything that goes into a message or an attachment:

- **Secret keys**, at any depth and in any case: `password`, `current_password`, `new_password`, `new_password_confirmation`, `access_token`, `token`, `authorization`, `totp_secret`, `totp` (`SECRET_KEYS`). Their values become `***`.
- **Secret values**: the configured users' emails and passwords and the run's customer's, wherever they appear in a string. Read on each call, because the run's customer exists only after `globalSetup`.
- **JSON in strings**: a raw response body is parsed first, so its keys are masked too.

What masking can't cover, and how the framework handles it:

| Leak path | Handling |
|---|---|
| A matcher's own diff (`expect(email).toBe(user.username)` prints both) | Compare secrets as a condition: `expect(a === b, message).toBe(true)` |
| Playwright's call log in a failed request's error (it lists the `Authorization` header) | `BaseClient` masks credential headers in the error before rethrowing it ([4](04-api-layer.md)) |
| Traces (every request and response, unmasked: login bodies, tokens, other visitors' data) | `trace: 'off'` for every project; don't turn it back on |
| The saved UI logins (`.auth/<role>.json` holds a live JWT) | Git-ignored, never published |
| Resolved config (passwords) | Kept in memory only, never written to disk |
| CI logs | GitHub masks secrets it injects; the framework never prints credentials or the run's customer's password |
| Bug files and scenarios (published as pages) | Never hold secret values: "the default user's email", not the address |

## The portal

[`index.html`](../../index.html) is the Automation Portal on GitHub Pages. It reads the published manifests and `results.json` files and shows run history and trends, known issues (tests with a `Known issue` annotation, linked to their bug), the API coverage when it exists, and buttons to the Test Cases and Bugs pages. See [11](11-ci-and-publishing.md) and the wiki's [Automation Portal](../wiki/Automation-Portal.md) page.

## Changed in the review

- **Blocker fixed:** when a request failed without a response, Playwright's error included the full request headers, so the bearer token reached test errors in the published report, cleanup warnings, public CI logs (the run customer's retry) and the coverage report. `describeRequestError` now masks the credential headers.
- `redact` computes the list of secret values once per call, instead of once per string.
- Bodies are parsed with `parseJson`, so a non-JSON answer (an HTML error page, Cloudflare's check) fails with the request, the status and the body's start.
- `expectStatus(…, describeBody)` lets a page that may list other visitors show a summary, or nothing, in a status failure.
- An orphaned doc comment in `apiChecks.ts` (and similar ones in `reportSteps.ts` and `totp.ts`) was fixed.

Details: [13. Code review, October 2026](13-code-review-2026-10.md).
