import { test, expect, AUTH, createGuestMessage, type MessageRequest, sendAndAttach } from '@fixtures';
import type { ApiResponse, MultipartFile } from '@api/clients/BaseClient';
import type { MessagesClient } from '@api/clients/MessagesClient';
import type { AttachFileErrors } from '@api/dto/message';
import { TestConstants } from '@data/TestConstants';
import { MessageFactory } from '@data/factories/MessageFactory';
import { expectStatus, expectSuccess, parseJson } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/messages/post-messages-by-message-id-attach-file.yml

/**
 * Sends POST /messages/{messageId}/attach-file without a token, as multipart/form-data with `file` in the `file` field
 * (no file field when undefined), and attaches the request (the file as its name and size) and the response.
 */
async function sendAttach(messagesClient: MessagesClient, messageId: string, file?: MultipartFile): Promise<{ request: MessageRequest; response: ApiResponse }> {
  const request: MessageRequest = {
    method: 'POST',
    path: `/messages/${messageId}/attach-file`,
    auth: AUTH.none,
    body: { contentType: 'multipart/form-data', fields: file ? { file: { name: file.name, size: file.buffer.length } } : {} },
  };
  return sendAndAttach('Attach File', request, () => messagesClient.attachFile(messageId, file));
}

/** The checks of a "Verify the body's errors is a list with the single item "<text>"." step. */
function expectSingleError(request: MessageRequest, response: ApiResponse, text: string): void {
  const body = parseJson<Partial<AttachFileErrors>>(request, response);
  expect(body.errors, assertMessage({ request, expected: `errors is the list ["${text}"]`, actual: body })).toEqual([text]);
}

test.describe('@messages-api - Messages API', () => {
  test('API-0381: Attach an empty txt file to a message returns 200', async ({ messagesService, messagesClient }) => {
    let request: MessageRequest;
    let response: ApiResponse;

    const sent = await createGuestMessage(messagesService);

    await test.step('Send POST /messages/{messageId}/attach-file with that id, without an Authorization header, as multipart/form-data with a file field holding an empty file named "note.txt".', async () => {
      ({ request, response } = await sendAttach(messagesClient, sent.message.id, MessageFactory.emptyFile('note.txt')));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's success is true.", async () => {
      expectSuccess(request, response, true);
    });
  });

  test('API-0382: Attach no file to a message returns 400', async ({ messagesClient }) => {
    let request: MessageRequest;
    let response: ApiResponse;

    await test.step("Send POST /messages/{messageId}/attach-file with a well-formed message id that doesn't exist, as multipart/form-data with no file field.", async () => {
      ({ request, response } = await sendAttach(messagesClient, TestConstants.messages.unknownId));
    });

    await test.step('Verify the response status is 400.', async () => {
      expectStatus(request, response, 400);
    });

    await test.step('Verify the body\'s errors is a list with the single item "No file attached.".', async () => {
      expectSingleError(request, response, 'No file attached.');
    });
  });

  test('API-0383: Attach a non-empty txt file to a message returns 400', async ({ messagesClient }) => {
    let request: MessageRequest;
    let response: ApiResponse;

    await test.step('Send POST /messages/{messageId}/attach-file with a well-formed message id that doesn\'t exist, as multipart/form-data with a file field holding a 1-byte file named "note.txt".', async () => {
      ({ request, response } = await sendAttach(messagesClient, TestConstants.messages.unknownId, MessageFactory.oneByteFile('note.txt')));
    });

    await test.step('Verify the response status is 400.', async () => {
      expectStatus(request, response, 400);
    });

    await test.step('Verify the body\'s errors is a list with the single item "Currently we only allow empty files.".', async () => {
      expectSingleError(request, response, 'Currently we only allow empty files.');
    });
  });

  test('API-0384: Attach an empty pdf file to a message returns 400', async ({ messagesClient }) => {
    let request: MessageRequest;
    let response: ApiResponse;

    await test.step('Send POST /messages/{messageId}/attach-file with a well-formed message id that doesn\'t exist, as multipart/form-data with a file field holding an empty file named "note.pdf".', async () => {
      ({ request, response } = await sendAttach(messagesClient, TestConstants.messages.unknownId, MessageFactory.emptyFile('note.pdf')));
    });

    await test.step('Verify the response status is 400.', async () => {
      expectStatus(request, response, 400);
    });

    await test.step('Verify the body\'s errors is a list with the single item "The file extension is incorrect, we only accept txt files.".', async () => {
      expectSingleError(request, response, 'The file extension is incorrect, we only accept txt files.');
    });
  });

  test('API-0385: Attach a non-empty pdf file to a message reports the empty-file rule first', async ({ messagesClient }) => {
    let request: MessageRequest;
    let response: ApiResponse;

    await test.step('Send POST /messages/{messageId}/attach-file with a well-formed message id that doesn\'t exist, as multipart/form-data with a file field holding a 1-byte file named "note.pdf".', async () => {
      ({ request, response } = await sendAttach(messagesClient, TestConstants.messages.unknownId, MessageFactory.oneByteFile('note.pdf')));
    });

    await test.step('Verify the response status is 400.', async () => {
      expectStatus(request, response, 400);
    });

    await test.step('Verify the body\'s errors is a list with the single item "Currently we only allow empty files.".', async () => {
      expectSingleError(request, response, 'Currently we only allow empty files.');
    });
  });

  test('API-0386: Attach an empty file with the upper-case extension TXT to a message returns 400', async ({ messagesClient }) => {
    let request: MessageRequest;
    let response: ApiResponse;

    await test.step('Send POST /messages/{messageId}/attach-file with a well-formed message id that doesn\'t exist, as multipart/form-data with a file field holding an empty file named "note.TXT".', async () => {
      ({ request, response } = await sendAttach(messagesClient, TestConstants.messages.unknownId, MessageFactory.emptyFile('note.TXT')));
    });

    await test.step('Verify the response status is 400.', async () => {
      expectStatus(request, response, 400);
    });

    await test.step('Verify the body\'s errors is a list with the single item "The file extension is incorrect, we only accept txt files.".', async () => {
      expectSingleError(request, response, 'The file extension is incorrect, we only accept txt files.');
    });
  });

  test('API-0387: Attach an empty txt file to an unknown message id returns 404', async ({ messagesClient }) => {
    test.fail(true, 'Known issue BUG-031: Returns 200 for a message id that doesn\'t exist instead of 404 (the message is never looked up).');
    let request: MessageRequest;
    let response: ApiResponse;

    await test.step('Send POST /messages/{messageId}/attach-file with a well-formed message id that doesn\'t exist, as multipart/form-data with a file field holding an empty file named "note.txt".', async () => {
      ({ request, response } = await sendAttach(messagesClient, TestConstants.messages.unknownId, MessageFactory.emptyFile('note.txt')));
    });

    await test.step('Verify the response status is 404.', async () => {
      expectStatus(request, response, 404);
    });
  });
});
