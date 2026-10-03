import { test, expect, registerThrowawayCustomer, expectFieldMessages } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { AuthClient } from '@api/clients/AuthClient';
import type { UsersClient } from '@api/clients/UsersClient';
import type { LoginResponse } from '@api/dto/auth';
import type { ValidationErrors } from '@api/dto/common';
import type { RegisteredUser, RegisterUserRequest, User } from '@api/dto/user';
import type { UsersService } from '@api/services/UsersService';
import type { Cleanup } from '@fixtures/base';
import { UserFactory } from '@data/factories/UserFactory';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/users/post-users-register.yml

type RegisterRequestInfo = { method: 'POST'; path: '/users/register'; body: unknown };

/** A Unicode subscript two (U+2082), inside the U+2070-U+209F range the API rejects in text fields. */
const SUBSCRIPT_TWO = '₂';

/**
 * Sends POST /users/register with `body` (no token) and attaches the request and the response. When the API
 * creates a customer (201), even where the scenario expects an error, its removal as admin is registered at once.
 */
async function sendRegister(
  usersClient: UsersClient,
  adminUsersService: UsersService,
  cleanup: Cleanup,
  body: RegisterUserRequest | Record<string, unknown>
): Promise<{ request: RegisterRequestInfo; response: ApiResponse }> {
  const request: RegisterRequestInfo = { method: 'POST', path: '/users/register', body };
  const response = await usersClient.register(body);
  if (response.status === 201) {
    const createdId = (JSON.parse(response.body) as RegisteredUser).id;
    if (createdId) cleanup.add(() => adminUsersService.delete(createdId));
  }
  await attachJson('Register Request', request);
  await attachJson('Register Response', { status: response.status, body: response.body });
  return { request, response };
}

/** The checks of a "Verify the response status is <status>." step. */
function expectStatus(request: RegisterRequestInfo, response: ApiResponse, status: number): void {
  expect(response.status, assertMessage({ request, expected: `Status ${status}`, actual: { status: response.status, body: response.body } })).toBe(status);
}

/** The checks of a "Verify the body's <field> messages include <message>." step. */
function expectFieldMessage(request: RegisterRequestInfo, response: ApiResponse, field: string, message: string): void {
  const body = JSON.parse(response.body) as ValidationErrors;
  const messages = body[field];
  expect(
    Array.isArray(messages) && messages.includes(message),
    assertMessage({ request, expected: `The "${field}" messages include "${message}"`, actual: body })
  ).toBe(true);
}

/**
 * The read-back of a Verify step: POST /users/login with `email` and `password` must return 200, then
 * GET /users/me with its access_token must return 200. Returns the profile.
 */
async function loginAndReadProfile(
  authClient: AuthClient,
  usersClientForToken: (token: string) => UsersClient,
  email: string,
  password: string
): Promise<User> {
  const loginRequest = { method: 'POST', path: '/users/login', body: { email, password } };
  const loginResponse = await authClient.login({ email, password });
  await attachJson('Login Request', loginRequest);
  await attachJson('Login Response', { status: loginResponse.status, body: loginResponse.body });
  expect(loginResponse.status, assertMessage({ request: loginRequest, expected: 'Status 200', actual: { status: loginResponse.status, body: loginResponse.body } })).toBe(200);

  const meRequest = { method: 'GET', path: '/users/me', auth: 'the access_token of that login' };
  const meResponse = await usersClientForToken((JSON.parse(loginResponse.body) as LoginResponse).access_token).me();
  await attachJson('Current User Request', meRequest);
  await attachJson('Current User Response', { status: meResponse.status, body: meResponse.body });
  expect(meResponse.status, assertMessage({ request: meRequest, expected: 'Status 200', actual: { status: meResponse.status, body: meResponse.body } })).toBe(200);
  return JSON.parse(meResponse.body) as User;
}

test.describe('@users-api - Users API', () => {
  test('API-0085: Register returns 201 with the new customer', async ({
    usersClientWithoutToken,
    adminUsersService,
    authClient,
    usersClientForToken,
    cleanup,
  }) => {
    const sent = UserFactory.registerCustomer();
    let request: RegisterRequestInfo;
    let response: ApiResponse;
    let body: RegisteredUser;

    await test.step('Send POST /users/register with a unique email, a first name, a last name and a random strong password.', async () => {
      ({ request, response } = await sendRegister(usersClientWithoutToken, adminUsersService, cleanup, sent));
    });

    await test.step('Verify the response status is 201.', async () => {
      expectStatus(request, response, 201);
      body = JSON.parse(response.body) as RegisteredUser;
    });

    await test.step('Verify the body has a non-empty id and a non-empty created_at.', async () => {
      expect(body.id, assertMessage({ request, expected: 'id is not empty', actual: body })).toBeTruthy();
      expect(body.created_at, assertMessage({ request, expected: 'created_at is not empty', actual: body })).toBeTruthy();
    });

    await test.step("Verify the body's first_name, last_name and email equal the values sent.", async () => {
      for (const field of ['first_name', 'last_name', 'email'] as const) {
        expect(body[field], assertMessage({ request, expected: `${field} is "${sent[field]}"`, actual: body })).toBe(sent[field]);
      }
    });

    await test.step('Verify the body has an address object.', async () => {
      expect(
        typeof body.address === 'object' && body.address !== null && !Array.isArray(body.address),
        assertMessage({ request, expected: 'address is an object', actual: body.address })
      ).toBe(true);
    });

    await test.step('Verify POST /users/login with that email and password returns 200, and GET /users/me with its access_token returns the new id and email.', async () => {
      const profile = await loginAndReadProfile(authClient, usersClientForToken, sent.email, sent.password);
      const meRequest = { method: 'GET', path: '/users/me' };
      const actual = { id: profile.id, email: profile.email };
      expect(profile.id, assertMessage({ request: meRequest, expected: `id is "${body.id}"`, actual })).toBe(body.id);
      expect(profile.email, assertMessage({ request: meRequest, expected: `email is "${sent.email}"`, actual })).toBe(sent.email);
    });
  });

  test('API-0086: Register stores the optional fields sent', async ({
    usersClientWithoutToken,
    adminUsersService,
    authClient,
    usersClientForToken,
    cleanup,
  }) => {
    const sent = UserFactory.registerCustomerWithDetails();
    const addressFields = ['street', 'house_number', 'city', 'state', 'postal_code'] as const;
    let request: RegisterRequestInfo;
    let response: ApiResponse;
    let body: RegisteredUser;

    await test.step(
      'Send POST /users/register with a unique email, a first name, a last name, a random strong password, a phone of digits, a dob 30 years ago in YYYY-MM-DD, and an address with street, house_number, city, state and postal_code (no country).',
      async () => {
        ({ request, response } = await sendRegister(usersClientWithoutToken, adminUsersService, cleanup, sent));
      }
    );

    await test.step('Verify the response status is 201.', async () => {
      expectStatus(request, response, 201);
      body = JSON.parse(response.body) as RegisteredUser;
    });

    await test.step("Verify the body's phone and dob equal the values sent.", async () => {
      const actual = { phone: body.phone, dob: body.dob };
      expect(body.phone, assertMessage({ request, expected: `phone is "${sent.phone}"`, actual })).toBe(sent.phone);
      expect(body.dob, assertMessage({ request, expected: `dob is "${sent.dob}"`, actual })).toBe(sent.dob);
    });

    await test.step("Verify the body's address street, house_number, city, state and postal_code equal the values sent.", async () => {
      for (const field of addressFields) {
        expect(body.address?.[field], assertMessage({ request, expected: `address.${field} is "${sent.address?.[field]}"`, actual: body.address })).toBe(
          sent.address?.[field]
        );
      }
    });

    await test.step(
      'Verify POST /users/login with that email and password returns 200, and GET /users/me with its access_token returns the same phone, dob and address values.',
      async () => {
        const profile = await loginAndReadProfile(authClient, usersClientForToken, sent.email, sent.password);
        const meRequest = { method: 'GET', path: '/users/me' };
        const actual = { phone: profile.phone, dob: profile.dob, address: profile.address };
        expect(profile.phone, assertMessage({ request: meRequest, expected: `phone is "${sent.phone}"`, actual })).toBe(sent.phone);
        expect(profile.dob, assertMessage({ request: meRequest, expected: `dob is "${sent.dob}"`, actual })).toBe(sent.dob);
        for (const field of addressFields) {
          expect(profile.address?.[field], assertMessage({ request: meRequest, expected: `address.${field} is "${sent.address?.[field]}"`, actual })).toBe(
            sent.address?.[field]
          );
        }
      }
    );
  });

  test('API-0087: Register without the required fields returns 422 for each of them', async ({ usersClientWithoutToken, adminUsersService, cleanup }) => {
    let request: RegisterRequestInfo;
    let response: ApiResponse;

    await test.step('Send POST /users/register with an empty JSON object as the body.', async () => {
      ({ request, response } = await sendRegister(usersClientWithoutToken, adminUsersService, cleanup, {}));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step('Verify the body has the keys first_name, last_name, email and password, each with at least one message.', async () => {
      for (const field of ['first_name', 'last_name', 'email', 'password']) {
        expectFieldMessages(response, field, request);
      }
    });
  });

  test('API-0088: Register with a first name longer than 40 characters returns 422', async ({ usersClientWithoutToken, adminUsersService, cleanup }) => {
    let request: RegisterRequestInfo;
    let response: ApiResponse;

    await test.step('Send POST /users/register with a unique email, a 41-character first name, a last name and a random strong password.', async () => {
      const body = UserFactory.registerCustomer({ first_name: UserFactory.textOfLength(41) });
      ({ request, response } = await sendRegister(usersClientWithoutToken, adminUsersService, cleanup, body));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step('Verify the body has a first_name key with at least one message.', async () => {
      expectFieldMessages(response, 'first_name', request);
    });
  });

  test('API-0089: Register with a last name longer than 20 characters returns 422', async ({ usersClientWithoutToken, adminUsersService, cleanup }) => {
    let request: RegisterRequestInfo;
    let response: ApiResponse;

    await test.step('Send POST /users/register with a unique email, a first name, a 21-character last name and a random strong password.', async () => {
      const body = UserFactory.registerCustomer({ last_name: UserFactory.textOfLength(21) });
      ({ request, response } = await sendRegister(usersClientWithoutToken, adminUsersService, cleanup, body));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step('Verify the body has a last_name key with at least one message.', async () => {
      expectFieldMessages(response, 'last_name', request);
    });
  });

  test('API-0090: Register with a weak password returns 422', async ({ usersClientWithoutToken, adminUsersService, cleanup }) => {
    let request: RegisterRequestInfo;
    let response: ApiResponse;

    await test.step('Send POST /users/register with a unique email, a first name, a last name and a password of 10 lower-case letters only.', async () => {
      const body = UserFactory.registerCustomer({ password: UserFactory.weakPassword() });
      ({ request, response } = await sendRegister(usersClientWithoutToken, adminUsersService, cleanup, body));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step('Verify the body has a password key with at least one message.', async () => {
      expectFieldMessages(response, 'password', request);
    });
  });

  test('API-0091: Register with a date of birth under 18 years ago returns 422', async ({ usersClientWithoutToken, adminUsersService, cleanup }) => {
    let request: RegisterRequestInfo;
    let response: ApiResponse;

    await test.step('Send POST /users/register with a unique email, a first name, a last name, a random strong password and a dob 17 years ago in YYYY-MM-DD.', async () => {
      const body = UserFactory.registerCustomer({ dob: UserFactory.dobYearsAgo(17) });
      ({ request, response } = await sendRegister(usersClientWithoutToken, adminUsersService, cleanup, body));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step('Verify the body has a dob key with at least one message.', async () => {
      expectFieldMessages(response, 'dob', request);
    });
  });

  test('API-0092: Register with a subscript character in the first name returns 422', async ({ usersClientWithoutToken, adminUsersService, cleanup }) => {
    let request: RegisterRequestInfo;
    let response: ApiResponse;

    await test.step('Send POST /users/register with a unique email, a first name followed by a Unicode subscript character, a last name and a random strong password.', async () => {
      const body = UserFactory.registerCustomer({ first_name: `SimpRight${SUBSCRIPT_TWO}` });
      ({ request, response } = await sendRegister(usersClientWithoutToken, adminUsersService, cleanup, body));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step('Verify the body has a first_name key with at least one message.', async () => {
      expectFieldMessages(response, 'first_name', request);
    });
  });

  test('API-0093: Register with a date of birth not in YYYY-MM-DD returns 422', async ({ usersClientWithoutToken, adminUsersService, cleanup }) => {
    let request: RegisterRequestInfo;
    let response: ApiResponse;

    await test.step('Send POST /users/register with a unique email, a first name, a last name, a random strong password and a dob 30 years ago in DD-MM-YYYY format.', async () => {
      const body = UserFactory.registerCustomer({ dob: UserFactory.dobYearsAgo(30, 'DD-MM-YYYY') });
      ({ request, response } = await sendRegister(usersClientWithoutToken, adminUsersService, cleanup, body));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step('Verify the body has a dob key with at least one message.', async () => {
      expectFieldMessages(response, 'dob', request);
    });
  });

  test('API-0094: Register with an email longer than 256 characters returns 422', async ({ usersClientWithoutToken, adminUsersService, cleanup }) => {
    let request: RegisterRequestInfo;
    let response: ApiResponse;

    await test.step(
      'Send POST /users/register with a well-formed 257-character email that starts with a unique value, a first name, a last name and a random strong password.',
      async () => {
        const email = UserFactory.emailOfLength(257);
        expect(email.length, assertMessage({ expected: 'The email has 257 characters', actual: email.length })).toBe(257);
        const body = UserFactory.registerCustomer({ email });
        ({ request, response } = await sendRegister(usersClientWithoutToken, adminUsersService, cleanup, body));
      }
    );

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step('Verify the body has an email key with at least one message.', async () => {
      expectFieldMessages(response, 'email', request);
    });
  });

  test('API-0095: Register with a phone longer than 24 characters returns 422', async ({ usersClientWithoutToken, adminUsersService, cleanup }) => {
    let request: RegisterRequestInfo;
    let response: ApiResponse;

    await test.step('Send POST /users/register with a unique email, a first name, a last name, a random strong password and a 25-digit phone.', async () => {
      const body = UserFactory.registerCustomer({ phone: '1234567890123456789012345' });
      ({ request, response } = await sendRegister(usersClientWithoutToken, adminUsersService, cleanup, body));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step('Verify the body has a phone key with at least one message.', async () => {
      expectFieldMessages(response, 'phone', request);
    });
  });

  test("API-0096: Register with an email that's already registered returns 409", async ({
    usersClientWithoutToken,
    usersService,
    adminUsersService,
    cleanup,
  }) => {
    let request: RegisterRequestInfo;
    let response: ApiResponse;

    const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup);

    await test.step('Send POST /users/register again with the same email and otherwise valid values.', async () => {
      const body = UserFactory.registerCustomer({ email: customer.email });
      ({ request, response } = await sendRegister(usersClientWithoutToken, adminUsersService, cleanup, body));
    });

    await test.step('Verify the response status is 409.', async () => {
      expectStatus(request, response, 409);
    });

    await test.step('Verify the body\'s email messages include "A customer with this email address already exists.".', async () => {
      expectFieldMessage(request, response, 'email', 'A customer with this email address already exists.');
    });
  });

  test('API-0097: Register with a taken email and another invalid field returns 422', async ({
    usersClientWithoutToken,
    usersService,
    adminUsersService,
    cleanup,
  }) => {
    let request: RegisterRequestInfo;
    let response: ApiResponse;

    const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup);

    await test.step('Send POST /users/register again with the same email, a 41-character first name, a last name and a random strong password.', async () => {
      const body = UserFactory.registerCustomer({ email: customer.email, first_name: UserFactory.textOfLength(41) });
      ({ request, response } = await sendRegister(usersClientWithoutToken, adminUsersService, cleanup, body));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step('Verify the body has a first_name key with at least one message.', async () => {
      expectFieldMessages(response, 'first_name', request);
    });
  });

  test('API-0098: Register with a date of birth more than 93 years ago returns 422', async ({ usersClientWithoutToken, adminUsersService, cleanup }) => {
    let request: RegisterRequestInfo;
    let response: ApiResponse;

    await test.step('Send POST /users/register with a unique email, a first name, a last name, a random strong password and a dob 94 years ago in YYYY-MM-DD.', async () => {
      const body = UserFactory.registerCustomer({ dob: UserFactory.dobYearsAgo(94) });
      ({ request, response } = await sendRegister(usersClientWithoutToken, adminUsersService, cleanup, body));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step('Verify the body\'s dob messages include "Customer must be younger than 75 years old.".', async () => {
      expectFieldMessage(request, response, 'dob', 'Customer must be younger than 75 years old.');
    });
  });

  test('API-0099: Register a customer older than 75 returns 422', async ({ usersClientWithoutToken, adminUsersService, cleanup }) => {
    test.fail(true, 'Known issue: Accepts a customer born 80 years ago (201) instead of 422; the 75-year age limit only rejects birth dates more than 93 years ago.');
    let request: RegisterRequestInfo;
    let response: ApiResponse;

    await test.step('Send POST /users/register with a unique email, a first name, a last name, a random strong password and a dob 80 years ago in YYYY-MM-DD.', async () => {
      const body = UserFactory.registerCustomer({ dob: UserFactory.dobYearsAgo(80) });
      ({ request, response } = await sendRegister(usersClientWithoutToken, adminUsersService, cleanup, body));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });
  });
});
