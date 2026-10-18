import {
  test,
  expect,
  createCustomerInvoice,
  customerAWithInvoiceAndCustomerB,
  sendUpdateInvoice,
  readInvoiceOk,
  expectFieldsEqual,
  INVOICE_AUTH,
  type CustomerInvoice,
  type InvoiceRequest,
} from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { UpdateInvoiceRequest } from '@api/dto/invoice';
import { InvoiceFactory } from '@data/factories/InvoiceFactory';
import { TestConstants } from '@data/TestConstants';
import { expectFieldMessages, expectMessage, expectStatus, expectSuccess } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/invoices/put-invoices-by-invoice-id.yml

/** The keys API-0511 expects in its 422 body. */
const REQUIRED_FIELDS = ['payment_method', 'payment_details', 'billing_street', 'billing_city', 'billing_country', 'cart_id'];

/** The PUT steps that send the create body again ("Stephansplatz 1", "Wien", "AT" and the cart's id), with the token named. */
function samePutStep(target: string, token: string): string {
  return `Send PUT /invoices/{invoiceId} with ${target}, ${token}, payment_method "cash-on-delivery", payment_details {}, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT" and the cart's id as cart_id.`;
}

test.describe('@invoices-api - Invoices API', () => {
  test('API-0509: Update invoice returns 200 and the billing address is changed', async ({
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
    let body: UpdateInvoiceRequest;

    const setup: CustomerInvoice = await createCustomerInvoice({ usersService, adminUsersService, authService, productsService, cartsService, invoicesServiceForToken, cleanup });

    await test.step(
      'Send PUT /invoices/{invoiceId} with the invoice\'s id, that access_token, payment_method "cash-on-delivery", payment_details {}, a unique billing_street of at most 70 characters, billing_city "Graz", billing_country "AT" and the cart\'s id as cart_id.',
      async () => {
        body = InvoiceFactory.cashOnDelivery(setup.cartId, { billing_street: InvoiceFactory.uniqueStreet(), billing_city: 'Graz' });
        ({ request, response } = await sendUpdateInvoice(invoicesClientForToken(setup.token), setup.invoice.id, body, INVOICE_AUTH.throwaway));
      }
    );

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's success is true.", async () => {
      expectSuccess(request, response, true);
    });

    await test.step('Verify GET /invoices/{invoiceId} with that id and token returns 200 with the new billing_street and billing_city "Graz".', async () => {
      const { request: getRequest, invoice } = await readInvoiceOk(invoicesClientForToken(setup.token), setup.invoice.id, INVOICE_AUTH.throwaway);
      expectFieldsEqual(getRequest, invoice, body, ['billing_street', 'billing_city']);
    });
  });

  test('API-0510: Update invoice without a token returns 401', async ({ invoicesClient }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;

    await test.step(
      'Send PUT /invoices/{invoiceId} with a well-formed ULID that no invoice has, payment_method "cash-on-delivery", payment_details {}, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT" and a non-empty string as cart_id, without an Authorization header.',
      async () => {
        const body = InvoiceFactory.cashOnDelivery(TestConstants.carts.unknownId);
        ({ request, response } = await sendUpdateInvoice(invoicesClient, TestConstants.invoices.unknownId, body, INVOICE_AUTH.none));
      }
    );

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test('API-0511: Update invoice without the required fields returns 422 for each of them', async ({
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

    await test.step("Send PUT /invoices/{invoiceId} with the invoice's id, that access_token and an empty JSON object as the body.", async () => {
      ({ request, response } = await sendUpdateInvoice(invoicesClientForToken(setup.token), setup.invoice.id, {}, INVOICE_AUTH.throwaway));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step(
      'Verify the body has the keys payment_method, payment_details, billing_street, billing_city, billing_country and cart_id, each with at least one message.',
      async () => {
        for (const field of REQUIRED_FIELDS) {
          expectFieldMessages(request, response, field);
        }
      }
    );
  });

  test('API-0512: Update invoice with a gift card number that is not 16 characters returns 422', async ({
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
      'Send PUT /invoices/{invoiceId} with the invoice\'s id, that access_token, payment_method "gift-card", payment_details with a 15-character gift_card_number and a 4-character validation_code, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT" and the cart\'s id as cart_id.',
      async () => {
        const body = InvoiceFactory.withPayment(setup.cartId, 'gift-card', InvoiceFactory.giftCardDetails({ gift_card_number: InvoiceFactory.shortGiftCardNumber() }));
        ({ request, response } = await sendUpdateInvoice(invoicesClientForToken(setup.token), setup.invoice.id, body, INVOICE_AUTH.throwaway));
      }
    );

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step('Verify the body has a "payment_details.gift_card_number" key with at least one message.', async () => {
      expectFieldMessages(request, response, 'payment_details.gift_card_number');
    });
  });

  test('API-0513: Update invoice with an unknown id and an invalid body returns 422', async ({ invoicesClientWithToken }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;

    await test.step("Send PUT /invoices/{invoiceId} with a well-formed ULID that no invoice has, the default user's token and an empty JSON object as the body.", async () => {
      ({ request, response } = await sendUpdateInvoice(invoicesClientWithToken, TestConstants.invoices.unknownId, {}, INVOICE_AUTH.defaultUser));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });
  });

  test('API-0514: Update invoice with an unknown id returns 404', async ({ invoicesClientWithToken }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;

    await test.step(
      'Send PUT /invoices/{invoiceId} with a well-formed ULID that no invoice has, the default user\'s token, payment_method "cash-on-delivery", payment_details {}, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT" and a non-empty string as cart_id.',
      async () => {
        const body = InvoiceFactory.cashOnDelivery(TestConstants.carts.unknownId);
        ({ request, response } = await sendUpdateInvoice(invoicesClientWithToken, TestConstants.invoices.unknownId, body, INVOICE_AUTH.defaultUser));
      }
    );

    await test.step('Verify the response status is 404.', async () => {
      expectStatus(request, response, 404);
    });

    await test.step('Verify the body\'s message is "Requested item not found".', async () => {
      expectMessage(request, response, 'Requested item not found');
    });
  });

  test("API-0515: Update another customer's invoice returns 404", async ({
    usersService,
    adminUsersService,
    authService,
    cartsService,
    invoicesServiceForToken,
    invoicesClientForToken,
    cleanup,
  }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;

    const { tokenB, cartId, invoice } = await customerAWithInvoiceAndCustomerB({ usersService, adminUsersService, authService, cartsService, invoicesServiceForToken, cleanup });

    await test.step(samePutStep('that id', "customer B's access_token"), async () => {
      ({ request, response } = await sendUpdateInvoice(invoicesClientForToken(tokenB), invoice.id, InvoiceFactory.cashOnDelivery(cartId), INVOICE_AUTH.customerB));
    });

    await test.step('Verify the response status is 404.', async () => {
      expectStatus(request, response, 404);
    });

    await test.step('Verify the body\'s message is "Requested item not found".', async () => {
      expectMessage(request, response, 'Requested item not found');
    });
  });

  test.describe(() => {
    test.use({ role: 'admin' });

    test("API-0516: Update another customer's invoice as an admin returns 404", async ({
      usersService,
      adminUsersService,
      authService,
      productsService,
      cartsService,
      invoicesServiceForToken,
      invoicesClientWithToken,
      cleanup,
    }) => {
      let request: InvoiceRequest;
      let response: ApiResponse;

      const setup: CustomerInvoice = await createCustomerInvoice({ usersService, adminUsersService, authService, productsService, cartsService, invoicesServiceForToken, cleanup });

      await test.step(samePutStep("the invoice's id", "the admin's token"), async () => {
        ({ request, response } = await sendUpdateInvoice(invoicesClientWithToken, setup.invoice.id, InvoiceFactory.cashOnDelivery(setup.cartId), INVOICE_AUTH.admin));
      });

      await test.step('Verify the response status is 404.', async () => {
        expectStatus(request, response, 404);
      });

      await test.step('Verify the body\'s message is "Requested item not found".', async () => {
        expectMessage(request, response, 'Requested item not found');
      });
    });
  });

  test('API-0517: Update invoice with a total in the body leaves the total unchanged', async ({
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
    test.fail(true, 'Known issue BUG-039: Writes the unvalidated total from the body (and other fillable keys such as user_id) instead of ignoring them.');

    await test.step(
      'Send PUT /invoices/{invoiceId} with the invoice\'s id, that access_token, payment_method "cash-on-delivery", payment_details {}, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT", the cart\'s id as cart_id and a total different from the invoice\'s total.',
      async () => {
        // The call under test: the Verify step reads what it did, whatever it answered.
        const body = { ...InvoiceFactory.cashOnDelivery(setup.cartId), total: setup.invoice.total + 1 };
        await sendUpdateInvoice(invoicesClientForToken(setup.token), setup.invoice.id, body, INVOICE_AUTH.throwaway);
      }
    );

    await test.step('Verify GET /invoices/{invoiceId} with that id and token returns a total equal to the total from the create response.', async () => {
      const { request, invoice } = await readInvoiceOk(invoicesClientForToken(setup.token), setup.invoice.id, INVOICE_AUTH.throwaway);
      expect(Number(invoice.total), assertMessage({ request, expected: `total is the created total ${setup.invoice.total}`, actual: { total: invoice.total } })).toBe(
        setup.invoice.total
      );
    });
  });
});
