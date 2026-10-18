import { test, expect, AUTH, createCustomerInvoice, customerAWithInvoiceAndCustomerB, setInvoiceStatusSetup, sendUpdateInvoiceStatus, readInvoiceOk, type CustomerInvoice, type InvoiceRequest, type InvoiceSetupFixtures, checkStatusAndMessage } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { InvoicesClient } from '@api/clients/InvoicesClient';
import { TestConstants } from '@data/TestConstants';
import { InvoiceFactory } from '@data/factories/InvoiceFactory';
import { expectErrorKeys, expectStatus, expectSuccess } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/invoices/put-invoices-by-invoice-id-status.yml

/**
 * A validation scenario on the customer's own invoice: the setup steps, the status PUT (title `title`) with `body`,
 * "Verify the response status is 422." and "Verify the body's errors has a <field> key with at least one message.".
 * The client sends `Accept: application/json`, which this endpoint's inline validation needs for a JSON 422.
 */
async function expectStatusValidationError(
  fixtures: InvoiceSetupFixtures,
  invoicesClientForToken: (token: string) => InvoicesClient,
  title: string,
  body: Record<string, unknown>,
  field: string
): Promise<void> {
  let request: InvoiceRequest;
  let response: ApiResponse;

  const setup: CustomerInvoice = await createCustomerInvoice(fixtures);

  await test.step(title, async () => {
    ({ request, response } = await sendUpdateInvoiceStatus(invoicesClientForToken(setup.token), setup.invoice.id, body, AUTH.newUser));
  });

  await test.step('Verify the response status is 422.', async () => {
    expectStatus(request, response, 422);
  });

  await test.step(`Verify the body's errors has a ${field} key with at least one message.`, async () => {
    expectErrorKeys(request, response, [field]);
  });
}

test.describe('@invoices-api - Invoices API', () => {
  test('API-0474: Update invoice status returns 200 and the invoice has the new status and message', async ({
    usersService,
    adminUsersService,
    authService,
    productsService,
    cartsService,
    invoicesServiceForToken,
    invoicesClientForToken,
    cleanup,
  }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;

    const setup: CustomerInvoice = await createCustomerInvoice({ usersService, adminUsersService, authService, productsService, cartsService, invoicesServiceForToken, cleanup });

    await test.step(
      'Send PUT /invoices/{invoiceId}/status with the invoice\'s id, that access_token and a body with status "ON_HOLD" and status_message "Waiting for the bank".',
      async () => {
        ({ request, response } = await sendUpdateInvoiceStatus(
          invoicesClientForToken(setup.token),
          setup.invoice.id,
          InvoiceFactory.statusBody('ON_HOLD', { status_message: 'Waiting for the bank' }),
          AUTH.newUser
        ));
      }
    );

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's success is true.", async () => {
      expectSuccess(request, response, true);
    });

    await test.step(
      'Verify GET /invoices/{invoiceId} with that id and token returns 200 with status "ON_HOLD" and status_message "Waiting for the bank".',
      async () => {
        const { request: getRequest, invoice } = await readInvoiceOk(invoicesClientForToken(setup.token), setup.invoice.id, AUTH.newUser);
        const actual = { status: invoice.status, status_message: invoice.status_message };
        expect(invoice.status, assertMessage({ request: getRequest, expected: 'status is "ON_HOLD"', actual })).toBe('ON_HOLD');
        expect(invoice.status_message, assertMessage({ request: getRequest, expected: 'status_message is "Waiting for the bank"', actual })).toBe('Waiting for the bank');
      }
    );
  });

  test('API-0475: Update invoice status with a null message returns 200 and clears the message', async ({
    usersService,
    adminUsersService,
    authService,
    productsService,
    cartsService,
    invoicesServiceForToken,
    invoicesClientForToken,
    cleanup,
  }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;

    const setup: CustomerInvoice = await createCustomerInvoice({ usersService, adminUsersService, authService, productsService, cartsService, invoicesServiceForToken, cleanup });
    await setInvoiceStatusSetup(
      invoicesServiceForToken(setup.token),
      setup.invoice.id,
      { status_message: 'Waiting for the bank' },
      'Send PUT /invoices/{invoiceId}/status with the invoice\'s id, that access_token and a body with status_message "Waiting for the bank".',
      AUTH.newUser
    );

    await test.step("Send PUT /invoices/{invoiceId}/status with the invoice's id, that access_token and a body with status_message null.", async () => {
      ({ request, response } = await sendUpdateInvoiceStatus(invoicesClientForToken(setup.token), setup.invoice.id, { status_message: null }, AUTH.newUser));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's success is true.", async () => {
      expectSuccess(request, response, true);
    });

    await test.step('Verify GET /invoices/{invoiceId} with that id and token returns 200 with status_message null.', async () => {
      const { request: getRequest, invoice } = await readInvoiceOk(invoicesClientForToken(setup.token), setup.invoice.id, AUTH.newUser);
      expect(invoice.status_message, assertMessage({ request: getRequest, expected: 'status_message is null', actual: { status_message: invoice.status_message } })).toBeNull();
    });
  });

  test('API-0476: Update invoice status without a token returns 401', async ({ invoicesClient }) => {
    await checkStatusAndMessage(
      'Send PUT /invoices/{invoiceId}/status with a well-formed ULID that no invoice has and a body with status "ON_HOLD", without an Authorization header.',
      () => sendUpdateInvoiceStatus(invoicesClient, TestConstants.invoices.unknownId, InvoiceFactory.statusBody('ON_HOLD'), AUTH.none),
      401,
      'Unauthorized'
    );
  });

  test('API-0477: Update invoice status with an invalid status returns 422', async ({
    usersService,
    adminUsersService,
    authService,
    productsService,
    cartsService,
    invoicesServiceForToken,
    invoicesClientForToken,
    cleanup,
  }) => {
    await expectStatusValidationError(
      { usersService, adminUsersService, authService, productsService, cartsService, invoicesServiceForToken, cleanup },
      invoicesClientForToken,
      'Send PUT /invoices/{invoiceId}/status with the invoice\'s id, that access_token, Accept: application/json and a body with status "NOT_A_STATUS".',
      InvoiceFactory.statusBody('NOT_A_STATUS'),
      'status'
    );
  });

  test('API-0478: Update invoice status with a message shorter than 5 characters returns 422', async ({
    usersService,
    adminUsersService,
    authService,
    productsService,
    cartsService,
    invoicesServiceForToken,
    invoicesClientForToken,
    cleanup,
  }) => {
    await expectStatusValidationError(
      { usersService, adminUsersService, authService, productsService, cartsService, invoicesServiceForToken, cleanup },
      invoicesClientForToken,
      "Send PUT /invoices/{invoiceId}/status with the invoice's id, that access_token, Accept: application/json and a body with status_message of 4 characters.",
      { status_message: 'Wait' },
      'status_message'
    );
  });

  test('API-0479: Update invoice status with a message longer than 50 characters returns 422', async ({
    usersService,
    adminUsersService,
    authService,
    productsService,
    cartsService,
    invoicesServiceForToken,
    invoicesClientForToken,
    cleanup,
  }) => {
    await expectStatusValidationError(
      { usersService, adminUsersService, authService, productsService, cartsService, invoicesServiceForToken, cleanup },
      invoicesClientForToken,
      "Send PUT /invoices/{invoiceId}/status with the invoice's id, that access_token, Accept: application/json and a body with status_message of 51 characters.",
      { status_message: 'x'.repeat(51) },
      'status_message'
    );
  });

  test('API-0480: Update invoice status with a message that is not a string returns 422', async ({
    usersService,
    adminUsersService,
    authService,
    productsService,
    cartsService,
    invoicesServiceForToken,
    invoicesClientForToken,
    cleanup,
  }) => {
    await expectStatusValidationError(
      { usersService, adminUsersService, authService, productsService, cartsService, invoicesServiceForToken, cleanup },
      invoicesClientForToken,
      "Send PUT /invoices/{invoiceId}/status with the invoice's id, that access_token, Accept: application/json and a body with status_message 12345 (a number).",
      { status_message: 12345 },
      'status_message'
    );
  });

  test('API-0481: Update invoice status with an unknown id returns 404', async ({ invoicesClientWithToken }) => {
    await checkStatusAndMessage(
      'Send PUT /invoices/{invoiceId}/status with a well-formed ULID that no invoice has, the default user\'s token and a body with status "ON_HOLD".',
      () => sendUpdateInvoiceStatus(invoicesClientWithToken, TestConstants.invoices.unknownId, InvoiceFactory.statusBody('ON_HOLD'), AUTH.defaultUser),
      404,
      'Invoice not found'
    );
  });

  test("API-0482: Update invoice status of another customer's invoice leaves it unchanged", async ({
    usersService,
    adminUsersService,
    authService,
    cartsService,
    invoicesServiceForToken,
    invoicesClientForToken,
    cleanup,
  }) => {
    const { tokenA, tokenB, invoice } = await customerAWithInvoiceAndCustomerB({ usersService, adminUsersService, authService, cartsService, invoicesServiceForToken, cleanup });
    test.fail(true, "Known issue BUG-037: Any logged-in customer can change the status of another customer's invoice (the call succeeds) instead of being refused.");

    await test.step('Send PUT /invoices/{invoiceId}/status with that id, customer B\'s access_token and a body with status "COMPLETED".', async () => {
      // The call under test: the Verify step reads what it did, whatever it answered.
      await sendUpdateInvoiceStatus(invoicesClientForToken(tokenB), invoice.id, InvoiceFactory.statusBody('COMPLETED'), AUTH.customerB);
    });

    await test.step('Verify GET /invoices/{invoiceId} with that id and customer A\'s access_token returns a status other than "COMPLETED".', async () => {
      const { request, invoice: read } = await readInvoiceOk(invoicesClientForToken(tokenA), invoice.id, AUTH.customerA);
      expect(read.status, assertMessage({ request, expected: 'status is not "COMPLETED"', actual: { status: read.status } })).not.toBe('COMPLETED');
    });
  });

  test('API-0483: Update invoice status with a total in the body leaves the total unchanged', async ({
    usersService,
    adminUsersService,
    authService,
    productsService,
    cartsService,
    invoicesServiceForToken,
    invoicesClientForToken,
    cleanup,
  }) => {
    const setup: CustomerInvoice = await createCustomerInvoice({ usersService, adminUsersService, authService, productsService, cartsService, invoicesServiceForToken, cleanup });
    test.fail(true, 'Known issue BUG-038: Writes any column sent in the body (the total is changed) instead of only status and status_message.');

    await test.step(
      'Send PUT /invoices/{invoiceId}/status with the invoice\'s id, that access_token and a body with status "ON_HOLD" and a total different from the invoice\'s total.',
      async () => {
        // The call under test: the Verify step reads what it did, whatever it answered.
        await sendUpdateInvoiceStatus(
          invoicesClientForToken(setup.token),
          setup.invoice.id,
          InvoiceFactory.statusBody('ON_HOLD', { total: setup.invoice.total + 1 }),
          AUTH.newUser
        );
      }
    );

    await test.step('Verify GET /invoices/{invoiceId} with that id and token returns a total equal to the total from the create response.', async () => {
      const { request, invoice } = await readInvoiceOk(invoicesClientForToken(setup.token), setup.invoice.id, AUTH.newUser);
      expect(Number(invoice.total), assertMessage({ request, expected: `total is the created total ${setup.invoice.total}`, actual: { total: invoice.total } })).toBe(
        setup.invoice.total
      );
    });
  });

  test('API-0484: Update invoice status with an unknown key in the body does not return 500', async ({
    usersService,
    adminUsersService,
    authService,
    productsService,
    cartsService,
    invoicesServiceForToken,
    invoicesClientForToken,
    cleanup,
  }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;

    const setup: CustomerInvoice = await createCustomerInvoice({ usersService, adminUsersService, authService, productsService, cartsService, invoicesServiceForToken, cleanup });
    test.fail(true, 'Known issue BUG-038: Returns 500 for a body key that is not a column of invoices instead of 422 or ignoring the key.');

    await test.step(
      'Send PUT /invoices/{invoiceId}/status with the invoice\'s id, that access_token, Accept: application/json and a body with status "ON_HOLD" and a key no_such_column with the value "x".',
      async () => {
        ({ request, response } = await sendUpdateInvoiceStatus(
          invoicesClientForToken(setup.token),
          setup.invoice.id,
          InvoiceFactory.statusBody('ON_HOLD', { no_such_column: 'x' }),
          AUTH.newUser
        ));
      }
    );

    await test.step('Verify the response status is 200 or 422.', async () => {
      expect([200, 422], assertMessage({ request, expected: 'Status 200 or 422', actual: { status: response.status, body: response.body.slice(0, 500) } })).toContain(
        response.status
      );
    });
  });
});
