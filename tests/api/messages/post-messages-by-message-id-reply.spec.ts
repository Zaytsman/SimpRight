import { test, expect, AUTH, createGuestMessage, takeOwnUserId, readMessageOk, expectMessageStatus, setStatusSetup, expectNoReplies, type MessageRequest, sendAndAttach } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { MessagesClient } from '@api/clients/MessagesClient';
import type { ContactReply, ReplyRequest } from '@api/dto/message';
import { TestConstants } from '@data/TestConstants';
import { MessageFactory } from '@data/factories/MessageFactory';
import { expectFieldMessages, expectMessage, expectStatus, parseJson } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/messages/post-messages-by-message-id-reply.yml

/** Sends POST /messages/{messageId}/reply with `messagesClient` and attaches the request and the response. */
async function sendReply(
  messagesClient: MessagesClient,
  messageId: string,
  body: ReplyRequest | Record<string, unknown>,
  auth: string
): Promise<{ request: MessageRequest; response: ApiResponse }> {
  const request: MessageRequest = { method: 'POST', path: `/messages/${messageId}/reply`, auth, body };
  return sendAndAttach('Reply', request, () => messagesClient.reply(messageId, body));
}

test.describe('@messages-api - Messages API', () => {
  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0372: Reply to a message returns 201 and sets the message to IN_PROGRESS with the reply listed', async ({
      messagesService,
      messagesClientWithToken,
      usersServiceForToken,
      accessToken,
    }) => {
      const body = MessageFactory.reply();
      let request: MessageRequest;
      let response: ApiResponse;
      let reply: ContactReply;

      const sent = await createGuestMessage(messagesService);
      const adminId = await takeOwnUserId(usersServiceForToken(accessToken), "Send GET /users/me with the admin's token and take its id.", AUTH.admin);

      await test.step("Send POST /messages/{messageId}/reply with that id, the admin's token and a body with a message text, and take the body's id as the reply's id.", async () => {
        ({ request, response } = await sendReply(messagesClientWithToken, sent.message.id, body, AUTH.admin));
      });

      await test.step('Verify the response status is 201.', async () => {
        expectStatus(request, response, 201);
      });

      await test.step("Verify the body's message equals the text sent, and its id is a non-empty string and it has a created_at.", async () => {
        reply = parseJson<ContactReply>(request, response);
        expect(reply.message, assertMessage({ request, expected: `message is the text sent, "${body.message}"`, actual: reply })).toBe(body.message);
        expect(typeof reply.id === 'string' && reply.id.length > 0, assertMessage({ request, expected: 'id is a non-empty string', actual: reply })).toBe(true);
        expect(typeof reply.created_at === 'string' && reply.created_at.length > 0, assertMessage({ request, expected: 'The body has a created_at', actual: reply })).toBe(
          true
        );
      });

      await test.step('Verify the body has no message_id and no user_id keys.', async () => {
        const keys = Object.keys(reply);
        expect(keys.includes('message_id'), assertMessage({ request, expected: 'The body has no message_id key', actual: keys })).toBe(false);
        expect(keys.includes('user_id'), assertMessage({ request, expected: 'The body has no user_id key', actual: keys })).toBe(false);
      });

      await test.step('Verify GET /messages/{messageId} with that id and the admin\'s token returns 200 with status "IN_PROGRESS" and a replies list with exactly one item, with the reply\'s id as id, the text sent as message and the admin\'s id as its user\'s id.', async () => {
        const { request: getRequest, message } = await readMessageOk(messagesClientWithToken, sent.message.id, AUTH.admin);
        expectMessageStatus(getRequest, message, 'IN_PROGRESS');
        const actual = (message.replies ?? []).map((item) => ({ id: item.id, message: item.message, user: { id: item.user?.id } }));
        expect(
          Array.isArray(message.replies) && message.replies.length === 1,
          assertMessage({ request: getRequest, expected: 'replies has exactly one item', actual })
        ).toBe(true);
        const item = message.replies[0]!;
        expect(item.id, assertMessage({ request: getRequest, expected: `The reply's id is ${reply.id}`, actual })).toBe(reply.id);
        expect(item.message, assertMessage({ request: getRequest, expected: `The reply's message is the text sent, "${body.message}"`, actual })).toBe(body.message);
        expect(item.user?.id, assertMessage({ request: getRequest, expected: `The reply's user.id is the admin's id ${adminId}`, actual })).toBe(adminId);
      });
    });

    test('API-0373: Reply to a resolved message returns 201 and reopens it as IN_PROGRESS', async ({
      messagesService,
      messagesServiceWithToken,
      messagesClientWithToken,
    }) => {
      let request: MessageRequest;
      let response: ApiResponse;

      const sent = await createGuestMessage(messagesService);

      await setStatusSetup(
        messagesServiceWithToken,
        sent.message.id,
        'RESOLVED',
        'Send PUT /messages/{messageId}/status with that id, the admin\'s token and a body with status "RESOLVED".'
      );

      await test.step("Send POST /messages/{messageId}/reply with that id, the admin's token and a body with a message text.", async () => {
        ({ request, response } = await sendReply(messagesClientWithToken, sent.message.id, MessageFactory.reply(), AUTH.admin));
      });

      await test.step('Verify the response status is 201.', async () => {
        expectStatus(request, response, 201);
      });

      await test.step('Verify GET /messages/{messageId} with that id and the admin\'s token returns 200 with status "IN_PROGRESS".', async () => {
        const { request: getRequest, message } = await readMessageOk(messagesClientWithToken, sent.message.id, AUTH.admin);
        expectMessageStatus(getRequest, message, 'IN_PROGRESS');
      });
    });
  });

  test('API-0374: Reply to a message without a token returns 401', async ({ messagesClient }) => {
    let request: MessageRequest;
    let response: ApiResponse;

    await test.step("Send POST /messages/{messageId}/reply without an Authorization header, with a well-formed message id that doesn't exist and a body with a message text.", async () => {
      ({ request, response } = await sendReply(messagesClient, TestConstants.messages.unknownId, MessageFactory.reply(), AUTH.none));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test('API-0375: Reply to a message with a malformed token returns 401', async ({ messagesClientWithInvalidToken }) => {
    let request: MessageRequest;
    let response: ApiResponse;

    await test.step("Send POST /messages/{messageId}/reply with a malformed token, a well-formed message id that doesn't exist and a body with a message text.", async () => {
      ({ request, response } = await sendReply(messagesClientWithInvalidToken, TestConstants.messages.unknownId, MessageFactory.reply(), AUTH.malformed));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0376: Reply without message returns 422 and adds nothing', async ({ messagesService, messagesClientWithToken }) => {
      let request: MessageRequest;
      let response: ApiResponse;

      const sent = await createGuestMessage(messagesService);

      await test.step("Send POST /messages/{messageId}/reply with that id, the admin's token and an empty JSON object as the body.", async () => {
        ({ request, response } = await sendReply(messagesClientWithToken, sent.message.id, MessageFactory.emptyBody(), AUTH.admin));
      });

      await test.step('Verify the response status is 422.', async () => {
        expectStatus(request, response, 422);
      });

      await test.step('Verify the body has a message key with at least one message.', async () => {
        expectFieldMessages(request, response, 'message');
      });

      await test.step('Verify GET /messages/{messageId} with that id and the admin\'s token returns 200 with status "NEW" and an empty replies list.', async () => {
        const { request: getRequest, message } = await readMessageOk(messagesClientWithToken, sent.message.id, AUTH.admin);
        expectMessageStatus(getRequest, message, 'NEW');
        expectNoReplies(getRequest, message);
      });
    });

    test('API-0377: Reply with a message longer than 250 characters returns 422', async ({ messagesService, messagesClientWithToken }) => {
      let request: MessageRequest;
      let response: ApiResponse;

      const sent = await createGuestMessage(messagesService);

      await test.step("Send POST /messages/{messageId}/reply with that id, the admin's token and a body with a 251-character message.", async () => {
        ({ request, response } = await sendReply(
          messagesClientWithToken,
          sent.message.id,
          MessageFactory.reply({ message: MessageFactory.replyOfLength(251) }),
          AUTH.admin
        ));
      });

      await test.step('Verify the response status is 422.', async () => {
        expectStatus(request, response, 422);
      });

      await test.step('Verify the body has a message key with at least one message.', async () => {
        expectFieldMessages(request, response, 'message');
      });
    });

    test('API-0378: Reply with a subscript character in the message returns 422', async ({ messagesService, messagesClientWithToken }) => {
      let request: MessageRequest;
      let response: ApiResponse;

      const sent = await createGuestMessage(messagesService);

      await test.step('Send POST /messages/{messageId}/reply with that id, the admin\'s token and a body whose message contains the subscript character "₂" (U+2082).', async () => {
        ({ request, response } = await sendReply(
          messagesClientWithToken,
          sent.message.id,
          MessageFactory.reply({ message: MessageFactory.subscriptReply() }),
          AUTH.admin
        ));
      });

      await test.step('Verify the response status is 422.', async () => {
        expectStatus(request, response, 422);
      });

      await test.step('Verify the body has a message key with at least one message.', async () => {
        expectFieldMessages(request, response, 'message');
      });
    });

    test('API-0379: Reply with an invalid body to an unknown message id returns 422, not 500', async ({ messagesClientWithToken }) => {
      let request: MessageRequest;
      let response: ApiResponse;

      await test.step("Send POST /messages/{messageId}/reply with a well-formed message id that doesn't exist, the admin's token and an empty JSON object as the body.", async () => {
        ({ request, response } = await sendReply(messagesClientWithToken, TestConstants.messages.unknownId, MessageFactory.emptyBody(), AUTH.admin));
      });

      await test.step('Verify the response status is 422.', async () => {
        expectStatus(request, response, 422);
      });

      await test.step('Verify the body has a message key with at least one message.', async () => {
        expectFieldMessages(request, response, 'message');
      });
    });

    test('API-0380: Reply to an unknown message id returns 404', async ({ messagesClientWithToken }) => {
      test.fail(true, 'Known issue BUG-030: Returns 500 for a reply to an unknown message id instead of 404.');
      let request: MessageRequest;
      let response: ApiResponse;

      await test.step("Send POST /messages/{messageId}/reply with a well-formed message id that doesn't exist, the admin's token and a body with a message text.", async () => {
        ({ request, response } = await sendReply(messagesClientWithToken, TestConstants.messages.unknownId, MessageFactory.reply(), AUTH.admin));
      });

      await test.step('Verify the response status is 404.', async () => {
        expectStatus(request, response, 404);
      });
    });
  });
});
