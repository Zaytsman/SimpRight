# Review checklist: API

On top of `common.md`. The rules are in CLAUDE.md ("API spec style", "API layer", "API contracts") and the profile's `api.rules`; cite them there.

## Specs

- Every assertion passes `assertMessage({ request, expected, actual })`; a bare `expect` or a plain-text message is a finding.
- Requests and responses are attached with `attachJson`, never `test.info().attach`, so secrets are masked in the public reports.
- A secret (a test user's email, a password, a token) is compared as a condition (`expect(a === b, message).toBe(true)`), never with a matcher whose diff prints it.
- Happy paths go through a service; any step that checks a status code (including `200`) uses the client and asserts `response.status`.
- Clients and services come from fixtures; specs never construct them, call `fetch` or `request.get`.
- A status check also checks the body the scenario names (the error message, the field errors); a status alone where the step names a message is a weakened check.
- Records the test creates are removed with `cleanup.add(...)`, registered right after the create succeeds, not in `afterAll` or at the end of the test.
- Create and update payloads come from the area's factory, with `uniqueName` for every created record; no hand-written payload objects repeated across tests.
- A user-changing test uses a throwaway customer (`registerThrowawayCustomer` or the factory), never a shared user or the admin.
- A list check that filters by a field (brand, category) is safe next to the write specs: test-created records can appear in it (see `PRODUCT_NAME_PREFIX` in the factory).

## Clients, services, DTOs

- Client methods map 1:1 to endpoints and send through `BaseClient.executeRequest`; services parse and throw on non-2xx.
- DTOs match the contract: optional fields marked optional, no `any`.
- New clients and services are registered in the API fixtures (the profile's `api.exemplars.fixtures`).

## Contracts

- A contract fact the change tagged `_(verified)_` is one a test in the change actually checked against the live API (the status code and, where the line says so, the body). A fact the tests don't check stays `_(source)_` or `_(spec)_`.
- An endpoint a new spec calls is in its contract (CLAUDE.md "Contracts").
