import {
  test,
  expect,
  createCustomerInvoice,
  customerAWithInvoiceAndCustomerB,
  sendGetInvoice,
  expectKeys,
  expectSingleInvoiceLine,
  expectPaymentMethod,
  INVOICE_AUTH,
  type CustomerInvoice,
  type InvoiceRequest,
} from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { Invoice } from '@api/dto/invoice';
import { TestConstants } from '@data/TestConstants';
import { expectMessage, expectStatus } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/invoices/get-invoices-by-invoice-id.yml

/** The invoice keys API-0463 expects besides the ones it compares. */
const INVOICE_KEYS = [
  'invoice_date',
  'status',
  'status_message',
  'created_at',
  'subtotal',
  'total',
  'additional_discount_percentage',
  'additional_discount_amount',
  'eco_discount_percentage',
  'eco_discount_amount',
  'invoicelines',
  'payment',
] as const;

/** The keys of the product inside an invoice line. */
const LINE_PRODUCT_KEYS = ['id', 'name', 'description', 'price', 'co2_rating', 'is_rental', 'in_stock', 'is_eco_friendly', 'product_image', 'category', 'brand'] as const;

/** A money value of the API as a number: amounts may come back as strings (`discounted_price`) or null. */
function amount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  return Number(value);
}

test.describe('@invoices-api - Invoices API', () => {
  test('API-0463: Get invoice returns 200 with its lines, payment and totals', async ({
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
    let invoice: Invoice;

    const setup: CustomerInvoice = await createCustomerInvoice(
      { usersService, adminUsersService, authService, productsService, cartsService, invoicesServiceForToken, cleanup },
      { withProduct: true }
    );

    await test.step("Send GET /invoices/{invoiceId} with the invoice's id and that access_token.", async () => {
      ({ request, response } = await sendGetInvoice(invoicesClientForToken(setup.token), setup.invoice.id, INVOICE_AUTH.throwaway));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's id and invoice_number equal the invoice's, and its user_id equals the new user's id.", async () => {
      invoice = JSON.parse(response.body) as Invoice;
      const actual = { id: invoice.id, invoice_number: invoice.invoice_number, user_id: invoice.user_id };
      expect(invoice.id, assertMessage({ request, expected: `id is the invoice's id ${setup.invoice.id}`, actual })).toBe(setup.invoice.id);
      expect(invoice.invoice_number, assertMessage({ request, expected: `invoice_number is the invoice's ${setup.invoice.invoice_number}`, actual })).toBe(
        setup.invoice.invoice_number
      );
      expect(invoice.user_id, assertMessage({ request, expected: `user_id is the new user's id ${setup.customer.id}`, actual })).toBe(setup.customer.id);
    });

    await test.step('Verify the body\'s billing_street is "Stephansplatz 1", billing_city is "Wien" and billing_country is "AT".', async () => {
      const actual = { billing_street: invoice.billing_street, billing_city: invoice.billing_city, billing_country: invoice.billing_country };
      expect(invoice.billing_street, assertMessage({ request, expected: 'billing_street is "Stephansplatz 1"', actual })).toBe('Stephansplatz 1');
      expect(invoice.billing_city, assertMessage({ request, expected: 'billing_city is "Wien"', actual })).toBe('Wien');
      expect(invoice.billing_country, assertMessage({ request, expected: 'billing_country is "AT"', actual })).toBe('AT');
    });

    await test.step(
      'Verify the body has the keys invoice_date, status, status_message, created_at, subtotal, total, additional_discount_percentage, additional_discount_amount, eco_discount_percentage, eco_discount_amount, invoicelines and payment.',
      async () => {
        expectKeys(request, invoice, INVOICE_KEYS);
      }
    );

    await test.step('Verify the body has no updated_at and no document key.', async () => {
      for (const key of ['updated_at', 'document']) {
        expect(key in invoice, assertMessage({ request, expected: `The body has no "${key}" key`, actual: Object.keys(invoice) })).toBe(false);
      }
    });

    await test.step(
      "Verify invoicelines has exactly one line with the product's id as product_id and quantity 2, whose product has the keys id, name, description, price, co2_rating, is_rental, in_stock, is_eco_friendly, product_image, category and brand.",
      async () => {
        const line = expectSingleInvoiceLine(request, invoice, setup.productId!, 2);
        const product = line.product ?? {};
        for (const key of LINE_PRODUCT_KEYS) {
          expect(key in product, assertMessage({ request, expected: `The line's product has the key "${key}"`, actual: Object.keys(product) })).toBe(true);
        }
      }
    );

    await test.step('Verify the body\'s payment.payment_method is "cash-on-delivery".', async () => {
      expectPaymentMethod(request, invoice, 'cash-on-delivery');
    });

    await test.step(
      "Verify the body's subtotal equals the line's quantity times its discounted_price (or its unit_price when there is no discounted_price), within a cent.",
      async () => {
        const line = invoice.invoicelines[0]!;
        const price = amount(line.discounted_price) ?? amount(line.unit_price) ?? NaN;
        const expected = line.quantity * price;
        const actual = { subtotal: invoice.subtotal, quantity: line.quantity, discounted_price: line.discounted_price, unit_price: line.unit_price };
        expect(
          Math.abs((amount(invoice.subtotal) ?? NaN) - expected) <= 0.01,
          assertMessage({ request, expected: `subtotal is ${line.quantity} x ${price} = ${expected}, within a cent`, actual })
        ).toBe(true);
      }
    );

    await test.step("Verify the body's total equals subtotal minus additional_discount_amount minus eco_discount_amount, within a cent.", async () => {
      // A null discount amount counts as 0; the raw values are in the message.
      const subtotal = amount(invoice.subtotal) ?? NaN;
      const expected = subtotal - (amount(invoice.additional_discount_amount) ?? 0) - (amount(invoice.eco_discount_amount) ?? 0);
      const actual = {
        total: invoice.total,
        subtotal: invoice.subtotal,
        additional_discount_amount: invoice.additional_discount_amount,
        eco_discount_amount: invoice.eco_discount_amount,
      };
      expect(
        Math.abs((amount(invoice.total) ?? NaN) - expected) <= 0.01,
        assertMessage({ request, expected: `total is subtotal - additional_discount_amount - eco_discount_amount = ${expected}, within a cent`, actual })
      ).toBe(true);
    });
  });

  test.describe(() => {
    test.use({ role: 'admin' });

    test("API-0464: Get invoice as an admin returns 200 for another customer's invoice", async ({
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

      await test.step("Send GET /invoices/{invoiceId} with the invoice's id and the admin's token.", async () => {
        ({ request, response } = await sendGetInvoice(invoicesClientWithToken, setup.invoice.id, INVOICE_AUTH.admin));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step("Verify the body's id equals the invoice's id and its user_id equals the new user's id.", async () => {
        const invoice = JSON.parse(response.body) as Invoice;
        const actual = { id: invoice.id, user_id: invoice.user_id };
        expect(invoice.id, assertMessage({ request, expected: `id is the invoice's id ${setup.invoice.id}`, actual })).toBe(setup.invoice.id);
        expect(invoice.user_id, assertMessage({ request, expected: `user_id is the new user's id ${setup.customer.id}`, actual })).toBe(setup.customer.id);
      });
    });
  });

  test('API-0465: Get invoice without a token returns 401', async ({ invoicesClient }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;

    await test.step('Send GET /invoices/{invoiceId} with a well-formed ULID that no invoice has, without an Authorization header.', async () => {
      ({ request, response } = await sendGetInvoice(invoicesClient, TestConstants.invoices.unknownId, INVOICE_AUTH.none));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test('API-0466: Get invoice with an unknown id returns 404', async ({ invoicesClientWithToken }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;

    await test.step("Send GET /invoices/{invoiceId} with a well-formed ULID that no invoice has and the default user's token.", async () => {
      ({ request, response } = await sendGetInvoice(invoicesClientWithToken, TestConstants.invoices.unknownId, INVOICE_AUTH.defaultUser));
    });

    await test.step('Verify the response status is 404.', async () => {
      expectStatus(request, response, 404);
    });

    await test.step('Verify the body\'s message is "Requested item not found".', async () => {
      expectMessage(request, response, 'Requested item not found');
    });
  });

  test("API-0467: Get invoice with another customer's id returns 404", async ({
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

    const { tokenB, invoice } = await customerAWithInvoiceAndCustomerB({ usersService, adminUsersService, authService, cartsService, invoicesServiceForToken, cleanup });

    await test.step("Send GET /invoices/{invoiceId} with that id and customer B's access_token.", async () => {
      ({ request, response } = await sendGetInvoice(invoicesClientForToken(tokenB), invoice.id, INVOICE_AUTH.customerB));
    });

    await test.step('Verify the response status is 404.', async () => {
      expectStatus(request, response, 404);
    });

    await test.step('Verify the body\'s message is "Requested item not found".', async () => {
      expectMessage(request, response, 'Requested item not found');
    });
  });
});
