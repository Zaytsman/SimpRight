import { test, expect } from '@playwright/test';
import type { Cleanup } from '../../fixtures/base';
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
