import { test, expect, AUTH, createCart, createCustomerInvoice, customerAWithInvoiceAndCustomerB, setInvoiceStatusSetup, sendSearchInvoices, invoiceSummary, invoicePageSummary, expectKeys, expectOnlyInvoice, expectEmptyInvoicePage, createGuestInvoiceSetup, type CustomerInvoice, type InvoiceRequest } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { Paginated } from '@api/dto/common';
import type { InvoiceSummary } from '@api/dto/invoice';
import { InvoiceFactory } from '@data/factories/InvoiceFactory';
import { uniqueName } from '@data/factories/testDataUtils';
import { expectMessage, expectStatus, PAGE_KEYS } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/invoices/get-invoices-search.yml

/** Customer A's invoice-create step in API-0454. */
const CUSTOMER_A_INVOICE_NUMBER_STEP =
  'Send POST /invoices with customer A\'s access_token, payment_method "cash-on-delivery", payment_details {}, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT" and the cart\'s id as cart_id, and take the new invoice\'s invoice_number.';

test.describe('@invoices-api - Invoices API', () => {
  test('API-0449: Search invoices by invoice number returns 200 with the matching invoice', async ({
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
    let page: Paginated<InvoiceSummary>;

    const setup: CustomerInvoice = await createCustomerInvoice({ usersService, adminUsersService, authService, productsService, cartsService, invoicesServiceForToken, cleanup });

    await test.step("Send GET /invoices/search with q set to the invoice's number and that access_token.", async () => {
      ({ request, response } = await sendSearchInvoices(invoicesClientForToken(setup.token), AUTH.newUser, setup.invoice.invoice_number));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the body has the keys current_page, data, from, last_page, per_page, to and total.', async () => {
      page = JSON.parse(response.body) as Paginated<InvoiceSummary>;
      expectKeys(request, page, PAGE_KEYS);
    });

    await test.step(
      "Verify the body's total is 1 and data has exactly one item, whose id is the new invoice's id and invoice_number is the invoice's number.",
      async () => {
        const item = expectOnlyInvoice(request, page, setup.invoice.id);
        expect(
          item.invoice_number,
          assertMessage({ request, expected: `invoice_number is the invoice's ${setup.invoice.invoice_number}`, actual: invoiceSummary(item) })
        ).toBe(setup.invoice.invoice_number);
      }
    );
  });

  test('API-0450: Search invoices by billing street returns 200 with the matching invoice', async ({
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
    const billingStreet = InvoiceFactory.uniqueStreet();

    const setup: CustomerInvoice = await createCustomerInvoice(
      { usersService, adminUsersService, authService, productsService, cartsService, invoicesServiceForToken, cleanup },
      {
        invoiceTitle:
          'Send POST /invoices with that access_token, payment_method "cash-on-delivery", payment_details {}, a unique billing_street of at most 70 characters, billing_city "Wien", billing_country "AT" and the cart\'s id as cart_id, and take the new invoice\'s id.',
        invoiceBody: (cartId) => InvoiceFactory.cashOnDelivery(cartId, { billing_street: billingStreet }),
      }
    );

    await test.step('Send GET /invoices/search with q set to that billing_street and that access_token.', async () => {
      ({ request, response } = await sendSearchInvoices(invoicesClientForToken(setup.token), AUTH.newUser, billingStreet));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step(
      "Verify the body's total is 1 and data has exactly one item, whose id is the new invoice's id and billing_street equals the value sent.",
      async () => {
        const item = expectOnlyInvoice(request, JSON.parse(response.body) as Paginated<InvoiceSummary>, setup.invoice.id);
        // The street is the test's own made-up value.
        expect(item.billing_street, assertMessage({ request, expected: `billing_street is the value sent, "${billingStreet}"`, actual: { billing_street: item.billing_street } })).toBe(
          billingStreet
        );
      }
    );
  });

  test('API-0451: Search invoices by status returns 200 with the matching invoice', async ({
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
      'ON_HOLD',
      'Send PUT /invoices/{invoiceId}/status with the invoice\'s id, that access_token and a body with status "ON_HOLD".',
      AUTH.newUser
    );

    await test.step('Send GET /invoices/search with q "ON_HOLD" and that access_token.', async () => {
      ({ request, response } = await sendSearchInvoices(invoicesClientForToken(setup.token), AUTH.newUser, 'ON_HOLD'));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the body\'s total is 1 and data has exactly one item, whose id is the invoice\'s id and status is "ON_HOLD".', async () => {
      const item = expectOnlyInvoice(request, JSON.parse(response.body) as Paginated<InvoiceSummary>, setup.invoice.id);
      expect(item.status, assertMessage({ request, expected: 'status is "ON_HOLD"', actual: invoiceSummary(item) })).toBe('ON_HOLD');
    });
  });

  test("API-0452: Search invoices without q returns 200 with all of the caller's invoices", async ({
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

    await test.step('Send GET /invoices/search without q and with that access_token.', async () => {
      ({ request, response } = await sendSearchInvoices(invoicesClientForToken(setup.token), AUTH.newUser));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's total is 1 and data has exactly one item, whose id is the new invoice's id.", async () => {
      expectOnlyInvoice(request, JSON.parse(response.body) as Paginated<InvoiceSummary>, setup.invoice.id);
    });
  });

  test('API-0453: Search invoices with a term nobody matches returns 200 with an empty list', async ({ invoicesClientWithToken }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;
    let page: Paginated<InvoiceSummary>;
    const term = uniqueName('NoSuchInvoice');

    await test.step("Send GET /invoices/search with q set to a unique string no invoice has and the default user's token.", async () => {
      ({ request, response } = await sendSearchInvoices(invoicesClientWithToken, AUTH.defaultUser, term));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's total is 0.", async () => {
      page = JSON.parse(response.body) as Paginated<InvoiceSummary>;
      expect(page.total, assertMessage({ request, expected: 'total is 0', actual: invoicePageSummary(page) })).toBe(0);
    });

    await test.step("Verify the body's data is an empty array.", async () => {
      expect(Array.isArray(page.data) && page.data.length === 0, assertMessage({ request, expected: 'data is an empty array', actual: invoicePageSummary(page) })).toBe(
        true
      );
    });
  });

  test("API-0454: Search invoices does not return another customer's invoices", async ({
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

    const { tokenB, invoice } = await customerAWithInvoiceAndCustomerB(
      { usersService, adminUsersService, authService, cartsService, invoicesServiceForToken, cleanup },
      CUSTOMER_A_INVOICE_NUMBER_STEP
    );

    await test.step("Send GET /invoices/search with q set to that invoice number and customer B's access_token.", async () => {
      ({ request, response } = await sendSearchInvoices(invoicesClientForToken(tokenB), AUTH.customerB, invoice.invoice_number));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's total is 0 and data is an empty array.", async () => {
      expectEmptyInvoicePage(request, JSON.parse(response.body) as Paginated<InvoiceSummary>);
    });
  });

  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0455: Search invoices as an admin finds a guest invoice', async ({ cartsService, invoicesService, invoicesClientWithToken, cleanup }) => {
      let request: InvoiceRequest;
      let response: ApiResponse;

      const cartId = await createCart(cartsService, cleanup);

      const created = await createGuestInvoiceSetup(
        invoicesService,
        cartId,
        'Send POST /invoices/guest without an Authorization header, with payment_method "cash-on-delivery", payment_details {}, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT", the cart\'s id as cart_id, a unique guest_email, a guest_first_name and a guest_last_name, and take the new invoice\'s id and invoice_number.'
      );

      await test.step("Send GET /invoices/search with q set to that invoice number and the admin's token.", async () => {
        ({ request, response } = await sendSearchInvoices(invoicesClientWithToken, AUTH.admin, created.invoice_number));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step("Verify the body's total is 1 and data has exactly one item, whose id is the new invoice's id and whose user_id is null.", async () => {
        const item = expectOnlyInvoice(request, JSON.parse(response.body) as Paginated<InvoiceSummary>, created.id);
        expect(item.user_id, assertMessage({ request, expected: 'user_id is null', actual: invoiceSummary(item) })).toBeNull();
      });
    });
  });

  test('API-0456: Search invoices with a page past the last returns 200 with an empty list', async ({
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

    await test.step("Send GET /invoices/search with q set to the invoice's number, page 2 and that access_token.", async () => {
      ({ request, response } = await sendSearchInvoices(invoicesClientForToken(setup.token), AUTH.newUser, setup.invoice.invoice_number, 2));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's data is an empty array.", async () => {
      const page = JSON.parse(response.body) as Paginated<InvoiceSummary>;
      expect(Array.isArray(page.data) && page.data.length === 0, assertMessage({ request, expected: 'data is an empty array', actual: invoicePageSummary(page) })).toBe(
        true
      );
    });
  });

  test('API-0457: Search invoices without a token returns 401', async ({ invoicesClient }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;

    await test.step('Send GET /invoices/search with q "INV", without an Authorization header.', async () => {
      ({ request, response } = await sendSearchInvoices(invoicesClient, AUTH.none, 'INV'));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test('API-0458: Search invoices with a malformed token returns 401', async ({ invoicesClientWithInvalidToken }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;

    await test.step('Send GET /invoices/search with q "INV" and a malformed token.', async () => {
      ({ request, response } = await sendSearchInvoices(invoicesClientWithInvalidToken, AUTH.malformed, 'INV'));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });
});
