import { test, expect, AUTH, registerThrowawayCustomer, loginThrowawayCustomer, takeOwnUserId, readMessageOk, expectMessageStatus, sendListMessages, messagePageSummary, type MessageRequest, sendAndAttach, checkRejectedBody } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { MessagesClient } from '@api/clients/MessagesClient';
import type { Paginated } from '@api/dto/common';
import type { ContactMessage, ContactMessageListItem } from '@api/dto/message';
import { MessageFactory } from '@data/factories/MessageFactory';
import { expectFieldMessages, expectStatus, parseJson } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/messages/post-messages.yml

/** Sends POST /messages with `messagesClient` and attaches the request and the response. */
async function sendMessage(messagesClient: MessagesClient, body: unknown, auth: string): Promise<{ request: MessageRequest; response: ApiResponse }> {
  const request: MessageRequest = { method: 'POST', path: '/messages', auth, body };
  return sendAndAttach('Send Message', request, () => messagesClient.send(body as Record<string, unknown>));
}

/** Parses a POST /messages body (call after its status was checked). */
function parseSent(response: ApiResponse): ContactMessage {
  return parseJson<ContactMessage>(undefined, response);
}

/** The checks of a "Verify the body's id is a non-empty string ..." part. */
function expectId(request: MessageRequest, message: ContactMessage): void {
  expect(typeof message.id === 'string' && message.id.length > 0, assertMessage({ request, expected: 'id is a non-empty string', actual: message })).toBe(true);
}

/** The checks of a "... its subject and message equal the values sent ..." part. */
function expectSubjectAndMessage(request: MessageRequest, actual: { subject?: string; message?: string }, body: { subject: string; message: string }): void {
  expect(actual.subject, assertMessage({ request, expected: `subject is the one sent, "${body.subject}"`, actual })).toBe(body.subject);
  expect(actual.message, assertMessage({ request, expected: `message is the one sent, "${body.message}"`, actual })).toBe(body.message);
}

/** The checks of a "Verify the response status is 200 or 422." step. */
function expectOkOrUnprocessable(request: MessageRequest, response: ApiResponse): void {
  expect(
    [200, 422].includes(response.status),
    assertMessage({ request, expected: 'Status 200 or 422', actual: { status: response.status, body: response.body.slice(0, 500) } })
  ).toBe(true);
}

test.describe('@messages-api - Messages API', () => {
  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0350: Send a message as a guest returns 200 and an admin can read it', async ({ messagesClient, messagesClientWithToken }) => {
      const body = MessageFactory.withSender();
      let request: MessageRequest;
      let response: ApiResponse;
      let sent: ContactMessage;

      await test.step("Send POST /messages without an Authorization header, with a name, an email address, a unique subject and a message text, and take the body's id.", async () => {
        ({ request, response } = await sendMessage(messagesClient, body, AUTH.none));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step('Verify the body\'s id is a non-empty string, its subject, message, name and email equal the values sent and its status is "NEW".', async () => {
        sent = parseSent(response);
        expectId(request, sent);
        expectSubjectAndMessage(request, sent, body);
        expect(sent.name, assertMessage({ request, expected: `name is the one sent, "${body.name}"`, actual: sent })).toBe(body.name);
        expect(sent.email, assertMessage({ request, expected: `email is the one sent, "${body.email}"`, actual: sent })).toBe(body.email);
        expect(sent.status, assertMessage({ request, expected: 'status is "NEW"', actual: sent })).toBe('NEW');
      });

      await test.step('Verify the body has a created_at and no user_id key.', async () => {
        expect(typeof sent.created_at === 'string' && sent.created_at.length > 0, assertMessage({ request, expected: 'The body has a created_at', actual: sent })).toBe(
          true
        );
        expect('user_id' in sent, assertMessage({ request, expected: 'The body has no user_id key', actual: Object.keys(sent) })).toBe(false);
      });

      await test.step('Verify GET /messages/{messageId} with that id and the admin\'s token returns 200 with the same subject and message, status "NEW" and user_id null.', async () => {
        const { request: getRequest, message } = await readMessageOk(messagesClientWithToken, sent.id, AUTH.admin);
        expectSubjectAndMessage(getRequest, message, body);
        expectMessageStatus(getRequest, message, 'NEW');
        expect(message.user_id, assertMessage({ request: getRequest, expected: 'user_id is null', actual: { user_id: message.user_id } })).toBeNull();
      });
    });
  });

  test("API-0351: Send a message as a logged-in customer returns 200 with the customer's user_id", async ({
    usersServiceForToken,
    accessToken,
    messagesClientWithToken,
  }) => {
    const body = MessageFactory.sendMessage();
    let request: MessageRequest;
    let response: ApiResponse;
    let sent: ContactMessage;

    const userId = await takeOwnUserId(usersServiceForToken(accessToken), "Send GET /users/me with the default user's token and take its id.", AUTH.defaultUser);

    await test.step("Send POST /messages with the default user's token, a unique subject and a message text, and take the body's id.", async () => {
      ({ request, response } = await sendMessage(messagesClientWithToken, body, AUTH.defaultUser));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the body\'s id is a non-empty string, its subject and message equal the values sent, its status is "NEW" and its user_id equals the default user\'s id.', async () => {
      sent = parseSent(response);
      expectId(request, sent);
      expectSubjectAndMessage(request, sent, body);
      expect(sent.status, assertMessage({ request, expected: 'status is "NEW"', actual: sent })).toBe('NEW');
      expect(sent.user_id, assertMessage({ request, expected: `user_id is the default user's id ${userId}`, actual: sent })).toBe(userId);
    });

    await test.step("Verify GET /messages/{messageId} with that id and the default user's token returns 200 with the same subject, message and user_id.", async () => {
      const { request: getRequest, message } = await readMessageOk(messagesClientWithToken, sent.id, AUTH.defaultUser);
      expectSubjectAndMessage(getRequest, message, body);
      expect(message.user_id, assertMessage({ request: getRequest, expected: `user_id is the default user's id ${userId}`, actual: { user_id: message.user_id } })).toBe(
        userId
      );
    });
  });

  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0352: Send a message with only a subject and a message returns 200', async ({ messagesClient, messagesClientWithToken }) => {
      const body = MessageFactory.sendMessage();
      let request: MessageRequest;
      let response: ApiResponse;
      let sent: ContactMessage;

      await test.step("Send POST /messages without an Authorization header, with a unique subject and a message text, without name and email, and take the body's id.", async () => {
        ({ request, response } = await sendMessage(messagesClient, body, AUTH.none));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step('Verify the body\'s id is a non-empty string, its subject and message equal the values sent and its status is "NEW".', async () => {
        sent = parseSent(response);
        expectId(request, sent);
        expectSubjectAndMessage(request, sent, body);
        expect(sent.status, assertMessage({ request, expected: 'status is "NEW"', actual: sent })).toBe('NEW');
      });

      await test.step("Verify GET /messages/{messageId} with that id and the admin's token returns 200 with the same subject and message, name null and email null.", async () => {
        const { request: getRequest, message } = await readMessageOk(messagesClientWithToken, sent.id, AUTH.admin);
        expectSubjectAndMessage(getRequest, message, body);
        expect(message.name, assertMessage({ request: getRequest, expected: 'name is null', actual: { name: message.name } })).toBeNull();
        expect(message.email, assertMessage({ request: getRequest, expected: 'email is null', actual: { email: message.email } })).toBeNull();
      });
    });

    test('API-0353: Send a message with a 120-character subject and a 250-character message returns 200', async ({ messagesClient, messagesClientWithToken }) => {
      const body = MessageFactory.sendMessage({ subject: MessageFactory.subjectOfLength(120), message: MessageFactory.textOfLength(250) });
      let request: MessageRequest;
      let response: ApiResponse;

      await test.step("Send POST /messages without an Authorization header, with a 120-character subject and a 250-character message, and take the body's id.", async () => {
        ({ request, response } = await sendMessage(messagesClient, body, AUTH.none));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step("Verify GET /messages/{messageId} with that id and the admin's token returns 200 with the same subject and message.", async () => {
        const { request: getRequest, message } = await readMessageOk(messagesClientWithToken, parseSent(response).id, AUTH.admin);
        expectSubjectAndMessage(getRequest, message, body);
      });
    });

    test('API-0354: Send a message with a status in the body ignores it and creates it as NEW', async ({ messagesClient, messagesClientWithToken }) => {
      const body = MessageFactory.withExtraKeys({ status: 'RESOLVED' });
      let request: MessageRequest;
      let response: ApiResponse;
      let sent: ContactMessage;

      await test.step('Send POST /messages without an Authorization header, with a unique subject, a message text and status "RESOLVED", and take the body\'s id.', async () => {
        ({ request, response } = await sendMessage(messagesClient, body, AUTH.none));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step('Verify the body\'s status is "NEW".', async () => {
        sent = parseSent(response);
        expect(sent.status, assertMessage({ request, expected: 'status is "NEW"', actual: sent })).toBe('NEW');
      });

      await test.step('Verify GET /messages/{messageId} with that id and the admin\'s token returns 200 with status "NEW".', async () => {
        const { request: getRequest, message } = await readMessageOk(messagesClientWithToken, sent.id, AUTH.admin);
        expectMessageStatus(getRequest, message, 'NEW');
      });
    });

    test('API-0355: Send a message with a malformed token returns 200 and the message has no owner', async ({
      messagesClientWithInvalidToken,
      messagesClientWithToken,
    }) => {
      const body = MessageFactory.sendMessage();
      let request: MessageRequest;
      let response: ApiResponse;
      let sent: ContactMessage;

      await test.step("Send POST /messages with a malformed token, a unique subject and a message text, and take the body's id.", async () => {
        ({ request, response } = await sendMessage(messagesClientWithInvalidToken, body, AUTH.malformed));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step('Verify the body has no user_id key.', async () => {
        sent = parseSent(response);
        expect('user_id' in sent, assertMessage({ request, expected: 'The body has no user_id key', actual: sent })).toBe(false);
      });

      await test.step("Verify GET /messages/{messageId} with that id and the admin's token returns 200 with user_id null.", async () => {
        const { request: getRequest, message } = await readMessageOk(messagesClientWithToken, sent.id, AUTH.admin);
        expect(message.user_id, assertMessage({ request: getRequest, expected: 'user_id is null', actual: { user_id: message.user_id } })).toBeNull();
      });
    });
  });

  test('API-0356: Send a message without subject and message returns 422 for each of them', async ({ messagesClient }) => {
    let request: MessageRequest;
    let response: ApiResponse;

    await test.step('Send POST /messages without an Authorization header, with a name and an email address, without subject and message.', async () => {
      ({ request, response } = await sendMessage(messagesClient, MessageFactory.withoutSubjectAndMessage(), AUTH.none));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step('Verify the body has the keys subject and message, each with at least one message.', async () => {
      expectFieldMessages(request, response, 'subject');
      expectFieldMessages(request, response, 'message');
    });
  });

  test('API-0357: Send a message with a subject longer than 120 characters returns 422', async ({ messagesClient }) => {
    await checkRejectedBody(
      'Send POST /messages without an Authorization header, with a 121-character subject and a message text.',
      () => sendMessage(messagesClient, MessageFactory.sendMessage({ subject: MessageFactory.subjectOfLength(121) }), AUTH.none),
      'subject'
    );
  });

  test('API-0358: Send a message with a message longer than 250 characters returns 422', async ({ messagesClient }) => {
    await checkRejectedBody(
      'Send POST /messages without an Authorization header, with a unique subject and a 251-character message.',
      () => sendMessage(messagesClient, MessageFactory.sendMessage({ message: MessageFactory.textOfLength(251) }), AUTH.none),
      'message'
    );
  });

  test('API-0359: Send a message with an invalid email returns 422', async ({ messagesClient }) => {
    await checkRejectedBody(
      'Send POST /messages without an Authorization header, with the email "not-an-email", a unique subject and a message text.',
      () => sendMessage(messagesClient, MessageFactory.sendMessage({ email: 'not-an-email' }), AUTH.none),
      'email'
    );
  });

  test('API-0360: Send a message with a subscript character in the subject returns 422', async ({ messagesClient }) => {
    await checkRejectedBody(
      'Send POST /messages without an Authorization header, with a subject that contains the subscript character "₂" (U+2082) and a message text.',
      () => sendMessage(messagesClient, MessageFactory.sendMessage({ subject: MessageFactory.subscriptSubject() }), AUTH.none),
      'subject'
    );
  });

  test('API-0361: Send a message with a 61-character name returns 200 or 422, not 500', async ({ messagesClient }) => {
    test.fail(true, 'Known issue BUG-027: Returns 500 for a name of 61 to 120 characters, which the validation allows, instead of 422 or 200.');
    let request: MessageRequest;
    let response: ApiResponse;

    await test.step('Send POST /messages without an Authorization header, with a 61-character name, a unique subject and a message text.', async () => {
      ({ request, response } = await sendMessage(messagesClient, MessageFactory.sendMessage({ name: MessageFactory.nameOfLength(61) }), AUTH.none));
    });

    await test.step('Verify the response status is 200 or 422.', async () => {
      expectOkOrUnprocessable(request, response);
    });
  });

  test('API-0362: Send a message with a parent_id key returns 200 or 422, not 500', async ({ messagesClient }) => {
    test.fail(true, 'Known issue BUG-028: Returns 500 when the body has a parent_id key instead of ignoring it or answering 422.');
    let request: MessageRequest;
    let response: ApiResponse;

    await test.step('Send POST /messages without an Authorization header, with a unique subject, a message text and a parent_id key set to a non-empty string.', async () => {
      ({ request, response } = await sendMessage(messagesClient, MessageFactory.withExtraKeys({ parent_id: 'parent-from-simpright' }), AUTH.none));
    });

    await test.step('Verify the response status is 200 or 422.', async () => {
      expectOkOrUnprocessable(request, response);
    });
  });

  test("API-0363: Send a guest message with another user's user_id doesn't put it in that user's list", async ({
    usersService,
    adminUsersService,
    authService,
    messagesClient,
    messagesClientForToken,
    cleanup,
  }) => {
    let messageId = '';
    let request: MessageRequest;
    let response: ApiResponse;

    const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup);
    const token = await loginThrowawayCustomer(authService, customer);
    test.fail(
      true,
      "Known issue BUG-028: Stores a guest message under the user_id sent in the body, so it shows in that user's list, instead of leaving it without an owner."
    );

    await test.step("Send POST /messages without an Authorization header, with a unique subject, a message text and user_id set to the new user's id, and take the body's id.", async () => {
      const sent = await sendMessage(messagesClient, MessageFactory.withExtraKeys({ user_id: customer.id }), AUTH.none);
      expectStatus(sent.request, sent.response, 200);
      messageId = parseSent(sent.response).id;
    });

    await test.step("Send GET /messages with the throwaway customer's access_token.", async () => {
      ({ request, response } = await sendListMessages(messagesClientForToken(token), AUTH.throwaway));
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's data has no item with the new message's id.", async () => {
      const page = parseJson<Paginated<ContactMessageListItem>>(request, response);
      const ids = page.data.map((item) => item.id);
      expect(ids.includes(messageId), assertMessage({ request, expected: `data has no item with the new message's id ${messageId}`, actual: messagePageSummary(page) })).toBe(
        false
      );
    });
  });
});
