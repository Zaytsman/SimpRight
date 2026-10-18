import { test, expect, AUTH, createCart, addItemSetup, takeFirstProductId, FIRST_PRODUCT_STEP, sendCreateGuestInvoice, sendSearchInvoices, readInvoiceOk, invoicePageSummary, expectKeys, expectFieldsEqual, expectSingleInvoiceLine, ADD_TWO_STEP, type InvoiceRequest } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { InvoicesClient } from '@api/clients/InvoicesClient';
import type { Paginated } from '@api/dto/common';
import type { CreateGuestInvoiceRequest, InvoiceCreated, InvoiceSummary } from '@api/dto/invoice';
import { TestConstants } from '@data/TestConstants';
import { InvoiceFactory } from '@data/factories/InvoiceFactory';
import { expectErrorKeys, expectMessage, expectStatus } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/invoices/post-invoices-guest.yml

/** The keys API-0502 expects on a new guest invoice. */
const CREATED_KEYS = [
  'id',
  'user_id',
  'invoice_number',
  'invoice_date',
  'billing_street',
  'billing_city',
  'billing_country',
  'subtotal',
  'total',
  'created_at',
] as const;

/**
 * A guest validation scenario: the send step (title `title`), "Verify the response status is 422." and the check that
 * the body's `errors` has each of `fields` with at least one message (Laravel's default 422 shape on this endpoint).
 */
async function expectGuestValidationError(
  invoicesClient: InvoicesClient,
  title: string,
  body: CreateGuestInvoiceRequest | Record<string, unknown>,
  fields: string[],
  verifyTitle: string
): Promise<void> {
  let request: InvoiceRequest;
  let response: ApiResponse;

  await test.step(title, async () => {
    ({ request, response } = await sendCreateGuestInvoice(invoicesClient, body));
  });

  await test.step('Verify the response status is 422.', async () => {
    expectStatus(request, response, 422);
  });

  await test.step(verifyTitle, async () => {
    expectErrorKeys(request, response, fields);
  });
}

/**
 * The last two steps of a "leaves no invoice behind" scenario: the admin's search by `billingStreet`, then "Verify the
 * body's total is 0.", which parses the page only on 2xx and shows its summary (or the error) as `actual`.
 */
async function searchAndExpectNoInvoiceLeft(invoicesClientWithToken: InvoicesClient, billingStreet: string): Promise<void> {
  let request: InvoiceRequest;
  let response: ApiResponse;

  await test.step("Send GET /invoices/search with q set to that billing_street and the admin's token.", async () => {
    ({ request, response } = await sendSearchInvoices(invoicesClientWithToken, AUTH.admin, billingStreet));
  });

  await test.step("Verify the body's total is 0.", async () => {
    const page = response.isSuccess ? (JSON.parse(response.body) as Paginated<InvoiceSummary>) : undefined;
    expect(
      page?.total,
      assertMessage({ request, expected: 'total is 0', actual: page ? invoicePageSummary(page) : { status: response.status, body: response.body.slice(0, 500) } })
    ).toBe(0);
  });
}

test.describe('@invoices-api - Invoices API', () => {
  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0502: Create guest invoice returns 201 and the invoice has no user', async ({ productsService, cartsService, invoicesClient, invoicesClientWithToken, cleanup }) => {
      let body: CreateGuestInvoiceRequest;
      let request: InvoiceRequest;
      let response: ApiResponse;
      let created: InvoiceCreated;

      const productId = await takeFirstProductId(productsService, FIRST_PRODUCT_STEP);
      const cartId = await createCart(cartsService, cleanup);
      await addItemSetup(cartsService, cartId, productId, 2, ADD_TWO_STEP);

      await test.step(
        'Send POST /invoices/guest without an Authorization header, with payment_method "cash-on-delivery", payment_details {}, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT", the cart\'s id as cart_id, a unique guest_email, a guest_first_name and a guest_last_name, and take the new invoice\'s id.',
        async () => {
          body = InvoiceFactory.guest(cartId);
          ({ request, response } = await sendCreateGuestInvoice(invoicesClient, body));
        }
      );

      await test.step('Verify the response status is 201.', async () => {
        expectStatus(request, response, 201);
      });

      await test.step(
        'Verify the body has the keys id, user_id, invoice_number, invoice_date, billing_street, billing_city, billing_country, subtotal, total and created_at.',
        async () => {
          created = JSON.parse(response.body) as InvoiceCreated;
          expectKeys(request, created, CREATED_KEYS);
        }
      );

      await test.step("Verify the body's user_id is null.", async () => {
        expect(created.user_id, assertMessage({ request, expected: 'user_id is null', actual: { user_id: created.user_id } })).toBeNull();
      });

      await test.step(
        "Verify GET /invoices/{invoiceId} with the new id and the admin's token returns 200 with user_id null, the billing_street, billing_city and billing_country sent, and exactly one line with the product's id as product_id.",
        async () => {
          const { request: getRequest, invoice } = await readInvoiceOk(invoicesClientWithToken, created.id, AUTH.admin);
          expect(invoice.user_id, assertMessage({ request: getRequest, expected: 'user_id is null', actual: { user_id: invoice.user_id } })).toBeNull();
          expectFieldsEqual(getRequest, invoice, body, ['billing_street', 'billing_city', 'billing_country']);
          expectSingleInvoiceLine(getRequest, invoice, productId);
        }
      );
    });
  });

  test('API-0503: Create guest invoice without the required fields returns 422 for each of them', async ({ invoicesClient }) => {
    await expectGuestValidationError(
      invoicesClient,
      'Send POST /invoices/guest without an Authorization header, with Accept: application/json and an empty JSON object as the body.',
      {},
      ['payment_method', 'payment_details', 'billing_street', 'billing_city', 'billing_country', 'cart_id', 'guest_email', 'guest_first_name', 'guest_last_name'],
      "Verify the body's errors has the keys payment_method, payment_details, billing_street, billing_city, billing_country, cart_id, guest_email, guest_first_name and guest_last_name, each with at least one message."
    );
  });

  test('API-0504: Create guest invoice with an invalid guest email returns 422', async ({ invoicesClient }) => {
    await expectGuestValidationError(
      invoicesClient,
      'Send POST /invoices/guest without an Authorization header, with Accept: application/json, payment_method "cash-on-delivery", payment_details {}, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT", a non-empty string as cart_id, guest_email "not-an-email", a guest_first_name and a guest_last_name.',
      InvoiceFactory.guest(TestConstants.carts.unknownId, { guest_email: 'not-an-email' }),
      ['guest_email'],
      "Verify the body's errors has a guest_email key with at least one message."
    );
  });

  test('API-0505: Create guest invoice with a payment method that is not allowed returns 422', async ({ invoicesClient }) => {
    await expectGuestValidationError(
      invoicesClient,
      'Send POST /invoices/guest without an Authorization header, with Accept: application/json, payment_method "bitcoin", payment_details {}, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT", a non-empty string as cart_id, a unique guest_email, a guest_first_name and a guest_last_name.',
      { ...InvoiceFactory.guest(TestConstants.carts.unknownId), payment_method: 'bitcoin' },
      ['payment_method'],
      "Verify the body's errors has a payment_method key with at least one message."
    );
  });

  test("API-0506: Create guest invoice with a postal code that doesn't match the country returns 422", async ({ invoicesClient }) => {
    await expectGuestValidationError(
      invoicesClient,
      'Send POST /invoices/guest without an Authorization header, with Accept: application/json, payment_method "cash-on-delivery", payment_details {}, billing_street "Stephansplatz 1", billing_city "Amsterdam", billing_country "NL", a billing_postal_code that doesn\'t match the Dutch format (for example "ABCDE"), a non-empty string as cart_id, a unique guest_email, a guest_first_name and a guest_last_name.',
      InvoiceFactory.guest(TestConstants.carts.unknownId, InvoiceFactory.mismatchedDutchPostcode()),
      ['billing_country'],
      "Verify the body's errors has a billing_country key with at least one message."
    );
  });

  test('API-0507: Create guest invoice with an unknown cart returns 404', async ({ invoicesClient }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;

    await test.step(
      'Send POST /invoices/guest without an Authorization header, with payment_method "cash-on-delivery", payment_details {}, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT", a well-formed ULID that no cart has as cart_id, a unique guest_email, a guest_first_name and a guest_last_name.',
      async () => {
        ({ request, response } = await sendCreateGuestInvoice(invoicesClient, InvoiceFactory.guest(TestConstants.carts.unknownId)));
      }
    );

    await test.step('Verify the response status is 404.', async () => {
      expectStatus(request, response, 404);
    });

    await test.step('Verify the body\'s message is "Requested item not found".', async () => {
      expectMessage(request, response, 'Requested item not found');
    });
  });

  test('API-0508: Create guest invoice with payment_details null returns 422', async ({ cartsService, invoicesClient, cleanup }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;

    const cartId = await createCart(cartsService, cleanup);
    test.fail(true, 'Known issue BUG-041: Returns 500 instead of 422 when payment_details is null for a method other than gift-card.');

    await test.step(
      'Send POST /invoices/guest without an Authorization header, with payment_method "bank-transfer", payment_details null, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT", the cart\'s id as cart_id, a unique guest_email, a guest_first_name and a guest_last_name.',
      async () => {
        const body = { ...InvoiceFactory.guest(cartId), ...InvoiceFactory.nullBankTransferDetails() };
        ({ request, response } = await sendCreateGuestInvoice(invoicesClient, body));
      }
    );

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });
  });

  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0669: Create guest invoice with an unknown cart leaves no invoice behind', async ({ invoicesClient, invoicesClientWithToken }) => {
      test.fail(true, 'Known issue BUG-040: A failed guest checkout (unknown cart) leaves an invoice without lines or payment that an admin search finds.');
      const billingStreet = InvoiceFactory.uniqueStreet();

      await test.step(
        'Send POST /invoices/guest without an Authorization header, with payment_method "cash-on-delivery", payment_details {}, a unique billing_street of at most 70 characters, billing_city "Wien", billing_country "AT", a well-formed ULID that no cart has as cart_id, a unique guest_email, a guest_first_name and a guest_last_name.',
        async () => {
          // The scenario checks no status here (the call answers 404); the orphan it may leave can't be deleted.
          await sendCreateGuestInvoice(invoicesClient, InvoiceFactory.guest(TestConstants.carts.unknownId, { billing_street: billingStreet }));
        }
      );

      await searchAndExpectNoInvoiceLeft(invoicesClientWithToken, billingStreet);
    });

    test('API-0671: Create guest invoice with a failed bank-transfer payment leaves no invoice behind', async ({ cartsService, invoicesClient, invoicesClientWithToken, cleanup }) => {
      const billingStreet = InvoiceFactory.uniqueStreet();

      const cartId = await createCart(cartsService, cleanup);
      test.fail(true, 'Known issue BUG-040: A failed guest checkout (bank-transfer payment_details {}) leaves an invoice without lines or payment that an admin search finds.');

      await test.step(
        'Send POST /invoices/guest without an Authorization header, with Accept: application/json, payment_method "bank-transfer", payment_details {}, a unique billing_street of at most 70 characters, billing_city "Wien", billing_country "AT", the cart\'s id as cart_id, a unique guest_email, a guest_first_name and a guest_last_name.',
        async () => {
          // The scenario checks no status here (the call answers 500 while BUG-041 is open); the orphan it may leave can't be deleted.
          await sendCreateGuestInvoice(invoicesClient, InvoiceFactory.guest(cartId, { payment_method: 'bank-transfer', payment_details: {}, billing_street: billingStreet }));
        }
      );

      await searchAndExpectNoInvoiceLeft(invoicesClientWithToken, billingStreet);
    });
  });

  test('API-0670: Create guest invoice with bank-transfer details missing the required fields returns 422', async ({ cartsService, invoicesClient, cleanup }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;

    const cartId = await createCart(cartsService, cleanup);
    test.fail(true, 'Known issue BUG-041: Returns 500 "Something went wrong" instead of 422 when payment_details lacks the fields the payment method requires.');

    await test.step(
      'Send POST /invoices/guest without an Authorization header, with Accept: application/json, payment_method "bank-transfer", payment_details {}, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT", the cart\'s id as cart_id, a unique guest_email, a guest_first_name and a guest_last_name.',
      async () => {
        const body = InvoiceFactory.guest(cartId, { payment_method: 'bank-transfer', payment_details: {} });
        ({ request, response } = await sendCreateGuestInvoice(invoicesClient, body));
      }
    );

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });
  });
});
