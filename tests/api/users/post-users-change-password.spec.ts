import { test, expect, registerThrowawayCustomer, loginThrowawayCustomer, expectLoginSucceeds, type ThrowawayCustomer, AUTH, sendAndAttach, type AuthLabel } from '@fixtures';
import type { Cleanup } from '@fixtures/base';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { UsersClient } from '@api/clients/UsersClient';
import type { AuthService } from '@api/services/AuthService';
import type { UsersService } from '@api/services/UsersService';
import { UserFactory } from '@data/factories/UserFactory';
import { assertMessage } from '@utils/assertHelpers';
import { expectErrorKeys, expectMessage, expectStatus, expectSuccess } from '@utils/apiChecks';

// Scenarios: test-scenarios/api/users/post-users-change-password.yml

type ChangePasswordRequestInfo = { method: 'POST'; path: '/users/change-password'; auth: AuthLabel; body: unknown };

/** The login step of every scenario here that registers its own customer (same wording in each). */
const LOGIN_STEP = 'Send POST /users/login with that email and password, and take the new access_token.';
const WRONG_CURRENT_PASSWORD = 'Your current password does not matches with the password.';

/** Sends POST /users/change-password with `client`'s token and attaches the request and the response. */
async function sendChangePassword(
  client: UsersClient,
  body: Record<string, unknown>,
  auth: AuthLabel
): Promise<{ request: ChangePasswordRequestInfo; response: ApiResponse }> {
  const request: ChangePasswordRequestInfo = { method: 'POST', path: '/users/change-password', auth, body };
  return sendAndAttach('Change Password', request, () => client.changePassword(body));
}

/**
 * The register and login steps of the scenarios that change a throwaway customer's password (never the run's
 * customer's): its removal as admin is registered at once. Returns the customer and its own access_token.
 */
async function registerAndLogIn(
  usersService: UsersService,
  adminUsersService: UsersService,
  authService: AuthService,
  cleanup: Cleanup
): Promise<{ customer: ThrowawayCustomer; token: string }> {
  const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup);
  const token = await loginThrowawayCustomer(authService, customer, LOGIN_STEP);
  return { customer, token };
}

/** A random strong password that differs from each of `others`. */
function anotherStrongPassword(...others: string[]): string {
  const password = UserFactory.registerCustomer().password;
  expect(others.every((other) => other !== password), assertMessage({ expected: 'The new random password differs from the others' })).toBe(true);
  return password;
}

/**
 * The template of the "Change password with a missing or mismatched new password returns 422" scenarios
 * (API-0291..0293): registers and logs in a throwaway customer, sends the body `bodyFrom(customer)` builds with its token
 * (title `sendStep`), then checks the 422 and the new_password error.
 */
async function checkRejectedNewPassword(
  {
    usersService,
    adminUsersService,
    authService,
    usersClientForToken,
    cleanup,
  }: { usersService: UsersService; adminUsersService: UsersService; authService: AuthService; usersClientForToken: (token: string) => UsersClient; cleanup: Cleanup },
  sendStep: string,
  bodyFrom: (customer: ThrowawayCustomer) => Record<string, unknown>
): Promise<void> {
  let request: ChangePasswordRequestInfo;
  let response: ApiResponse;

  const { customer, token } = await registerAndLogIn(usersService, adminUsersService, authService, cleanup);

  await test.step(sendStep, async () => {
    ({ request, response } = await sendChangePassword(usersClientForToken(token), bodyFrom(customer), AUTH.customer));
  });

  await test.step('Verify the response status is 422.', async () => {
    expectStatus(request, response, 422);
  });

  await test.step("Verify the body's errors.new_password is a non-empty list.", async () => {
    expectErrorKeys(request, response, ['new_password']);
  });
}

test.describe('@users-api - Users API', () => {
  test('API-0290: Change password with a valid new password returns 200 and the new password logs in', async ({
    usersService,
    adminUsersService,
    authService,
    authClient,
    usersClientForToken,
    cleanup,
  }) => {
    let newPassword = '';
    let request: ChangePasswordRequestInfo;
    let response: ApiResponse;

    const { customer, token } = await registerAndLogIn(usersService, adminUsersService, authService, cleanup);

    await test.step(
      'Send POST /users/change-password with that token, current_password set to that password, and new_password and new_password_confirmation both set to a different random strong password.',
      async () => {
        newPassword = anotherStrongPassword(customer.password);
        const body = { current_password: customer.password, new_password: newPassword, new_password_confirmation: newPassword };
        ({ request, response } = await sendChangePassword(usersClientForToken(token), body, AUTH.customer));
      }
    );

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's success is true.", async () => {
      expectSuccess(request, response, true);
    });

    await test.step('Verify POST /users/login with that email and the new password returns 200 with a non-empty access_token.', async () => {
      await expectLoginSucceeds(authClient, customer.email, newPassword, 'the new password');
    });
  });

  test('API-0291: Change password without new_password returns 422', async ({ usersService, adminUsersService, authService, usersClientForToken, cleanup }) => {
    await checkRejectedNewPassword(
      { usersService, adminUsersService, authService, usersClientForToken, cleanup },
      'Send POST /users/change-password with that token, current_password set to that password and new_password_confirmation set to a different random strong password, without new_password.',
      (customer) => ({ current_password: customer.password, new_password_confirmation: anotherStrongPassword(customer.password) })
    );
  });

  test('API-0292: Change password without new_password_confirmation returns 422', async ({ usersService, adminUsersService, authService, usersClientForToken, cleanup }) => {
    await checkRejectedNewPassword(
      { usersService, adminUsersService, authService, usersClientForToken, cleanup },
      'Send POST /users/change-password with that token, current_password set to that password and new_password set to a different random strong password, without new_password_confirmation.',
      (customer) => ({ current_password: customer.password, new_password: anotherStrongPassword(customer.password) })
    );
  });

  test("API-0293: Change password with a confirmation that doesn't match returns 422", async ({ usersService, adminUsersService, authService, usersClientForToken, cleanup }) => {
    await checkRejectedNewPassword(
      { usersService, adminUsersService, authService, usersClientForToken, cleanup },
      'Send POST /users/change-password with that token, current_password set to that password, new_password set to a different random strong password and new_password_confirmation set to a third random strong password.',
      (customer) => {
        const newPassword = anotherStrongPassword(customer.password);
        return { current_password: customer.password, new_password: newPassword, new_password_confirmation: anotherStrongPassword(customer.password, newPassword) };
      }
    );
  });

  test('API-0294: Change password without current_password returns 400', async ({ usersService, adminUsersService, authService, usersClientForToken, cleanup }) => {
    let request: ChangePasswordRequestInfo;
    let response: ApiResponse;

    const { customer, token } = await registerAndLogIn(usersService, adminUsersService, authService, cleanup);

    await test.step(
      'Send POST /users/change-password with that token, and new_password and new_password_confirmation both set to a different random strong password, without current_password.',
      async () => {
        const newPassword = anotherStrongPassword(customer.password);
        const body = { new_password: newPassword, new_password_confirmation: newPassword };
        ({ request, response } = await sendChangePassword(usersClientForToken(token), body, AUTH.customer));
      }
    );

    await test.step('Verify the response status is 400.', async () => {
      expectStatus(request, response, 400);
    });

    await test.step("Verify the body's success is false.", async () => {
      expectSuccess(request, response, false);
    });

    await test.step('Verify the body\'s message is "Your current password does not matches with the password.".', async () => {
      expectMessage(request, response, WRONG_CURRENT_PASSWORD);
    });
  });

  test('API-0295: Change password with a wrong current password returns 400', async ({ usersService, adminUsersService, authService, usersClientForToken, cleanup }) => {
    let request: ChangePasswordRequestInfo;
    let response: ApiResponse;

    const { customer, token } = await registerAndLogIn(usersService, adminUsersService, authService, cleanup);

    await test.step(
      "Send POST /users/change-password with that token, current_password set to a random strong password that isn't that user's password, and new_password and new_password_confirmation both set to another random strong password.",
      async () => {
        // A wrong current password here isn't a failed login: it doesn't count toward the lockout.
        const wrongCurrent = anotherStrongPassword(customer.password);
        const newPassword = anotherStrongPassword(customer.password, wrongCurrent);
        const body = { current_password: wrongCurrent, new_password: newPassword, new_password_confirmation: newPassword };
        ({ request, response } = await sendChangePassword(usersClientForToken(token), body, AUTH.customer));
      }
    );

    await test.step('Verify the response status is 400.', async () => {
      expectStatus(request, response, 400);
    });

    await test.step("Verify the body's success is false.", async () => {
      expectSuccess(request, response, false);
    });

    await test.step('Verify the body\'s message is "Your current password does not matches with the password.".', async () => {
      expectMessage(request, response, WRONG_CURRENT_PASSWORD);
    });
  });

  test('API-0296: Change password with the current password as the new one returns 400', async ({ usersClientWithToken, user }) => {
    let request: ChangePasswordRequestInfo;
    let response: ApiResponse;

    await test.step(
      "Send POST /users/change-password with the default user's token, and current_password, new_password and new_password_confirmation all set to the default user's password.",
      async () => {
        // The run's customer: even if the API accepted this, the password would stay the same.
        const body = { current_password: user.password, new_password: user.password, new_password_confirmation: user.password };
        ({ request, response } = await sendChangePassword(usersClientWithToken, body, AUTH.defaultUser));
      }
    );

    await test.step('Verify the response status is 400.', async () => {
      expectStatus(request, response, 400);
    });

    await test.step("Verify the body's success is false.", async () => {
      expectSuccess(request, response, false);
    });

    await test.step('Verify the body\'s message is "New Password cannot be same as your current password.".', async () => {
      expectMessage(request, response, 'New Password cannot be same as your current password.');
    });
  });
});
