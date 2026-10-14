import { test, createGuestMessage, readMessageOk, expectMessageStatus, setStatusSetup, MESSAGE_AUTH, type MessageRequest } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { MessagesClient } from '@api/clients/MessagesClient';
import { TestConstants } from '@data/TestConstants';
import { MessageFactory } from '@data/factories/MessageFactory';
import { expectErrorKeys, expectMessage, expectStatus, expectSuccess } from '@utils/apiChecks';
import { attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/messages/put-messages-by-message-id-status.yml

/**
 * Sends PUT /messages/{messageId}/status with `messagesClient` and attaches the request and the response. The client
 * always sends `Accept: application/json`, which the 422 scenarios ask for; the request record shows it.
 */
async function sendStatus(
  messagesClient: MessagesClient,
  messageId: string,
  body: Record<string, unknown>,
  auth: string
): Promise<{ request: MessageRequest; response: ApiResponse }> {
  const request: MessageRequest & { accept: string } = { method: 'PUT', path: `/messages/${messageId}/status`, auth, accept: 'application/json', body };
  const response = await messagesClient.updateStatus(messageId, body);
  await attachJson('Update Status Request', request);
  await attachJson('Update Status Response', { status: response.status, body: response.body });
  return { request, response };
}

test.describe('@messages-api - Messages API', () => {
  test.describe(() => {
    test.use({ role: 'admin' });

    test("API-0388: Set a message's status to RESOLVED returns 200 and the message shows it", async ({ messagesService, messagesClientWithToken }) => {
      let request: MessageRequest;
      let response: ApiResponse;

      const sent = await createGuestMessage(messagesService);

      await test.step('Send PUT /messages/{messageId}/status with that id, the admin\'s token and a body with status "RESOLVED".', async () => {
        ({ request, response } = await sendStatus(messagesClientWithToken, sent.message.id, MessageFactory.status('RESOLVED'), MESSAGE_AUTH.admin));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step("Verify the body's success is true.", async () => {
        expectSuccess(request, response, true);
      });

      await test.step('Verify GET /messages/{messageId} with that id and the admin\'s token returns 200 with status "RESOLVED".', async () => {
        const { request: getRequest, message } = await readMessageOk(messagesClientWithToken, sent.message.id, MESSAGE_AUTH.admin);
        expectMessageStatus(getRequest, message, 'RESOLVED');
      });
    });

    test("API-0389: Set a message's status to IN_PROGRESS returns 200 and the message shows it", async ({ messagesService, messagesClientWithToken }) => {
      let request: MessageRequest;
      let response: ApiResponse;

      const sent = await createGuestMessage(messagesService);

      await test.step('Send PUT /messages/{messageId}/status with that id, the admin\'s token and a body with status "IN_PROGRESS".', async () => {
        ({ request, response } = await sendStatus(messagesClientWithToken, sent.message.id, MessageFactory.status('IN_PROGRESS'), MESSAGE_AUTH.admin));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step("Verify the body's success is true.", async () => {
        expectSuccess(request, response, true);
      });

      await test.step('Verify GET /messages/{messageId} with that id and the admin\'s token returns 200 with status "IN_PROGRESS".', async () => {
        const { request: getRequest, message } = await readMessageOk(messagesClientWithToken, sent.message.id, MESSAGE_AUTH.admin);
        expectMessageStatus(getRequest, message, 'IN_PROGRESS');
      });
    });

    test("API-0390: Set a resolved message's status back to NEW returns 200", async ({ messagesService, messagesServiceWithToken, messagesClientWithToken }) => {
      let request: MessageRequest;
      let response: ApiResponse;

      const sent = await createGuestMessage(messagesService);
      await setStatusSetup(
        messagesServiceWithToken,
        sent.message.id,
        'RESOLVED',
        'Send PUT /messages/{messageId}/status with that id, the admin\'s token and a body with status "RESOLVED".'
      );

      await test.step('Send PUT /messages/{messageId}/status with the same id, the admin\'s token and a body with status "NEW".', async () => {
        ({ request, response } = await sendStatus(messagesClientWithToken, sent.message.id, MessageFactory.status('NEW'), MESSAGE_AUTH.admin));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step("Verify the body's success is true.", async () => {
        expectSuccess(request, response, true);
      });

      await test.step('Verify GET /messages/{messageId} with that id and the admin\'s token returns 200 with status "NEW".', async () => {
        const { request: getRequest, message } = await readMessageOk(messagesClientWithToken, sent.message.id, MESSAGE_AUTH.admin);
        expectMessageStatus(getRequest, message, 'NEW');
      });
    });

    test("API-0391: Set a message's status to the status it already has returns 200", async ({ messagesService, messagesClientWithToken }) => {
      let request: MessageRequest;
      let response: ApiResponse;

      const sent = await createGuestMessage(messagesService);

      await test.step('Send PUT /messages/{messageId}/status with that id, the admin\'s token and a body with status "NEW".', async () => {
        ({ request, response } = await sendStatus(messagesClientWithToken, sent.message.id, MessageFactory.status('NEW'), MESSAGE_AUTH.admin));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step('Verify GET /messages/{messageId} with that id and the admin\'s token returns 200 with status "NEW".', async () => {
        const { request: getRequest, message } = await readMessageOk(messagesClientWithToken, sent.message.id, MESSAGE_AUTH.admin);
        expectMessageStatus(getRequest, message, 'NEW');
      });
    });
  });

  test("API-0392: Set a message's status without a token returns 401", async ({ messagesClient }) => {
    let request: MessageRequest;
    let response: ApiResponse;

    await test.step('Send PUT /messages/{messageId}/status without an Authorization header, with a well-formed message id that doesn\'t exist and a body with status "RESOLVED".', async () => {
      ({ request, response } = await sendStatus(messagesClient, TestConstants.messages.unknownId, MessageFactory.status('RESOLVED'), MESSAGE_AUTH.none));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test("API-0393: Set a message's status with a malformed token returns 401", async ({ messagesClientWithInvalidToken }) => {
    let request: MessageRequest;
    let response: ApiResponse;

    await test.step('Send PUT /messages/{messageId}/status with a malformed token, a well-formed message id that doesn\'t exist and a body with status "RESOLVED".', async () => {
      ({ request, response } = await sendStatus(messagesClientWithInvalidToken, TestConstants.messages.unknownId, MessageFactory.status('RESOLVED'), MESSAGE_AUTH.malformed));
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

    test('API-0394: Set the status of an unknown message id returns 404', async ({ messagesClientWithToken }) => {
      let request: MessageRequest;
      let response: ApiResponse;

      await test.step('Send PUT /messages/{messageId}/status with a well-formed message id that doesn\'t exist, the admin\'s token and a body with status "RESOLVED".', async () => {
        ({ request, response } = await sendStatus(messagesClientWithToken, TestConstants.messages.unknownId, MessageFactory.status('RESOLVED'), MESSAGE_AUTH.admin));
      });

      await test.step('Verify the response status is 404.', async () => {
        expectStatus(request, response, 404);
      });

      await test.step('Verify the body\'s message is "Requested item not found".', async () => {
        expectMessage(request, response, 'Requested item not found');
      });
    });

    test("API-0395: Set a message's status without status returns 422 and keeps the status", async ({ messagesService, messagesClientWithToken }) => {
      let request: MessageRequest;
      let response: ApiResponse;

      const sent = await createGuestMessage(messagesService);

      await test.step("Send PUT /messages/{messageId}/status with that id, the admin's token, an Accept header of application/json and an empty JSON object as the body.", async () => {
        ({ request, response } = await sendStatus(messagesClientWithToken, sent.message.id, MessageFactory.emptyBody(), MESSAGE_AUTH.admin));
      });

      await test.step('Verify the response status is 422.', async () => {
        expectStatus(request, response, 422);
      });

      await test.step("Verify the body's errors has a status key with at least one message.", async () => {
        expectErrorKeys(request, response, ['status']);
      });

      await test.step('Verify GET /messages/{messageId} with that id and the admin\'s token returns 200 with status "NEW".', async () => {
        const { request: getRequest, message } = await readMessageOk(messagesClientWithToken, sent.message.id, MESSAGE_AUTH.admin);
        expectMessageStatus(getRequest, message, 'NEW');
      });
    });

    test("API-0396: Set a message's status to ON_HOLD returns 422 and keeps the status", async ({ messagesService, messagesClientWithToken }) => {
      let request: MessageRequest;
      let response: ApiResponse;

      const sent = await createGuestMessage(messagesService);

      await test.step('Send PUT /messages/{messageId}/status with that id, the admin\'s token, an Accept header of application/json and a body with status "ON_HOLD".', async () => {
        ({ request, response } = await sendStatus(messagesClientWithToken, sent.message.id, MessageFactory.status('ON_HOLD'), MESSAGE_AUTH.admin));
      });

      await test.step('Verify the response status is 422.', async () => {
        expectStatus(request, response, 422);
      });

      await test.step("Verify the body's errors has a status key with at least one message.", async () => {
        expectErrorKeys(request, response, ['status']);
      });

      await test.step('Verify GET /messages/{messageId} with that id and the admin\'s token returns 200 with status "NEW".', async () => {
        const { request: getRequest, message } = await readMessageOk(messagesClientWithToken, sent.message.id, MESSAGE_AUTH.admin);
        expectMessageStatus(getRequest, message, 'NEW');
      });
    });

    test("API-0397: Set a message's status to a lower-case value returns 422", async ({ messagesService, messagesClientWithToken }) => {
      let request: MessageRequest;
      let response: ApiResponse;

      const sent = await createGuestMessage(messagesService);

      await test.step('Send PUT /messages/{messageId}/status with that id, the admin\'s token, an Accept header of application/json and a body with status "resolved".', async () => {
        ({ request, response } = await sendStatus(messagesClientWithToken, sent.message.id, MessageFactory.status('resolved'), MESSAGE_AUTH.admin));
      });

      await test.step('Verify the response status is 422.', async () => {
        expectStatus(request, response, 422);
      });

      await test.step("Verify the body's errors has a status key with at least one message.", async () => {
        expectErrorKeys(request, response, ['status']);
      });
    });

    test('API-0398: Set the status of an unknown message id with an invalid body returns 422, not 404', async ({ messagesClientWithToken }) => {
      let request: MessageRequest;
      let response: ApiResponse;

      await test.step("Send PUT /messages/{messageId}/status with a well-formed message id that doesn't exist, the admin's token, an Accept header of application/json and an empty JSON object as the body.", async () => {
        ({ request, response } = await sendStatus(messagesClientWithToken, TestConstants.messages.unknownId, MessageFactory.emptyBody(), MESSAGE_AUTH.admin));
      });

      await test.step('Verify the response status is 422.', async () => {
        expectStatus(request, response, 422);
      });

      await test.step("Verify the body's errors has a status key with at least one message.", async () => {
        expectErrorKeys(request, response, ['status']);
      });
    });
  });
});
