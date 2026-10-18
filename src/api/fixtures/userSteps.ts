import { test, expect } from '@playwright/test';
import type { Cleanup } from '../../fixtures/base';
import type { TestUser } from '../../config/env';
import type { AuthClient } from '../clients/AuthClient';
import type { ApiResponse } from '../clients/BaseClient';
import type { UsersClient } from '../clients/UsersClient';
import type { LoginResponse } from '../dto/auth';
import type { Paginated } from '../dto/common';
import type { RegisterUserRequest, User } from '../dto/user';
import type { AuthService } from '../services/AuthService';
import type { UsersService } from '../services/UsersService';
import { UserFactory } from '../../data/factories/UserFactory';
import { PAGE_KEYS, expectSomeItems, expectStatus, expectStatusAndBody, parseJson } from '../../utils/apiChecks';
import { describePage, pageSummary, sendAndAttach, type DescribeResponse } from './apiSteps';
import { assertMessage, attachJson } from '../../utils/assertHelpers';

/**
 * Steps shared by the Users specs that need a throwaway customer (never the run's customer or the admin).
 * The title is the scenario step verbatim; every scenario file uses the same wording.
 */
const USER_REGISTER_STEP =
  "Send POST /users/register with a unique email, a first name, a last name and a random strong password, and take the new user's id.";

/** A customer a test registered for itself, with the credentials it was registered with. */
export interface ThrowawayCustomer {
  id: string;
  email: string;
  password: string;
}

/**
 * The register step, with its title verbatim: registers a throwaway customer (no token) and right away
 * registers its removal as admin (DELETE /users/{userId} is admin-only). Returns its id and credentials.
 * `options.title` and `options.body` serve scenarios whose register step asks for other values (default:
 * USER_REGISTER_STEP and `UserFactory.registerCustomer()`). `options.ifExists` is for tests that delete the customer
 * themselves: cleanup then deletes it only if it still exists (`UsersService.deleteIfExists`). `options.mayHoldInvoices`
 * is for customers that may get an invoice (which blocks the delete with 409): cleanup then uses
 * `UsersService.deleteUnlessInUse`.
 */
export async function registerThrowawayCustomer(
  usersService: UsersService,
  adminUsersService: UsersService,
  cleanup: Cleanup,
  options: { title?: string; body?: RegisterUserRequest; ifExists?: boolean; mayHoldInvoices?: boolean } = {}
): Promise<ThrowawayCustomer> {
  return test.step(options.title ?? USER_REGISTER_STEP, async () => {
    const body = options.body ?? UserFactory.registerCustomer();
    await attachJson('Register Request', { method: 'POST', path: '/users/register', body });
    const created = await usersService.register(body);
    cleanup.add(() =>
      options.mayHoldInvoices
        ? adminUsersService.deleteUnlessInUse(created.id)
        : options.ifExists
          ? adminUsersService.deleteIfExists(created.id)
          : adminUsersService.delete(created.id)
    );
    await attachJson('Register Response', created);
    expect(created.id, assertMessage({ request: { method: 'POST', path: '/users/register', body }, expected: 'The new user has an id', actual: created })).toBeTruthy();
    return { id: created.id, email: body.email, password: body.password };
  });
}

/** The login step of the scenarios that log in their throwaway customer (wording of most Users files). */
const THROWAWAY_LOGIN_STEP = 'Send POST /users/login with that email and password, and take its access_token.';

/**
 * The login step (title `title`, default THROWAWAY_LOGIN_STEP) for a customer the test registered: logs in with its
 * email and password and returns the access_token. A setup step, so a failed login fails the step.
 */
export async function loginThrowawayCustomer(authService: AuthService, customer: ThrowawayCustomer, title: string = THROWAWAY_LOGIN_STEP): Promise<string> {
  return test.step(title, async () => {
    const credentials = { email: customer.email, password: customer.password };
    const request = { method: 'POST', path: '/users/login', body: credentials };
    await attachJson('Login Request', request);
    const login = await authService.login(credentials);
    await attachJson('Login Response', login);
    expect(Boolean(login.access_token), assertMessage({ request, expected: 'The login returns an access_token' })).toBe(true);
    return login.access_token;
  });
}

/**
 * A "Send PATCH /users/{userId} with ... enabled false, with the admin's token." setup step (title `title`): disables
 * the customer with `adminUsersService` and fails the step unless `success` is true. `authLabel` names the token in the
 * attached request. Use the customer's token only after this step: the API caches a user for 60 seconds.
 */
export async function disableCustomerSetup(adminUsersService: UsersService, userId: string, title: string, authLabel: string): Promise<void> {
  await test.step(title, async () => {
    const request = { method: 'PATCH', path: `/users/${userId}`, auth: authLabel, body: { enabled: false } };
    await attachJson('Patch User Request', request);
    const result = await adminUsersService.partialUpdate(userId, { enabled: false });
    await attachJson('Patch User Response', result);
    expect(result.success, assertMessage({ request, expected: 'success is true', actual: result })).toBe(true);
  });
}

/**
 * The checks of a "Verify POST /users/login with that email and <password> returns 200 with a non-empty access_token."
 * step. `passwordLabel` names the password in the attached request; the token is checked as a condition.
 */
export async function expectLoginSucceeds(authClient: AuthClient, email: string, password: string, passwordLabel: string): Promise<void> {
  const request = { method: 'POST', path: '/users/login', body: { email, password }, password: passwordLabel };
  const response = await authClient.login({ email, password });
  await attachJson('Login Request', request);
  await attachJson('Login Response', { status: response.status, body: response.body });
  expect(response.status, assertMessage({ request, expected: 'Status 200', actual: { status: response.status, body: response.body } })).toBe(200);
  const body = JSON.parse(response.body) as Partial<LoginResponse>;
  expect(
    typeof body.access_token === 'string' && body.access_token.length > 0,
    assertMessage({ request, expected: 'access_token is a non-empty string', actual: typeof body.access_token })
  ).toBe(true);
}

/** The login setup step of the logout and refresh scenarios (same wording in both files). */
const USER_LOGIN_STEP = "Send POST /users/login with the default user's email and password, and take the new access_token.";

/**
 * The USER_LOGIN_STEP step: a fresh login of `user` (the default role, the run's customer), so the test gets a
 * token of its own to log out or refresh, never the shared TokenService token other tests use. Returns that token.
 */
export async function loginForNewToken(authService: AuthService, user: TestUser): Promise<string> {
  return test.step(USER_LOGIN_STEP, async () => {
    const credentials = { email: user.username, password: user.password };
    const request = { method: 'POST', path: '/users/login', body: credentials };
    await attachJson('Login Request', request);
    const login = await authService.login(credentials);
    await attachJson('Login Response', login);
    expect(Boolean(login.access_token), assertMessage({ request, expected: 'The login returns an access_token' })).toBe(true);
    return login.access_token;
  });
}

/** The logout setup step (API-0108, API-0110); where the logout itself is checked, the spec calls the client. */
const USER_LOGOUT_STEP = 'Send GET /users/logout with that token.';

/** The USER_LOGOUT_STEP step as setup: logs out `token` and fails the step if that doesn't succeed. */
export async function logoutToken(usersServiceForToken: (token: string) => UsersService, token: string): Promise<void> {
  await test.step(USER_LOGOUT_STEP, async () => {
    const request = { method: 'GET', path: '/users/logout', auth: 'that token' };
    await attachJson('Logout Request', request);
    const result = await usersServiceForToken(token).logout();
    await attachJson('Logout Response', result);
    expect(typeof result.message, assertMessage({ request, expected: 'The logout returns a message', actual: result })).toBe('string');
  });
}

/**
 * What the list and search specs attach (and show as `actual`) for a page of users: the pagination fields and only the
 * id and role of each item. Other visitors' names, emails and cities are on these pages, and the reports are public.
 */
export function userPageSummary(page: Partial<Paginated<User>>): Record<string, unknown> {
  return pageSummary(page, userItemSummary);
}

/** A user of a page as `userPageSummary` shows it: its id and role. */
function userItemSummary(user: User): Record<string, unknown> {
  return { id: user.id, role: user.role };
}

/** The checks of a "Verify the body has the keys current_page, data, from, last_page, per_page, to and total ..." step (the keys part). */
export function expectUserPageKeys(request: unknown, page: Paginated<User>): void {
  for (const key of PAGE_KEYS) {
    expect(key in page, assertMessage({ request, expected: `The body has the key "${key}"`, actual: Object.keys(page) })).toBe(true);
  }
}

/**
 * The checks of a "Verify the body's total is 1 and data has exactly one item, whose id is the new user's id" step.
 * Returns that item, so a spec can check more of its fields.
 */
export function expectOnlyUser(request: unknown, page: Paginated<User>, userId: string): User {
  const actual = userPageSummary(page);
  expect(page.total, assertMessage({ request, expected: 'total is 1', actual })).toBe(1);
  expect(Array.isArray(page.data) && page.data.length === 1, assertMessage({ request, expected: 'data has exactly one item', actual })).toBe(true);
  const user = page.data[0]!;
  expect(user.id, assertMessage({ request, expected: `The item's id is the new user's id ${userId}`, actual })).toBe(userId);
  return user;
}

/** The checks of a "Verify the first response's current_page is 1 and the second response's current_page is 2." step. */
export function expectCurrentPages(request: unknown, first: Paginated<User>, second: Paginated<User>): void {
  expect(first.current_page, assertMessage({ request, expected: "The first response's current_page is 1", actual: userPageSummary(first) })).toBe(1);
  expect(second.current_page, assertMessage({ request, expected: "The second response's current_page is 2", actual: userPageSummary(second) })).toBe(2);
}

/** The checks of a "Verify no id appears in both pages' data." step. */
export function expectNoSharedIds(request: unknown, first: Paginated<User>, second: Paginated<User>): void {
  const firstIds = new Set(first.data.map((user) => user.id));
  const shared = second.data.map((user) => user.id).filter((id) => firstIds.has(id));
  expect(shared, assertMessage({ request, expected: 'No id is in both pages', actual: { shared, first: userPageSummary(first), second: userPageSummary(second) } })).toEqual(
    []
  );
}

/** The checks of a "Verify data has at most <n> items and every item's role is "user"." style step: every item's role is "user". */
export function expectAllCustomers(request: unknown, page: Paginated<User>): void {
  expectSomeItems(request, page.data, 'data');
  for (const user of page.data) {
    expect(user.role, assertMessage({ request, expected: `Item ${user.id} has role "user"`, actual: userPageSummary(page) })).toBe('user');
  }
}

/**
 * A "Verify the response status is <status>." step for responses that may list other customers (the BUG-032 checks,
 * which fail on every run): shows only the status, never the body, in the failure message.
 */
export function expectStatusHidingBody(request: unknown, response: ApiResponse, status: number): void {
  expectStatus(request, response, status, () => undefined);
}

/**
 * Attaches a list or search response: a 2xx page as `userPageSummary` (no other visitors' details), any other
 * response with its body as it came (error bodies hold no user data). Returns the parsed page for a 2xx, else undefined.
 */
export async function attachUserPageResponse(name: string, response: ApiResponse): Promise<Paginated<User> | undefined> {
  await attachJson(name, describeUserPage(response));
  return response.isSuccess ? parseJson<Paginated<User>>(undefined, response) : undefined;
}

/**
 * A read-back for a Verify step: GET /users/me with `client` (`auth` names its token in the attached request), which
 * must answer 200. Returns the request record, for the step's messages, and the profile.
 */
export async function readCurrentUser(client: UsersClient, auth: string): Promise<{ request: unknown; user: User }> {
  const { request, response } = await sendAndAttach('Current User', { method: 'GET', path: '/users/me', auth }, () => client.me());
  return { request, user: expectStatusAndBody<User>(request, response, 200) };
}

/** How a users page response is attached: its status, headers and `userPageSummary` (any other response as it came). */
export const describeUserPage: DescribeResponse = describePage(userItemSummary, { headers: true });
