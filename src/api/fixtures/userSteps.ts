import { test, expect } from '@playwright/test';
import type { Cleanup } from '../../fixtures/base';
import type { TestUser } from '../../config/env';
import type { AuthService } from '../services/AuthService';
import type { UsersService } from '../services/UsersService';
import { UserFactory } from '../../data/factories/UserFactory';
import { assertMessage, attachJson } from '../../utils/assertHelpers';

/**
 * Steps shared by the Users specs that need a throwaway customer (never the run's customer or the admin).
 * The title is the scenario step verbatim; every scenario file uses the same wording.
 */
export const USER_REGISTER_STEP =
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
 */
export async function registerThrowawayCustomer(
  usersService: UsersService,
  adminUsersService: UsersService,
  cleanup: Cleanup
): Promise<ThrowawayCustomer> {
  let customer: ThrowawayCustomer = { id: '', email: '', password: '' };

  await test.step(USER_REGISTER_STEP, async () => {
    const body = UserFactory.registerCustomer();
    await attachJson('Register Request', { method: 'POST', path: '/users/register', body });
    const created = await usersService.register(body);
    cleanup.add(() => adminUsersService.delete(created.id));
    await attachJson('Register Response', created);
    expect(created.id, assertMessage({ request: { method: 'POST', path: '/users/register', body }, expected: 'The new user has an id', actual: created })).toBeTruthy();
    customer = { id: created.id, email: body.email, password: body.password };
  });

  return customer;
}

/** The login setup step of the logout and refresh scenarios (same wording in both files). */
export const USER_LOGIN_STEP = "Send POST /users/login with the default user's email and password, and take the new access_token.";

/**
 * The USER_LOGIN_STEP step: a fresh login of `user` (the default role, the run's customer), so the test gets a
 * token of its own to log out or refresh, never the shared TokenService token other tests use. Returns that token.
 */
export async function loginForNewToken(authService: AuthService, user: TestUser): Promise<string> {
  let token = '';

  await test.step(USER_LOGIN_STEP, async () => {
    const credentials = { email: user.username, password: user.password };
    const request = { method: 'POST', path: '/users/login', body: credentials };
    await attachJson('Login Request', request);
    const login = await authService.login(credentials);
    await attachJson('Login Response', login);
    expect(Boolean(login.access_token), assertMessage({ request, expected: 'The login returns an access_token' })).toBe(true);
    token = login.access_token;
  });

  return token;
}

/** The logout setup step (API-0108, API-0110); where the logout itself is checked, the spec calls the client. */
export const USER_LOGOUT_STEP = 'Send GET /users/logout with that token.';

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
