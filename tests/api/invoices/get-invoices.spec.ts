import { test, expect, AUTH, registerThrowawayCustomer, loginThrowawayCustomer, disableCustomerSetup, createCustomerInvoice, createInvoiceSetup, expectSingleInvoiceLine, customerAWithInvoiceAndCustomerB, sendListInvoices, invoiceSummary, invoicePageSummary, expectKeys, expectOnlyInvoice, expectEmptyInvoicePage, type CustomerInvoice, type InvoiceRequest, checkStatusAndMessage } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { Paginated } from '@api/dto/common';
import type { InvoiceCreated, InvoiceStatus, InvoiceSummary } from '@api/dto/invoice';
import { expectStatus, PAGE_KEYS, parseJson } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/invoices/get-invoices.yml

/** The item keys API-0441 expects besides the ones it compares. */
const ITEM_KEYS = [
  'invoice_date',
  'status',
  'subtotal',
  'total',
  'billing_street',
  'billing_city',
  'billing_state',
  'billing_country',
  'billing_postal_code',
  'additional_discount_percentage',
  'additional_discount_amount',
  'invoicelines',
  'payment',
] as const;

/** The keys of the product inside a line of a list item (a slimmer product than GET /invoices/{invoiceId}). */
const LINE_PRODUCT_KEYS = ['id', 'name', 'price', 'co2_rating', 'in_stock', 'is_eco_friendly', 'product_image'] as const;

const STATUSES: InvoiceStatus[] = ['AWAITING_FULFILLMENT', 'ON_HOLD', 'AWAITING_SHIPMENT', 'SHIPPED', 'COMPLETED'];

/** Customer A's invoice-create step in API-0442 (it takes nothing from the response). */
const CUSTOMER_A_INVOICE_NO_TAKE_STEP =
  'Send POST /invoices with customer A\'s access_token, payment_method "cash-on-delivery", payment_details {}, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT" and the cart\'s id as cart_id.';

test.describe('@invoices-api - Invoices API', () => {
  test("API-0441: List invoices returns 200 with the customer's invoice, its lines and payment", async ({
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
    let item: InvoiceSummary;

    const setup: CustomerInvoice = await createCustomerInvoice(
      { usersService, adminUsersService, authService, productsService, cartsService, invoicesServiceForToken, cleanup },
      { withProduct: true }
    );

    await test.step('Send GET /invoices with that access_token.', async () => {
      ({ request, response } = await sendListInvoices(invoicesClientForToken(setup.token), AUTH.newUser));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the body has the keys current_page, data, from, last_page, per_page, to and total, and its per_page is 15.', async () => {
      page = parseJson<Paginated<InvoiceSummary>>(request, response);
      expectKeys(request, page, PAGE_KEYS);
      expect(page.per_page, assertMessage({ request, expected: 'per_page is 15', actual: invoicePageSummary(page) })).toBe(15);
    });

    await test.step(
      "Verify the body's total is 1 and data has exactly one item, whose id is the new invoice's id, user_id is the new user's id and invoice_number is the invoice's number.",
      async () => {
        item = expectOnlyInvoice(request, page, setup.invoice.id);
        const actual = invoiceSummary(item);
        expect(item.user_id, assertMessage({ request, expected: `user_id is the new user's id ${setup.customer.id}`, actual })).toBe(setup.customer.id);
        expect(item.invoice_number, assertMessage({ request, expected: `invoice_number is the invoice's ${setup.invoice.invoice_number}`, actual })).toBe(
          setup.invoice.invoice_number
        );
      }
    );

    await test.step(
      'Verify the item has the keys invoice_date, status, subtotal, total, billing_street, billing_city, billing_state, billing_country, billing_postal_code, additional_discount_percentage, additional_discount_amount, invoicelines and payment.',
      async () => {
        expectKeys(request, item, ITEM_KEYS);
      }
    );

    await test.step("Verify the item's status is one of AWAITING_FULFILLMENT, ON_HOLD, AWAITING_SHIPMENT, SHIPPED and COMPLETED.", async () => {
      expect(STATUSES, assertMessage({ request, expected: `status is one of ${STATUSES.join(', ')}`, actual: { status: item.status } })).toContain(item.status);
    });

    await test.step('Verify the item\'s payment.payment_method is "cash-on-delivery".', async () => {
      expect(item.payment?.payment_method, assertMessage({ request, expected: 'payment.payment_method is "cash-on-delivery"', actual: item.payment })).toBe(
        'cash-on-delivery'
      );
    });

    await test.step(
      "Verify the item's invoicelines has exactly one line with the product's id as product_id and quantity 2, whose product has the keys id, name, price, co2_rating, in_stock, is_eco_friendly and product_image.",
      async () => {
        const line = expectSingleInvoiceLine(request, item, setup.productId!, 2);
        const product = (line['product'] ?? {}) as Record<string, unknown>;
        for (const key of LINE_PRODUCT_KEYS) {
          expect(key in product, assertMessage({ request, expected: `The line's product has the key "${key}"`, actual: Object.keys(product) })).toBe(true);
        }
      }
    );
  });

  test("API-0442: List invoices does not include another customer's invoices", async ({
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

    const { tokenB } = await customerAWithInvoiceAndCustomerB(
      { usersService, adminUsersService, authService, cartsService, invoicesServiceForToken, cleanup },
      CUSTOMER_A_INVOICE_NO_TAKE_STEP
    );

    await test.step("Send GET /invoices with customer B's access_token.", async () => {
      ({ request, response } = await sendListInvoices(invoicesClientForToken(tokenB), AUTH.customerB));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's total is 0 and data is an empty array.", async () => {
      expectEmptyInvoicePage(request, parseJson<Paginated<InvoiceSummary>>(request, response));
    });
  });

  test.describe(() => {
    test.use({ role: 'admin' });

    test("API-0443: List invoices as an admin includes another customer's invoice", async ({
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

      await test.step("Send GET /invoices with the admin's token.", async () => {
        ({ request, response } = await sendListInvoices(invoicesClientWithToken, AUTH.admin));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step(
        "Verify data has an item whose id is the new invoice's id and whose user_id is the new user's id (the newest invoice is on page 1).",
        async () => {
          // The page holds other visitors' invoices: only summaries are shown.
          const page = parseJson<Paginated<InvoiceSummary>>(request, response);
          const actual = invoicePageSummary(page);
          const item = (page.data ?? []).find((invoice) => invoice.id === setup.invoice.id);
          expect(item !== undefined, assertMessage({ request, expected: `data has an item with the new invoice's id ${setup.invoice.id}`, actual })).toBe(true);
          expect(item!.user_id, assertMessage({ request, expected: `The item's user_id is the new user's id ${setup.customer.id}`, actual: invoiceSummary(item!) })).toBe(
            setup.customer.id
          );
        }
      );
    });
  });

  test('API-0444: List invoices returns invoices ordered by invoice_date, newest first', async ({
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
    const second: InvoiceCreated = await createInvoiceSetup(
      invoicesServiceForToken(setup.token),
      setup.cartId,
      "Send POST /invoices again with that access_token and the same body and cart's id, and take the second invoice's id.",
      AUTH.newUser
    );

    await test.step('Send GET /invoices with that access_token.', async () => {
      ({ request, response } = await sendListInvoices(invoicesClientForToken(setup.token), AUTH.newUser));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's total is 2 and data has two items, whose ids are the two invoices' ids.", async () => {
      page = parseJson<Paginated<InvoiceSummary>>(request, response);
      const actual = invoicePageSummary(page);
      expect(page.total, assertMessage({ request, expected: 'total is 2', actual })).toBe(2);
      const ids = (page.data ?? []).map((invoice) => invoice.id).sort();
      expect(ids, assertMessage({ request, expected: `data has the two invoices' ids ${setup.invoice.id} and ${second.id}`, actual })).toEqual(
        [setup.invoice.id, second.id].sort()
      );
    });

    await test.step("Verify the items' invoice_date values are in descending order (the first item is not older than the second).", async () => {
      const [first, next] = page.data;
      const actual = page.data.map((invoice) => ({ id: invoice.id, invoice_date: invoice.invoice_date }));
      // Both formats the API may use (Y-m-d H:i:s or ISO 8601) sort chronologically as strings.
      expect(first!.invoice_date >= next!.invoice_date, assertMessage({ request, expected: "The first item's invoice_date is not older than the second's", actual })).toBe(
        true
      );
    });
  });

  test('API-0445: List invoices with a page past the last returns 200 with an empty list', async ({
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

    await test.step('Send GET /invoices with page 2 and that access_token.', async () => {
      ({ request, response } = await sendListInvoices(invoicesClientForToken(setup.token), AUTH.newUser, 2));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's data is an empty array.", async () => {
      const page = parseJson<Paginated<InvoiceSummary>>(request, response);
      expect(Array.isArray(page.data) && page.data.length === 0, assertMessage({ request, expected: 'data is an empty array', actual: invoicePageSummary(page) })).toBe(
        true
      );
    });
  });

  test('API-0446: List invoices without a token returns 401', async ({ invoicesClient }) => {
    await checkStatusAndMessage(
      'Send GET /invoices without an Authorization header.',
      () => sendListInvoices(invoicesClient, AUTH.none),
      401,
      'Unauthorized'
    );
  });

  test('API-0447: List invoices with a malformed token returns 401', async ({ invoicesClientWithInvalidToken }) => {
    await checkStatusAndMessage(
      'Send GET /invoices with a malformed token.',
      () => sendListInvoices(invoicesClientWithInvalidToken, AUTH.malformed),
      401,
      'Unauthorized'
    );
  });

  test.describe(() => {
    test.use({ role: 'admin' });

    test("API-0448: List invoices with a disabled account's token returns 403", async ({
      usersService,
      adminUsersService,
      authService,
      invoicesClientForToken,
      cleanup,
    }) => {
      const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup);
      const customerToken = await loginThrowawayCustomer(authService, customer);
      // The throwaway's token isn't used before this step, so the API's cached user can't be a stale, enabled one.
      await disableCustomerSetup(
        adminUsersService,
        customer.id,
        "Send PATCH /users/{userId} with the new user's id and enabled false, with the admin's token.",
        AUTH.admin
      );

      await checkStatusAndMessage(
        "Send GET /invoices with the throwaway customer's access_token.",
        () => sendListInvoices(invoicesClientForToken(customerToken), AUTH.throwaway),
        403,
        'Account disabled.'
      );
    });
  });
});
