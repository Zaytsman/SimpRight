import { test, expect, registerThrowawayCustomer, loginThrowawayCustomer, type ThrowawayCustomer } from '@fixtures';
import type { Cleanup } from '@fixtures/base';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { UsersClient } from '@api/clients/UsersClient';
import type { RegisterUserRequest, UpdateUserRequest, User } from '@api/dto/user';
import type { AuthService } from '@api/services/AuthService';
import type { UsersService } from '@api/services/UsersService';
import { UserFactory } from '@data/factories/UserFactory';
import { assertMessage, attachJson } from '@utils/assertHelpers';
import { expectFieldMessages, expectStatus, expectSuccess } from '@utils/apiChecks';

// Scenarios: test-scenarios/api/users/put-users-by-user-id.yml

type UpdateRequestInfo = { method: 'PUT'; path: string; auth: string; body: unknown };

/** The register step of every scenario in this file (same wording in each). */
const REGISTER_STEP =
  'Send POST /users/register with a unique email, a first name, a last name of at most 20 characters, a random strong password, a phone of digits, and an address with a street, a city, a state, country "NL" and postal_code "1011AB", and take the new user\'s id.';
/** The read-back of API-0314..0318 (same wording in each). */
const UNCHANGED_PROFILE_STEP =
  'Verify GET /users/me with that access_token returns the registered first_name, last_name, phone, and address street, city, state, country and postal_code.';

/** The profile values the scenarios compare: first_name, last_name, phone and the address fields. */
type ProfileValues = { first_name: string; last_name: string; phone?: string | null; address: Record<'street' | 'city' | 'state' | 'country' | 'postal_code', string | null | undefined> };

const profileOf = (body: RegisterUserRequest | UpdateUserRequest): ProfileValues => ({
  first_name: body.first_name,
  last_name: body.last_name,
  phone: body.phone,
  address: {
    street: body.address?.street,
    city: body.address?.city,
    state: body.address?.state,
    country: body.address?.country,
    postal_code: body.address?.postal_code,
  },
});

/**
 * The register and login steps of every scenario here: a throwaway customer with a phone and the NL address (its
 * removal as admin registered at once), logged in for its own access_token.
 */
async function registerAndLogIn(
  usersService: UsersService,
  adminUsersService: UsersService,
  authService: AuthService,
  cleanup: Cleanup
): Promise<{ customer: ThrowawayCustomer; registered: RegisterUserRequest; token: string }> {
  const registered = UserFactory.registerCustomerWithPhoneAndAddress();
  const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup, { title: REGISTER_STEP, body: registered });
  const token = await loginThrowawayCustomer(authService, customer);
  return { customer, registered, token };
}

/** Sends PUT /users/{userId} with the customer's own token and attaches the request and the response. */
async function sendUpdate(usersClient: UsersClient, userId: string, body: UpdateUserRequest | Record<string, unknown>): Promise<{ request: UpdateRequestInfo; response: ApiResponse }> {
  const request: UpdateRequestInfo = { method: 'PUT', path: `/users/${userId}`, auth: "the customer's access_token", body };
  const response = await usersClient.update(userId, body);
  await attachJson('Update User Request', request);
  await attachJson('Update User Response', { status: response.status, body: response.body });
  return { request, response };
}

/** The read-back of a Verify step: GET /users/me with the token must return 200 and `expected`'s values. */
async function expectProfile(usersClient: UsersClient, expected: ProfileValues, label: string): Promise<void> {
  const request = { method: 'GET', path: '/users/me', auth: 'that access_token' };
  const response = await usersClient.me();
  await attachJson('Current User Request', request);
  await attachJson('Current User Response', { status: response.status, body: response.body });
  expect(response.status, assertMessage({ request, expected: 'Status 200', actual: { status: response.status, body: response.body } })).toBe(200);
  const profile = JSON.parse(response.body) as User;
  const actual = { first_name: profile.first_name, last_name: profile.last_name, phone: profile.phone, address: profile.address };
  for (const field of ['first_name', 'last_name', 'phone'] as const) {
    expect(profile[field], assertMessage({ request, expected: `${field} is the ${label} "${expected[field]}"`, actual })).toBe(expected[field]);
  }
  for (const field of ['street', 'city', 'state', 'country', 'postal_code'] as const) {
    expect(profile.address?.[field], assertMessage({ request, expected: `address.${field} is the ${label} "${expected.address[field]}"`, actual })).toBe(
      expected.address[field]
    );
  }
}

/**
 * The steps after register and login of API-0314..0318, which differ only in the field left out: PUT the new values
 * without `field` (under the scenario's own step title), check the 422 and its message key, and read back the
 * unchanged profile.
 */
async function updateWithoutField(
  usersService: UsersService,
  adminUsersService: UsersService,
  authService: AuthService,
  usersClientForToken: (token: string) => UsersClient,
  cleanup: Cleanup,
  field: string,
  updateStep: string,
  messageStep: string
): Promise<void> {
  let request: UpdateRequestInfo;
  let response: ApiResponse;

  const { customer, registered, token } = await registerAndLogIn(usersService, adminUsersService, authService, cleanup);

  await test.step(updateStep, async () => {
    const body = UserFactory.withoutField(UserFactory.updateProfile(customer.email, registered), field);
    ({ request, response } = await sendUpdate(usersClientForToken(token), customer.id, body));
  });

  await test.step('Verify the response status is 422.', async () => {
    expectStatus(request, response, 422);
  });

  await test.step(messageStep, async () => {
    expectFieldMessages(response, field, request);
  });

  await test.step(UNCHANGED_PROFILE_STEP, async () => {
    await expectProfile(usersClientForToken(token), profileOf(registered), 'registered');
  });
}

test.describe('@users-api - Users API', () => {
  test('API-0313: Update user with valid changed values returns 200 and the profile shows them', async ({
    usersService,
    adminUsersService,
    authService,
    usersClientForToken,
    cleanup,
  }) => {
    let sent: UpdateUserRequest;
    let request: UpdateRequestInfo;
    let response: ApiResponse;

    const { customer, registered, token } = await registerAndLogIn(usersService, adminUsersService, authService, cleanup);

    await test.step(
      "Send PUT /users/{userId} with that id and access_token, the customer's own email, and a new first_name, last_name (at most 20 characters), phone of digits, street, city, state, country and postal_code, each different from the registered value.",
      async () => {
        sent = UserFactory.updateProfile(customer.email, registered);
        ({ request, response } = await sendUpdate(usersClientForToken(token), customer.id, sent));
      }
    );

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's success is true.", async () => {
      expectSuccess(request, response, true);
    });

    await test.step(
      'Verify GET /users/me with that access_token returns the new first_name, last_name, phone, and address street, city, state, country and postal_code.',
      async () => {
        await expectProfile(usersClientForToken(token), profileOf(sent), 'new');
      }
    );
  });

  test('API-0314: Update user without first_name returns 422 and leaves the profile unchanged', async ({
    usersService,
    adminUsersService,
    authService,
    usersClientForToken,
    cleanup,
  }) => {
    await updateWithoutField(
      usersService,
      adminUsersService,
      authService,
      usersClientForToken,
      cleanup,
      'first_name',
      "Send PUT /users/{userId} with that id and access_token, the customer's own email, and a new last_name (at most 20 characters), phone of digits, street, city, state, country and postal_code, each different from the registered value, without first_name.",
      'Verify the body has a first_name key with at least one message.'
    );
  });

  test('API-0315: Update user without last_name returns 422 and leaves the profile unchanged', async ({
    usersService,
    adminUsersService,
    authService,
    usersClientForToken,
    cleanup,
  }) => {
    await updateWithoutField(
      usersService,
      adminUsersService,
      authService,
      usersClientForToken,
      cleanup,
      'last_name',
      "Send PUT /users/{userId} with that id and access_token, the customer's own email, and a new first_name, phone of digits, street, city, state, country and postal_code, each different from the registered value, without last_name.",
      'Verify the body has a last_name key with at least one message.'
    );
  });

  test('API-0316: Update user without address.street returns 422 and leaves the profile unchanged', async ({
    usersService,
    adminUsersService,
    authService,
    usersClientForToken,
    cleanup,
  }) => {
    await updateWithoutField(
      usersService,
      adminUsersService,
      authService,
      usersClientForToken,
      cleanup,
      'address.street',
      "Send PUT /users/{userId} with that id and access_token, the customer's own email, and a new first_name, last_name (at most 20 characters), phone of digits, city, state, country and postal_code, each different from the registered value, without address.street.",
      'Verify the body has an address.street key with at least one message.'
    );
  });

  test('API-0317: Update user without address.city returns 422 and leaves the profile unchanged', async ({
    usersService,
    adminUsersService,
    authService,
    usersClientForToken,
    cleanup,
  }) => {
    await updateWithoutField(
      usersService,
      adminUsersService,
      authService,
      usersClientForToken,
      cleanup,
      'address.city',
      "Send PUT /users/{userId} with that id and access_token, the customer's own email, and a new first_name, last_name (at most 20 characters), phone of digits, street, state, country and postal_code, each different from the registered value, without address.city.",
      'Verify the body has an address.city key with at least one message.'
    );
  });

  test('API-0318: Update user without address.country returns 422 and leaves the profile unchanged', async ({
    usersService,
    adminUsersService,
    authService,
    usersClientForToken,
    cleanup,
  }) => {
    await updateWithoutField(
      usersService,
      adminUsersService,
      authService,
      usersClientForToken,
      cleanup,
      'address.country',
      "Send PUT /users/{userId} with that id and access_token, the customer's own email, and a new first_name, last_name (at most 20 characters), phone of digits, street, city, state and postal_code, each different from the registered value, without address.country.",
      'Verify the body has an address.country key with at least one message.'
    );
  });
});
