import { test, expect, AUTH, createCustomerInvoice, customerAWithInvoiceAndCustomerB, sendPatchInvoice, readInvoiceOk, expectFieldsEqual, type CustomerInvoice, type InvoiceRequest, type InvoiceSetupFixtures, checkStatusAndMessage } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { InvoicesClient } from '@api/clients/InvoicesClient';
import type { PatchInvoiceRequest } from '@api/dto/invoice';
import { InvoiceFactory } from '@data/factories/InvoiceFactory';
import { TestConstants } from '@data/TestConstants';
import { expectFieldMessages, expectMessage, expectStatus, expectSuccess } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/invoices/patch-invoices-by-invoice-id.yml

/**
 * A validation scenario on the customer's own invoice: the setup steps, the PATCH (title `title`) with `body`,
 * "Verify the response status is 422." and "Verify the body has a <field> key with at least one message.".
 */
async function expectPatchValidationError(
  fixtures: InvoiceSetupFixtures,
  invoicesClientForToken: (token: string) => InvoicesClient,
  title: string,
  body: PatchInvoiceRequest | Record<string, unknown>,
  field: string,
  verifyTitle: string
): Promise<void> {
  let request: InvoiceRequest;
  let response: ApiResponse;

  const setup: CustomerInvoice = await createCustomerInvoice(fixtures);

  await test.step(title, async () => {
    ({ request, response } = await sendPatchInvoice(invoicesClientForToken(setup.token), setup.invoice.id, body, AUTH.newUser));
  });

  await test.step('Verify the response status is 422.', async () => {
    expectStatus(request, response, 422);
  });

  await test.step(verifyTitle, async () => {
    expectFieldMessages(request, response, field);
  });
}

test.describe('@invoices-api - Invoices API', () => {
  test('API-0518: Partially update invoice returns 200 and the billing street is changed', async ({
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
    const body: PatchInvoiceRequest = { billing_street: InvoiceFactory.uniqueStreet() };

    const setup: CustomerInvoice = await createCustomerInvoice({ usersService, adminUsersService, authService, productsService, cartsService, invoicesServiceForToken, cleanup });

    await test.step(
      "Send PATCH /invoices/{invoiceId} with the invoice's id, that access_token and a body with a unique billing_street of at most 70 characters.",
      async () => {
        ({ request, response } = await sendPatchInvoice(invoicesClientForToken(setup.token), setup.invoice.id, body, AUTH.newUser));
      }
    );

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's success is true.", async () => {
      expectSuccess(request, response, true);
    });

    await test.step('Verify GET /invoices/{invoiceId} with that id and token returns 200 with the new billing_street.', async () => {
      const { request: getRequest, invoice } = await readInvoiceOk(invoicesClientForToken(setup.token), setup.invoice.id, AUTH.newUser);
      expectFieldsEqual(getRequest, invoice, body, ['billing_street']);
    });
  });

  test('API-0519: Partially update invoice with an empty body returns 200 and changes nothing', async ({
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

    await test.step("Send PATCH /invoices/{invoiceId} with the invoice's id, that access_token and an empty JSON object as the body.", async () => {
      ({ request, response } = await sendPatchInvoice(invoicesClientForToken(setup.token), setup.invoice.id, {}, AUTH.newUser));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's success is true.", async () => {
      expectSuccess(request, response, true);
    });

    await test.step(
      'Verify GET /invoices/{invoiceId} with that id and token returns 200 with billing_street "Stephansplatz 1", billing_city "Wien" and billing_country "AT".',
      async () => {
        const { request: getRequest, invoice } = await readInvoiceOk(invoicesClientForToken(setup.token), setup.invoice.id, AUTH.newUser);
        expectFieldsEqual(getRequest, invoice, { billing_street: 'Stephansplatz 1', billing_city: 'Wien', billing_country: 'AT' }, [
          'billing_street',
          'billing_city',
          'billing_country',
        ]);
      }
    );
  });

  test('API-0520: Partially update invoice with an invoice_date returns 200', async ({
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

    await test.step('Send PATCH /invoices/{invoiceId} with the invoice\'s id, that access_token and a body with invoice_date "2026-01-15".', async () => {
      ({ request, response } = await sendPatchInvoice(invoicesClientForToken(setup.token), setup.invoice.id, { invoice_date: '2026-01-15' }, AUTH.newUser));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's success is true.", async () => {
      expectSuccess(request, response, true);
    });

    await test.step('Verify GET /invoices/{invoiceId} with that id and token returns 200 with an invoice_date that contains "2026-01-15".', async () => {
      const { request: getRequest, invoice } = await readInvoiceOk(invoicesClientForToken(setup.token), setup.invoice.id, AUTH.newUser);
      expect(invoice.invoice_date, assertMessage({ request: getRequest, expected: 'invoice_date contains "2026-01-15"', actual: { invoice_date: invoice.invoice_date } })).toContain(
        '2026-01-15'
      );
    });
  });

  test('API-0521: Partially update invoice without a token returns 401', async ({ invoicesClient }) => {
    await checkStatusAndMessage(
      'Send PATCH /invoices/{invoiceId} with a well-formed ULID that no invoice has and a body with billing_street "Stephansplatz 1", without an Authorization header.',
      () => sendPatchInvoice(invoicesClient, TestConstants.invoices.unknownId, InvoiceFactory.patchBody(), AUTH.none),
      401,
      'Unauthorized'
    );
  });

  test('API-0522: Partially update invoice with a billing street longer than 70 characters returns 422', async ({
    usersService,
    adminUsersService,
    authService,
    productsService,
    cartsService,
    invoicesServiceForToken,
    invoicesClientForToken,
    cleanup,
  }) => {
    await expectPatchValidationError(
      { usersService, adminUsersService, authService, productsService, cartsService, invoicesServiceForToken, cleanup },
      invoicesClientForToken,
      "Send PATCH /invoices/{invoiceId} with the invoice's id, that access_token and a body with a 71-character billing_street.",
      { billing_street: InvoiceFactory.tooLongStreet() },
      'billing_street',
      'Verify the body has a billing_street key with at least one message.'
    );
  });

  test('API-0523: Partially update invoice with a billing street that is not a string returns 422', async ({
    usersService,
    adminUsersService,
    authService,
    productsService,
    cartsService,
    invoicesServiceForToken,
    invoicesClientForToken,
    cleanup,
  }) => {
    await expectPatchValidationError(
      { usersService, adminUsersService, authService, productsService, cartsService, invoicesServiceForToken, cleanup },
      invoicesClientForToken,
      "Send PATCH /invoices/{invoiceId} with the invoice's id, that access_token and a body with billing_street 12345 (a number).",
      { billing_street: 12345 },
      'billing_street',
      'Verify the body has a billing_street key with at least one message.'
    );
  });

  test('API-0524: Partially update invoice with an invoice_date that is not Y-m-d returns 422', async ({
    usersService,
    adminUsersService,
    authService,
    productsService,
    cartsService,
    invoicesServiceForToken,
    invoicesClientForToken,
    cleanup,
  }) => {
    await expectPatchValidationError(
      { usersService, adminUsersService, authService, productsService, cartsService, invoicesServiceForToken, cleanup },
      invoicesClientForToken,
      'Send PATCH /invoices/{invoiceId} with the invoice\'s id, that access_token and a body with invoice_date "15/01/2026".',
      { invoice_date: '15/01/2026' },
      'invoice_date',
      'Verify the body has an invoice_date key with at least one message.'
    );
  });

  test('API-0525: Partially update invoice with a superscript character in the billing street returns 422', async ({
    usersService,
    adminUsersService,
    authService,
    productsService,
    cartsService,
    invoicesServiceForToken,
    invoicesClientForToken,
    cleanup,
  }) => {
    await expectPatchValidationError(
      { usersService, adminUsersService, authService, productsService, cartsService, invoicesServiceForToken, cleanup },
      invoicesClientForToken,
      "Send PATCH /invoices/{invoiceId} with the invoice's id, that access_token and a body with a billing_street containing the superscript digit four (U+2074).",
      { billing_street: InvoiceFactory.superscriptStreet() },
      'billing_street',
      'Verify the body has a billing_street key with at least one message.'
    );
  });

  test('API-0526: Partially update invoice with an unknown id and an invalid body returns 422', async ({ invoicesClientWithToken }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;

    await test.step(
      "Send PATCH /invoices/{invoiceId} with a well-formed ULID that no invoice has, the default user's token and a body with a 71-character billing_street.",
      async () => {
        ({ request, response } = await sendPatchInvoice(
          invoicesClientWithToken,
          TestConstants.invoices.unknownId,
          { billing_street: InvoiceFactory.tooLongStreet() },
          AUTH.defaultUser
        ));
      }
    );

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });
  });

  test('API-0527: Partially update invoice with an unknown id returns 404', async ({ invoicesClientWithToken }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;

    await test.step(
      'Send PATCH /invoices/{invoiceId} with a well-formed ULID that no invoice has, the default user\'s token and a body with billing_street "Stephansplatz 1".',
      async () => {
        ({ request, response } = await sendPatchInvoice(
          invoicesClientWithToken,
          TestConstants.invoices.unknownId,
          InvoiceFactory.patchBody(),
          AUTH.defaultUser
        ));
      }
    );

    await test.step('Verify the response status is 404.', async () => {
      expectStatus(request, response, 404);
    });

    await test.step('Verify the body\'s message is "Requested item not found".', async () => {
      expectMessage(request, response, 'Requested item not found');
    });
  });

  test("API-0528: Partially update another customer's invoice returns 404", async ({
    usersService,
    adminUsersService,
    authService,
    cartsService,
    invoicesServiceForToken,
    invoicesClientForToken,
    cleanup,
  }) => {
    const { tokenB, invoice } = await customerAWithInvoiceAndCustomerB({ usersService, adminUsersService, authService, cartsService, invoicesServiceForToken, cleanup });

    await checkStatusAndMessage(
      'Send PATCH /invoices/{invoiceId} with that id, customer B\'s access_token and a body with billing_street "Stephansplatz 1".',
      () => sendPatchInvoice(invoicesClientForToken(tokenB), invoice.id, InvoiceFactory.patchBody(), AUTH.customerB),
      404,
      'Requested item not found'
    );
  });
});
