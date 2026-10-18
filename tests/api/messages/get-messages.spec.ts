import { test, expect, AUTH, registerThrowawayCustomer, loginThrowawayCustomer, createCustomerMessage, sendMessageSetup, sendListMessages, expectListStatus, messagePageSummary, type MessageRequest, disableCustomerSetup } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { Paginated } from '@api/dto/common';
import type { ContactMessageListItem } from '@api/dto/message';
import { expectMessage, PAGE_KEYS, parseJson } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/messages/get-messages.yml

/** Parses a GET /messages page (call after its status was checked). */
function parsePage(response: ApiResponse): Paginated<ContactMessageListItem> {
  return parseJson<Paginated<ContactMessageListItem>>(undefined, response);
}

/** The checks of a "Verify the body's data is an empty array." step. */
function expectEmptyData(request: MessageRequest, response: ApiResponse): void {
  const page = parsePage(response);
  expect(
    Array.isArray(page.data) && page.data.length === 0,
    assertMessage({ request, expected: "The body's data is an empty array", actual: messagePageSummary(page) })
  ).toBe(true);
}

test.describe('@messages-api - Messages API', () => {
  test("API-0343: List messages as a customer returns 200 with only the customer's own messages", async ({
    usersService,
    adminUsersService,
    authService,
    messagesService,
    messagesServiceForToken,
    messagesClientForToken,
    cleanup,
  }) => {
    let request: MessageRequest;
    let response: ApiResponse;
    let page: Paginated<ContactMessageListItem>;

    const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup);
    const token = await loginThrowawayCustomer(authService, customer);
    const sent = await createCustomerMessage(messagesServiceForToken(token));
    await sendMessageSetup(
      messagesService,
      'Send POST /messages without an Authorization header, with a unique subject and a message text (a guest message).',
      AUTH.none
    );

    await test.step("Send GET /messages with the throwaway customer's access_token.", async () => {
      ({ request, response } = await sendListMessages(messagesClientForToken(token), AUTH.throwaway));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectListStatus(request, response, 200);
    });

    await test.step('Verify the body has the keys current_page, data, from, last_page, per_page, to and total, and its per_page is 15.', async () => {
      page = parsePage(response);
      for (const key of PAGE_KEYS) {
        expect(key in page, assertMessage({ request, expected: `The body has the key "${key}"`, actual: Object.keys(page) })).toBe(true);
      }
      expect(page.per_page, assertMessage({ request, expected: 'per_page is 15', actual: page.per_page })).toBe(15);
    });

    await test.step('Verify the body\'s total is 1 and its data has exactly one item, with the customer\'s message id as id, the new user\'s id as user_id and status "NEW".', async () => {
      const actual = messagePageSummary(page);
      expect(page.total, assertMessage({ request, expected: 'total is 1', actual })).toBe(1);
      expect(Array.isArray(page.data) && page.data.length === 1, assertMessage({ request, expected: 'data has exactly one item', actual })).toBe(true);
      const item = page.data[0]!;
      expect(item.id, assertMessage({ request, expected: `The item's id is the customer's message id ${sent.message.id}`, actual })).toBe(sent.message.id);
      expect(item.user_id, assertMessage({ request, expected: `The item's user_id is the new user's id ${customer.id}`, actual })).toBe(customer.id);
      expect(item.status, assertMessage({ request, expected: 'The item\'s status is "NEW"', actual })).toBe('NEW');
    });

    await test.step("Verify that item's subject and message equal the values sent and it has no user key.", async () => {
      const item = page.data[0]!;
      expect(item.subject, assertMessage({ request, expected: `subject is the one sent, "${sent.body.subject}"`, actual: item })).toBe(sent.body.subject);
      expect(item.message, assertMessage({ request, expected: `message is the one sent, "${sent.body.message}"`, actual: item })).toBe(sent.body.message);
      expect('user' in item, assertMessage({ request, expected: 'The item has no user key', actual: Object.keys(item) })).toBe(false);
    });
  });

  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0344: List messages as an admin includes guest and customer messages, each with its sender', async ({
      usersService,
      adminUsersService,
      authService,
      messagesService,
      messagesServiceForToken,
      messagesClientWithToken,
      cleanup,
    }) => {
      let request: MessageRequest;
      let response: ApiResponse;
      let page: Paginated<ContactMessageListItem>;

      const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup);
      const token = await loginThrowawayCustomer(authService, customer);
      const customerMessage = await createCustomerMessage(
        messagesServiceForToken(token),
        "Send POST /messages with that token, a unique subject and a message text, and take the new message's id as the customer message's id."
      );
      const guestMessage = await sendMessageSetup(
        messagesService,
        "Send POST /messages without an Authorization header, with a unique subject and a message text, and take the new message's id as the guest message's id.",
        AUTH.none
      );

      await test.step("Send GET /messages with the admin's token.", async () => {
        ({ request, response } = await sendListMessages(messagesClientWithToken, AUTH.admin));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectListStatus(request, response, 200);
      });

      await test.step("Verify the body's data (newest first, so page 1) includes an item with the customer message's id, the new user's id as user_id and a user object whose id is the new user's id.", async () => {
        page = parsePage(response);
        const actual = messagePageSummary(page);
        const item = page.data.find((entry) => entry.id === customerMessage.message.id);
        expect(item, assertMessage({ request, expected: `data includes the customer message ${customerMessage.message.id}`, actual })).toBeDefined();
        expect(item!.user_id, assertMessage({ request, expected: `Its user_id is the new user's id ${customer.id}`, actual })).toBe(customer.id);
        expect(item!.user?.id, assertMessage({ request, expected: `Its user is an object whose id is the new user's id ${customer.id}`, actual })).toBe(customer.id);
      });

      await test.step("Verify the body's data includes an item with the guest message's id, with user_id null and user null.", async () => {
        const actual = messagePageSummary(page);
        const item = page.data.find((entry) => entry.id === guestMessage.message.id);
        expect(item, assertMessage({ request, expected: `data includes the guest message ${guestMessage.message.id}`, actual })).toBeDefined();
        expect(item!.user_id, assertMessage({ request, expected: 'Its user_id is null', actual })).toBeNull();
        // A condition, not toBeNull(): the matcher's diff would print a linked user's full admin-view profile.
        expect(item!.user === null, assertMessage({ request, expected: 'Its user is null', actual })).toBe(true);
      });
    });
  });

  test('API-0345: List messages with a page past the last returns 200 with an empty data', async ({
    usersService,
    adminUsersService,
    authService,
    messagesServiceForToken,
    messagesClientForToken,
    cleanup,
  }) => {
    let request: MessageRequest;
    let response: ApiResponse;

    const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup);
    const token = await loginThrowawayCustomer(authService, customer);
    await createCustomerMessage(messagesServiceForToken(token), 'Send POST /messages with that token, a unique subject and a message text.');

    await test.step('Send GET /messages with page 2 and that token.', async () => {
      ({ request, response } = await sendListMessages(messagesClientForToken(token), AUTH.throwaway, 2));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectListStatus(request, response, 200);
    });

    await test.step("Verify the body's data is an empty array.", async () => {
      expectEmptyData(request, response);
    });
  });

  test('API-0346: List messages without a token returns 401', async ({ messagesClient }) => {
    let request: MessageRequest;
    let response: ApiResponse;

    await test.step('Send GET /messages without an Authorization header.', async () => {
      ({ request, response } = await sendListMessages(messagesClient, AUTH.none));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectListStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test('API-0347: List messages with a malformed token returns 401', async ({ messagesClientWithInvalidToken }) => {
    let request: MessageRequest;
    let response: ApiResponse;

    await test.step('Send GET /messages with a malformed token.', async () => {
      ({ request, response } = await sendListMessages(messagesClientWithInvalidToken, AUTH.malformed));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectListStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test.describe(() => {
    test.use({ role: 'admin' });

    test("API-0348: List messages with a disabled account's token returns 403", async ({
      usersService,
      adminUsersService,
      authService,
      messagesClientForToken,
      cleanup,
    }) => {
      let request: MessageRequest;
      let response: ApiResponse;

      const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup);
      const token = await loginThrowawayCustomer(authService, customer);

      // The throwaway's token isn't used before this call, so the API's cached user can't be a stale, enabled one.
      await disableCustomerSetup(adminUsersService, customer.id, "Send PATCH /users/{userId} with that id and enabled false, with the admin's token.", AUTH.admin);

      await test.step("Send GET /messages with the throwaway customer's access_token.", async () => {
        ({ request, response } = await sendListMessages(messagesClientForToken(token), AUTH.throwaway));
      });

      await test.step('Verify the response status is 403.', async () => {
        expectListStatus(request, response, 403);
      });

      await test.step('Verify the body\'s message is "Account disabled.".', async () => {
        expectMessage(request, response, 'Account disabled.');
      });
    });
  });

  test('API-0349: List messages of a customer without messages returns 200 with an empty list', async ({
    usersService,
    adminUsersService,
    authService,
    messagesClientForToken,
    cleanup,
  }) => {
    let request: MessageRequest;
    let response: ApiResponse;

    const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup);
    const token = await loginThrowawayCustomer(authService, customer);

    await test.step('Send GET /messages with that token.', async () => {
      ({ request, response } = await sendListMessages(messagesClientForToken(token), AUTH.throwaway));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectListStatus(request, response, 200);
    });

    await test.step("Verify the body's data is an empty array.", async () => {
      expectEmptyData(request, response);
    });
  });
});
