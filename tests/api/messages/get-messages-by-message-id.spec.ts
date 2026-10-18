import { test, expect, AUTH, registerThrowawayCustomer, loginThrowawayCustomer, createCustomerMessage, createGuestMessage, sendMessageSetup, takeOwnUserId, sendGetMessage, expectNoReplies, type MessageRequest, checkStatusAndMessage } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { ContactMessageDetail, ContactReply } from '@api/dto/message';
import type { MessagesService } from '@api/services/MessagesService';
import { TestConstants } from '@data/TestConstants';
import { MessageFactory } from '@data/factories/MessageFactory';
import { expectStatus, parseJson } from '@utils/apiChecks';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/messages/get-messages-by-message-id.yml

/** The user keys only an admin caller gets. */
const ADMIN_ONLY_USER_KEYS = ['role', 'enabled', 'failed_login_attempts'] as const;

/** Parses a GET /messages/{messageId} body (call after its status was checked). */
function parseMessage(response: ApiResponse): ContactMessageDetail {
  return parseJson<ContactMessageDetail>(undefined, response);
}

/** The reply setup step of API-0367: replies with the admin's token and returns the reply and the text sent. */
async function replySetup(messagesService: MessagesService, messageId: string): Promise<{ reply: ContactReply; text: string }> {
  let result: { reply: ContactReply; text: string } | undefined;

  await test.step("Send POST /messages/{messageId}/reply with that id, the admin's token and a body with a message text, and take the reply's id.", async () => {
    const body = MessageFactory.reply();
    const request = { method: 'POST', path: `/messages/${messageId}/reply`, auth: AUTH.admin, body };
    await attachJson('Reply Request', request);
    const reply = await messagesService.reply(messageId, body);
    await attachJson('Reply Response', reply);
    expect(typeof reply.id === 'string' && reply.id.length > 0, assertMessage({ request, expected: 'The reply has an id', actual: reply })).toBe(true);
    result = { reply, text: body.message };
  });

  return result!;
}

test.describe('@messages-api - Messages API', () => {
  test('API-0364: Get a message as its sender returns 200 with the message, its sender and no replies', async ({
    usersServiceForToken,
    accessToken,
    messagesServiceWithToken,
    messagesClientWithToken,
  }) => {
    let request: MessageRequest;
    let response: ApiResponse;
    let message: ContactMessageDetail;

    const userId = await takeOwnUserId(usersServiceForToken(accessToken), "Send GET /users/me with the default user's token and take its id.", AUTH.defaultUser);
    const sent = await sendMessageSetup(
      messagesServiceWithToken,
      "Send POST /messages with the default user's token, a name, an email address, a unique subject and a message text, and take the new message's id.",
      AUTH.defaultUser,
      MessageFactory.withSender()
    );

    await test.step("Send GET /messages/{messageId} with that id and the default user's token.", async () => {
      ({ request, response } = await sendGetMessage(messagesClientWithToken, sent.message.id, AUTH.defaultUser));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the body\'s id equals the new message\'s id, its user_id equals the default user\'s id, its subject and message equal the values sent, its status is "NEW" and it has a created_at.', async () => {
      message = parseMessage(response);
      const actual = { id: message.id, user_id: message.user_id, subject: message.subject, message: message.message, status: message.status, created_at: message.created_at };
      expect(message.id, assertMessage({ request, expected: `id is the new message's id ${sent.message.id}`, actual })).toBe(sent.message.id);
      expect(message.user_id, assertMessage({ request, expected: `user_id is the default user's id ${userId}`, actual })).toBe(userId);
      expect(message.subject, assertMessage({ request, expected: `subject is the one sent, "${sent.body.subject}"`, actual })).toBe(sent.body.subject);
      expect(message.message, assertMessage({ request, expected: `message is the one sent, "${sent.body.message}"`, actual })).toBe(sent.body.message);
      expect(message.status, assertMessage({ request, expected: 'status is "NEW"', actual })).toBe('NEW');
      expect(
        typeof message.created_at === 'string' && message.created_at.length > 0,
        assertMessage({ request, expected: 'The body has a created_at', actual })
      ).toBe(true);
    });

    await test.step("Verify the body's replies is an empty array.", async () => {
      expectNoReplies(request, message);
    });

    await test.step("Verify the body's user has the default user's id as id and has no role, enabled and failed_login_attempts keys.", async () => {
      const userKeys = Object.keys(message.user ?? {});
      expect(message.user?.id, assertMessage({ request, expected: `user.id is the default user's id ${userId}`, actual: userKeys })).toBe(userId);
      for (const key of ADMIN_ONLY_USER_KEYS) {
        expect(userKeys.includes(key), assertMessage({ request, expected: `user has no "${key}" key`, actual: userKeys })).toBe(false);
      }
    });
  });

  test.describe(() => {
    test.use({ role: 'admin' });

    test("API-0365: Get a customer's message as an admin returns 200 with the sender's admin-only fields", async ({
      usersService,
      adminUsersService,
      authService,
      messagesServiceForToken,
      messagesClientWithToken,
      cleanup,
    }) => {
      let request: MessageRequest;
      let response: ApiResponse;
      let message: ContactMessageDetail;

      const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup);
      const token = await loginThrowawayCustomer(authService, customer);
      const sent = await createCustomerMessage(messagesServiceForToken(token));

      await test.step("Send GET /messages/{messageId} with that id and the admin's token.", async () => {
        ({ request, response } = await sendGetMessage(messagesClientWithToken, sent.message.id, AUTH.admin));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step("Verify the body's user_id and its user's id equal the new user's id.", async () => {
        message = parseMessage(response);
        const actual = { user_id: message.user_id, user: message.user ? { id: message.user.id } : message.user };
        expect(message.user_id, assertMessage({ request, expected: `user_id is the new user's id ${customer.id}`, actual })).toBe(customer.id);
        expect(message.user?.id, assertMessage({ request, expected: `user.id is the new user's id ${customer.id}`, actual })).toBe(customer.id);
      });

      await test.step("Verify the body's user has the keys role, enabled and failed_login_attempts.", async () => {
        const userKeys = Object.keys(message.user ?? {});
        for (const key of ADMIN_ONLY_USER_KEYS) {
          expect(userKeys.includes(key), assertMessage({ request, expected: `user has the key "${key}"`, actual: userKeys })).toBe(true);
        }
      });
    });

    test('API-0366: Get a guest message as an admin returns 200 with no sender', async ({ messagesService, messagesClientWithToken }) => {
      let request: MessageRequest;
      let response: ApiResponse;
      let message: ContactMessageDetail;

      const sent = await createGuestMessage(messagesService);

      await test.step("Send GET /messages/{messageId} with that id and the admin's token.", async () => {
        ({ request, response } = await sendGetMessage(messagesClientWithToken, sent.message.id, AUTH.admin));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step("Verify the body's id equals the new message's id, its user_id is null and its user is null.", async () => {
        message = parseMessage(response);
        const actual = { id: message.id, user_id: message.user_id, user: message.user };
        expect(message.id, assertMessage({ request, expected: `id is the new message's id ${sent.message.id}`, actual })).toBe(sent.message.id);
        expect(message.user_id, assertMessage({ request, expected: 'user_id is null', actual })).toBeNull();
        expect(message.user, assertMessage({ request, expected: 'user is null', actual })).toBeNull();
      });

      await test.step("Verify the body's replies is an empty array.", async () => {
        expectNoReplies(request, message);
      });
    });

    test('API-0367: Get a message with a reply returns 200 with the reply and its author', async ({
      messagesService,
      messagesServiceWithToken,
      messagesClientWithToken,
      usersServiceForToken,
      accessToken,
    }) => {
      let request: MessageRequest;
      let response: ApiResponse;
      let message: ContactMessageDetail;

      const sent = await createGuestMessage(messagesService);
      const adminId = await takeOwnUserId(usersServiceForToken(accessToken), "Send GET /users/me with the admin's token and take its id.", AUTH.admin);
      const { reply, text } = await replySetup(messagesServiceWithToken, sent.message.id);

      await test.step("Send GET /messages/{messageId} with that id and the admin's token.", async () => {
        ({ request, response } = await sendGetMessage(messagesClientWithToken, sent.message.id, AUTH.admin));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step("Verify the body's replies has exactly one item, with the reply's id as id, the text sent as message and a created_at.", async () => {
        message = parseMessage(response);
        const actual = (message.replies ?? []).map((item) => ({ id: item.id, message: item.message, created_at: item.created_at }));
        expect(
          Array.isArray(message.replies) && message.replies.length === 1,
          assertMessage({ request, expected: 'replies has exactly one item', actual })
        ).toBe(true);
        const item = message.replies[0]!;
        expect(item.id, assertMessage({ request, expected: `The reply's id is ${reply.id}`, actual })).toBe(reply.id);
        expect(item.message, assertMessage({ request, expected: `The reply's message is the text sent, "${text}"`, actual })).toBe(text);
        expect(
          typeof item.created_at === 'string' && item.created_at.length > 0,
          assertMessage({ request, expected: 'The reply has a created_at', actual })
        ).toBe(true);
      });

      await test.step("Verify that reply's user has the admin's id as id.", async () => {
        const author = message.replies[0]!.user;
        expect(author?.id, assertMessage({ request, expected: `The reply's user.id is the admin's id ${adminId}`, actual: { id: author?.id } })).toBe(adminId);
      });
    });
  });

  test('API-0368: Get a message without a token returns 401', async ({ messagesClient }) => {
    await checkStatusAndMessage(
      "Send GET /messages/{messageId} without an Authorization header, with a well-formed message id that doesn't exist.",
      () => sendGetMessage(messagesClient, TestConstants.messages.unknownId, AUTH.none),
      401,
      'Unauthorized'
    );
  });

  test('API-0369: Get a message with a malformed token returns 401', async ({ messagesClientWithInvalidToken }) => {
    await checkStatusAndMessage(
      "Send GET /messages/{messageId} with a malformed token and a well-formed message id that doesn't exist.",
      () => sendGetMessage(messagesClientWithInvalidToken, TestConstants.messages.unknownId, AUTH.malformed),
      401,
      'Unauthorized'
    );
  });

  test("API-0370: Get another user's message as a customer returns 404", async ({
    usersService,
    adminUsersService,
    authService,
    messagesServiceForToken,
    messagesClientWithToken,
    cleanup,
  }) => {
    let request: MessageRequest;
    let response: ApiResponse;

    const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup);
    const token = await loginThrowawayCustomer(authService, customer);
    const sent = await createCustomerMessage(messagesServiceForToken(token));
    test.fail(true, "Known issue BUG-029: Returns 200 with an empty body for a message the customer doesn't own instead of 404.");

    await test.step("Send GET /messages/{messageId} with that id and the default user's token.", async () => {
      ({ request, response } = await sendGetMessage(messagesClientWithToken, sent.message.id, AUTH.defaultUser));
    });

    await test.step('Verify the response status is 404.', async () => {
      expectStatus(request, response, 404);
    });
  });

  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0371: Get an unknown message id as an admin returns 404', async ({ messagesClientWithToken }) => {
      test.fail(true, 'Known issue BUG-029: Returns 200 with an empty body for an unknown message id instead of 404.');
      let request: MessageRequest;
      let response: ApiResponse;

      await test.step("Send GET /messages/{messageId} with a well-formed message id that doesn't exist and the admin's token.", async () => {
        ({ request, response } = await sendGetMessage(messagesClientWithToken, TestConstants.messages.unknownId, AUTH.admin));
      });

      await test.step('Verify the response status is 404.', async () => {
        expectStatus(request, response, 404);
      });
    });
  });
});
