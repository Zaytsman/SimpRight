import { test, expect, AUTH, loggedInCustomer, createCart, addItemSetup, takeFirstProductId, FIRST_PRODUCT_STEP, sendCreateInvoice, sendListInvoices, readInvoiceOk, expectKeys, expectFieldsEqual, expectSingleInvoiceLine, expectPaymentMethod, expectPaymentDetails, invoicePageSummary, ADD_TWO_STEP, type InvoiceRequest, type CustomerFixtures, type InvoiceSetupFixtures } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { InvoicesClient } from '@api/clients/InvoicesClient';
import type { Paginated } from '@api/dto/common';
import type { CreateInvoiceRequest, InvoiceCreated, InvoiceSummary } from '@api/dto/invoice';
import type { PostcodeLookupResult } from '@api/dto/postcode';
import { TestConstants } from '@data/TestConstants';
import { InvoiceFactory } from '@data/factories/InvoiceFactory';
import { expectFieldMessages, expectMessage, expectStatus } from '@utils/apiChecks';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/invoices/post-invoices.yml

/** The register and login steps of API-0297 and API-0298 (this wording takes no id, and "the access_token"). */
const REGISTER_NO_ID_STEP = 'Send POST /users/register with a unique email, a first name, a last name and a random strong password.';
const LOGIN_THE_TOKEN_STEP = 'Send POST /users/login with that email and password, and take the access_token.';

/** The keys API-0485 expects on a new invoice. */
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
  'additional_discount_percentage',
  'additional_discount_amount',
  'eco_discount_percentage',
  'eco_discount_amount',
  'created_at',
] as const;

/** Parses a 201 body of POST /invoices (call after its status was checked). */
function parseCreated(response: ApiResponse): InvoiceCreated {
  return JSON.parse(response.body) as InvoiceCreated;
}

/** The checks of a "Verify the body's id is a non-empty string ..." part. */
function expectNewId(request: InvoiceRequest, invoice: InvoiceCreated): void {
  expect(typeof invoice.id === 'string' && invoice.id.length > 0, assertMessage({ request, expected: 'id is a non-empty string', actual: invoice })).toBe(true);
}

/**
 * A validation scenario with the default user's token: the send step (title `title`), "Verify the response status is
 * 422." and the field-message check of `fields`.
 */
async function expectValidationError(
  invoicesClient: InvoicesClient,
  title: string,
  body: CreateInvoiceRequest | Record<string, unknown>,
  fields: string[],
  verifyTitle: string
): Promise<void> {
  let request: InvoiceRequest;
  let response: ApiResponse;

  await test.step(title, async () => {
    ({ request, response } = await sendCreateInvoice(invoicesClient, body, AUTH.defaultUser));
  });

  await test.step('Verify the response status is 422.', async () => {
    expectStatus(request, response, 422);
  });

  await test.step(verifyTitle, async () => {
    for (const field of fields) {
      expectFieldMessages(request, response, field);
    }
  });
}

/**
 * The check of "Verify the body's total is 0." after GET /invoices: the page's total is 0 (a non-2xx response fails
 * it too, shown with its status and the start of its body).
 */
function expectNoInvoiceLeft(request: InvoiceRequest, response: ApiResponse): void {
  const page = response.isSuccess ? (JSON.parse(response.body) as Paginated<InvoiceSummary>) : undefined;
  expect(
    page?.total,
    assertMessage({ request, expected: 'total is 0', actual: page ? invoicePageSummary(page) : { status: response.status, body: response.body.slice(0, 500) } })
  ).toBe(0);
}

/** A body for the validation scenarios: `cashOnDelivery` with a non-empty (unknown) cart id and the given changes. */
function validationBody(overrides: Partial<CreateInvoiceRequest> = {}): CreateInvoiceRequest {
  return InvoiceFactory.cashOnDelivery(TestConstants.carts.unknownId, overrides);
}

/**
 * The scenarios that pay with another method: register, log in, create a cart, create the invoice with `paymentMethod`
 * and `details` (title `createTitle`), check 201 and read the invoice back with the stored payment details.
 */
async function expectPaymentStored(
  fixtures: CustomerFixtures & Pick<InvoiceSetupFixtures, 'cartsService'> & { invoicesClientForToken: (token: string) => InvoicesClient },
  paymentMethod: 'bank-transfer' | 'credit-card' | 'buy-now-pay-later' | 'gift-card',
  details: Record<string, unknown>,
  createTitle: string,
  verifyTitle: string
): Promise<void> {
  let request: InvoiceRequest;
  let response: ApiResponse;

  const customer = await loggedInCustomer(fixtures);
  const cartId = await createCart(fixtures.cartsService, fixtures.cleanup);
  const client = fixtures.invoicesClientForToken(customer.token);

  await test.step(createTitle, async () => {
    ({ request, response } = await sendCreateInvoice(client, InvoiceFactory.withPayment(cartId, paymentMethod, details), AUTH.newUser));
  });

  await test.step('Verify the response status is 201.', async () => {
    expectStatus(request, response, 201);
  });

  await test.step(verifyTitle, async () => {
    const { request: getRequest, invoice } = await readInvoiceOk(client, parseCreated(response).id, AUTH.newUser);
    expectPaymentMethod(getRequest, invoice, paymentMethod);
    expectPaymentDetails(getRequest, invoice, details);
  });
}

test.describe('@invoices-api - Invoices API', () => {
  test('API-0297: Create invoice with billing address fields at their maximum length returns 201', async ({
    usersService,
    adminUsersService,
    authService,
    cartsService,
    invoicesClientForToken,
    cleanup,
  }) => {
    const address = InvoiceFactory.maxLengthAddress();
    const fields = ['billing_street', 'billing_city', 'billing_state', 'billing_country'] as const;
    let request: InvoiceRequest;
    let response: ApiResponse;
    let created: InvoiceCreated;

    const customer = await loggedInCustomer({ usersService, adminUsersService, authService, cleanup }, { register: REGISTER_NO_ID_STEP, login: LOGIN_THE_TOKEN_STEP });
    const cartId = await createCart(cartsService, cleanup);
    const client = invoicesClientForToken(customer.token);
    const body = InvoiceFactory.cashOnDelivery(cartId, address);

    await test.step(
      'Send POST /invoices with that token, payment_method "cash-on-delivery", payment_details {}, a 70-character billing_street, a 40-character billing_city, a 40-character billing_state, a 40-character billing_country (no billing_postal_code) and the cart\'s id as cart_id.',
      async () => {
        ({ request, response } = await sendCreateInvoice(client, body, AUTH.newUser));
      }
    );

    await test.step('Verify the response status is 201.', async () => {
      expectStatus(request, response, 201);
    });

    await test.step("Verify the body's id is a non-empty string, and its billing_street, billing_city, billing_state and billing_country equal the values sent.", async () => {
      created = parseCreated(response);
      expectNewId(request, created);
      expectFieldsEqual(request, created, body, fields);
    });

    await test.step(
      'Verify GET /invoices/{invoiceId} with the new id and that token returns 200 with the same billing_street, billing_city, billing_state and billing_country.',
      async () => {
        const { request: getRequest, invoice } = await readInvoiceOk(client, created.id, AUTH.newUser);
        expectFieldsEqual(getRequest, invoice, body, fields);
      }
    );
  });

  test('API-0298: Create invoice with a 10-character postal code returns 201', async ({
    usersService,
    adminUsersService,
    authService,
    cartsService,
    postcodeService,
    invoicesClientForToken,
    cleanup,
  }) => {
    const lookupQuery = { country: 'US', postcode: '12345-6789' };
    const fields = ['billing_city', 'billing_state', 'billing_country', 'billing_postal_code'] as const;
    let lookup: PostcodeLookupResult;
    let body: CreateInvoiceRequest;
    let request: InvoiceRequest;
    let response: ApiResponse;
    let created: InvoiceCreated;

    const customer = await loggedInCustomer({ usersService, adminUsersService, authService, cleanup }, { register: REGISTER_NO_ID_STEP, login: LOGIN_THE_TOKEN_STEP });
    const cartId = await createCart(cartsService, cleanup);
    const client = invoicesClientForToken(customer.token);

    await test.step('Send GET /postcode-lookup with country "US" and postcode "12345-6789", and take the returned city and state.', async () => {
      const lookupRequest = { method: 'GET', path: '/postcode-lookup', query: lookupQuery };
      await attachJson('Postcode Lookup Request', lookupRequest);
      lookup = await postcodeService.lookup(lookupQuery);
      await attachJson('Postcode Lookup Response', lookup);
      expect(
        typeof lookup.city === 'string' && lookup.city.length > 0 && typeof lookup.state === 'string',
        assertMessage({ request: lookupRequest, expected: 'The lookup returns a city and a state', actual: lookup })
      ).toBe(true);
    });

    await test.step(
      'Send POST /invoices with that token, payment_method "cash-on-delivery", payment_details {}, a billing_street, billing_city and billing_state set to the lookup\'s city and state, billing_country "US", billing_postal_code "12345-6789" (10 characters) and the cart\'s id as cart_id.',
      async () => {
        body = InvoiceFactory.cashOnDelivery(cartId, {
          billing_city: lookup.city,
          billing_state: lookup.state,
          billing_country: 'US',
          billing_postal_code: lookupQuery.postcode,
        });
        ({ request, response } = await sendCreateInvoice(client, body, AUTH.newUser));
      }
    );

    await test.step('Verify the response status is 201.', async () => {
      expectStatus(request, response, 201);
    });

    await test.step("Verify the body's id is a non-empty string, and its billing_city, billing_state, billing_country and billing_postal_code equal the values sent.", async () => {
      created = parseCreated(response);
      expectNewId(request, created);
      expectFieldsEqual(request, created, body, fields);
    });

    await test.step(
      'Verify GET /invoices/{invoiceId} with the new id and that token returns 200 with the same billing_city, billing_state, billing_country and billing_postal_code.',
      async () => {
        const { request: getRequest, invoice } = await readInvoiceOk(client, created.id, AUTH.newUser);
        expectFieldsEqual(getRequest, invoice, body, fields);
      }
    );
  });

  test('API-0299: Create invoice without the required billing address fields returns 422 for each of them', async ({ invoicesClientWithToken }) => {
    await expectValidationError(
      invoicesClientWithToken,
      'Send POST /invoices with the default user\'s token, payment_method "cash-on-delivery", payment_details {} and a non-empty string as cart_id, without billing_street, billing_city and billing_country.',
      { payment_method: 'cash-on-delivery', payment_details: {}, cart_id: TestConstants.carts.unknownId },
      ['billing_street', 'billing_city', 'billing_country'],
      'Verify the body has the keys billing_street, billing_city and billing_country, each with at least one message.'
    );
  });

  test('API-0300: Create invoice with a billing street longer than 70 characters returns 422', async ({ invoicesClientWithToken }) => {
    await expectValidationError(
      invoicesClientWithToken,
      'Send POST /invoices with the default user\'s token, payment_method "cash-on-delivery", payment_details {}, a 71-character billing_street, billing_city "Wien", billing_country "AT" (no billing_postal_code) and a non-empty string as cart_id.',
      validationBody({ billing_street: InvoiceFactory.tooLongStreet() }),
      ['billing_street'],
      'Verify the body has a billing_street key with at least one message.'
    );
  });

  test('API-0301: Create invoice with a billing city longer than 40 characters returns 422', async ({ invoicesClientWithToken }) => {
    await expectValidationError(
      invoicesClientWithToken,
      'Send POST /invoices with the default user\'s token, payment_method "cash-on-delivery", payment_details {}, billing_street "Stephansplatz 1", a 41-character billing_city, billing_country "AT" (no billing_postal_code) and a non-empty string as cart_id.',
      validationBody({ billing_city: InvoiceFactory.tooLongCity() }),
      ['billing_city'],
      'Verify the body has a billing_city key with at least one message.'
    );
  });

  test('API-0302: Create invoice with a billing state longer than 40 characters returns 422', async ({ invoicesClientWithToken }) => {
    await expectValidationError(
      invoicesClientWithToken,
      'Send POST /invoices with the default user\'s token, payment_method "cash-on-delivery", payment_details {}, billing_street "Stephansplatz 1", billing_city "Wien", a 41-character billing_state, billing_country "AT" (no billing_postal_code) and a non-empty string as cart_id.',
      validationBody({ billing_state: InvoiceFactory.tooLongState() }),
      ['billing_state'],
      'Verify the body has a billing_state key with at least one message.'
    );
  });

  test('API-0303: Create invoice with a billing country longer than 40 characters returns 422', async ({ invoicesClientWithToken }) => {
    await expectValidationError(
      invoicesClientWithToken,
      'Send POST /invoices with the default user\'s token, payment_method "cash-on-delivery", payment_details {}, billing_street "Stephansplatz 1", billing_city "Wien", a 41-character billing_country (no billing_postal_code) and a non-empty string as cart_id.',
      validationBody({ billing_country: InvoiceFactory.tooLongCountry() }),
      ['billing_country'],
      'Verify the body has a billing_country key with at least one message.'
    );
  });

  test('API-0304: Create invoice with a billing postal code longer than 10 characters returns 422', async ({ invoicesClientWithToken }) => {
    await expectValidationError(
      invoicesClientWithToken,
      'Send POST /invoices with the default user\'s token, payment_method "cash-on-delivery", payment_details {}, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT", an 11-character billing_postal_code and a non-empty string as cart_id.',
      validationBody({ billing_postal_code: InvoiceFactory.tooLongPostalCode() }),
      ['billing_postal_code'],
      'Verify the body has a billing_postal_code key with at least one message.'
    );
  });

  test('API-0485: Create invoice returns 201 with the invoice, its totals and lines', async ({
    usersService,
    adminUsersService,
    authService,
    productsService,
    cartsService,
    invoicesClientForToken,
    cleanup,
  }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;
    let created: InvoiceCreated;

    const customer = await loggedInCustomer({ usersService, adminUsersService, authService, cleanup });
    const productId = await takeFirstProductId(productsService, FIRST_PRODUCT_STEP);
    const cartId = await createCart(cartsService, cleanup);
    await addItemSetup(cartsService, cartId, productId, 2, ADD_TWO_STEP);
    const client = invoicesClientForToken(customer.token);

    await test.step(
      'Send POST /invoices with that access_token, payment_method "cash-on-delivery", payment_details {}, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT" and the cart\'s id as cart_id, and take the new invoice\'s id, invoice_number and total.',
      async () => {
        ({ request, response } = await sendCreateInvoice(client, InvoiceFactory.cashOnDelivery(cartId), AUTH.newUser));
      }
    );

    await test.step('Verify the response status is 201.', async () => {
      expectStatus(request, response, 201);
    });

    await test.step(
      'Verify the body has the keys id, user_id, invoice_number, invoice_date, billing_street, billing_city, billing_country, subtotal, total, additional_discount_percentage, additional_discount_amount, eco_discount_percentage, eco_discount_amount and created_at.',
      async () => {
        created = parseCreated(response);
        expectKeys(request, created, CREATED_KEYS);
      }
    );

    await test.step("Verify the body's user_id equals the new user's id.", async () => {
      expect(created.user_id, assertMessage({ request, expected: `user_id is the new user's id ${customer.id}`, actual: { user_id: created.user_id } })).toBe(customer.id);
    });

    await test.step("Verify the body's invoice_number is INV- followed by a 4-digit year and 6 digits.", async () => {
      expect(created.invoice_number, assertMessage({ request, expected: 'invoice_number matches INV-<4-digit year><6 digits>', actual: created.invoice_number })).toMatch(
        /^INV-\d{4}\d{6}$/
      );
    });

    await test.step(
      'Verify GET /invoices/{invoiceId} with the new id and that token returns 200 with exactly one line with the product\'s id as product_id and quantity 2, and payment.payment_method "cash-on-delivery".',
      async () => {
        const { request: getRequest, invoice } = await readInvoiceOk(client, created.id, AUTH.newUser);
        expectSingleInvoiceLine(getRequest, invoice, productId, 2);
        expectPaymentMethod(getRequest, invoice, 'cash-on-delivery');
      }
    );
  });

  test('API-0486: Create invoice for a cart without items returns 201 with a total of 0', async ({
    usersService,
    adminUsersService,
    authService,
    cartsService,
    invoicesClientForToken,
    cleanup,
  }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;
    let created: InvoiceCreated;

    const customer = await loggedInCustomer({ usersService, adminUsersService, authService, cleanup });
    const cartId = await createCart(cartsService, cleanup);
    const client = invoicesClientForToken(customer.token);

    await test.step(
      'Send POST /invoices with that access_token, payment_method "cash-on-delivery", payment_details {}, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT" and the cart\'s id as cart_id, and take the new invoice\'s id, invoice_number and total.',
      async () => {
        ({ request, response } = await sendCreateInvoice(client, InvoiceFactory.cashOnDelivery(cartId), AUTH.newUser));
      }
    );

    await test.step('Verify the response status is 201.', async () => {
      expectStatus(request, response, 201);
    });

    await test.step("Verify the body's total is 0.", async () => {
      created = parseCreated(response);
      expect(created.total, assertMessage({ request, expected: 'total is 0', actual: { total: created.total } })).toBe(0);
    });

    await test.step('Verify GET /invoices/{invoiceId} with the new id and that token returns 200 with invoicelines as an empty array.', async () => {
      const { request: getRequest, invoice } = await readInvoiceOk(client, created.id, AUTH.newUser);
      expect(
        Array.isArray(invoice.invoicelines) && invoice.invoicelines.length === 0,
        assertMessage({ request: getRequest, expected: 'invoicelines is an empty array', actual: invoice.invoicelines })
      ).toBe(true);
    });
  });

  test('API-0487: Create invoice with a bank-transfer payment returns 201', async ({
    usersService,
    adminUsersService,
    authService,
    cartsService,
    invoicesClientForToken,
    cleanup,
  }) => {
    await expectPaymentStored(
      { usersService, adminUsersService, authService, cartsService, invoicesClientForToken, cleanup },
      'bank-transfer',
      InvoiceFactory.bankTransferDetails(),
      'Send POST /invoices with that access_token, payment_method "bank-transfer", payment_details with a bank_name of at most 70 characters, an account_name of at most 70 and an account_number of at most 40, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT" and the cart\'s id as cart_id, and take the new invoice\'s id.',
      'Verify GET /invoices/{invoiceId} with the new id and that token returns 200 with payment.payment_method "bank-transfer" and payment.payment_details holding the bank_name, account_name and account_number sent.'
    );
  });

  test('API-0488: Create invoice with a credit-card payment returns 201', async ({
    usersService,
    adminUsersService,
    authService,
    cartsService,
    invoicesClientForToken,
    cleanup,
  }) => {
    await expectPaymentStored(
      { usersService, adminUsersService, authService, cartsService, invoicesClientForToken, cleanup },
      'credit-card',
      InvoiceFactory.creditCardDetails(),
      'Send POST /invoices with that access_token, payment_method "credit-card", payment_details with a credit_card_number of at most 40 characters, an expiration_date of at most 10, a cvv of at most 10 and a card_holder_name of at most 70, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT" and the cart\'s id as cart_id, and take the new invoice\'s id.',
      'Verify GET /invoices/{invoiceId} with the new id and that token returns 200 with payment.payment_method "credit-card" and payment.payment_details holding the credit_card_number, expiration_date, cvv and card_holder_name sent.'
    );
  });

  test('API-0489: Create invoice with a buy-now-pay-later payment returns 201', async ({
    usersService,
    adminUsersService,
    authService,
    cartsService,
    invoicesClientForToken,
    cleanup,
  }) => {
    await expectPaymentStored(
      { usersService, adminUsersService, authService, cartsService, invoicesClientForToken, cleanup },
      'buy-now-pay-later',
      InvoiceFactory.buyNowPayLaterDetails(),
      'Send POST /invoices with that access_token, payment_method "buy-now-pay-later", payment_details with a monthly_installments of at most 40 characters, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT" and the cart\'s id as cart_id, and take the new invoice\'s id.',
      'Verify GET /invoices/{invoiceId} with the new id and that token returns 200 with payment.payment_method "buy-now-pay-later" and payment.payment_details holding the monthly_installments sent.'
    );
  });

  test('API-0490: Create invoice with a gift-card payment returns 201', async ({
    usersService,
    adminUsersService,
    authService,
    cartsService,
    invoicesClientForToken,
    cleanup,
  }) => {
    await expectPaymentStored(
      { usersService, adminUsersService, authService, cartsService, invoicesClientForToken, cleanup },
      'gift-card',
      InvoiceFactory.giftCardDetails(),
      'Send POST /invoices with that access_token, payment_method "gift-card", payment_details with a 16-character alphanumeric gift_card_number and a 4-character alphanumeric validation_code, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT" and the cart\'s id as cart_id, and take the new invoice\'s id.',
      'Verify GET /invoices/{invoiceId} with the new id and that token returns 200 with payment.payment_method "gift-card" and payment.payment_details holding the gift_card_number and validation_code sent.'
    );
  });

  test('API-0491: Create invoice without a token returns 401', async ({ invoicesClient }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;

    await test.step(
      'Send POST /invoices without an Authorization header, with payment_method "cash-on-delivery", payment_details {}, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT" and a non-empty string as cart_id.',
      async () => {
        ({ request, response } = await sendCreateInvoice(invoicesClient, validationBody(), AUTH.none));
      }
    );

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test('API-0492: Create invoice without payment_method, payment_details and cart_id returns 422 for each of them', async ({ invoicesClientWithToken }) => {
    await expectValidationError(
      invoicesClientWithToken,
      'Send POST /invoices with the default user\'s token, billing_street "Stephansplatz 1", billing_city "Wien" and billing_country "AT", without payment_method, payment_details and cart_id.',
      { billing_street: 'Stephansplatz 1', billing_city: 'Wien', billing_country: 'AT' },
      ['payment_method', 'payment_details', 'cart_id'],
      'Verify the body has the keys payment_method, payment_details and cart_id, each with at least one message.'
    );
  });

  test('API-0493: Create invoice with a payment method that is not allowed returns 422', async ({ invoicesClientWithToken }) => {
    await expectValidationError(
      invoicesClientWithToken,
      'Send POST /invoices with the default user\'s token, payment_method "bitcoin", payment_details {}, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT" and a non-empty string as cart_id.',
      { ...validationBody(), payment_method: 'bitcoin' },
      ['payment_method'],
      'Verify the body has a payment_method key with at least one message.'
    );
  });

  test('API-0494: Create invoice with a gift card number that is not 16 characters returns 422', async ({ invoicesClientWithToken }) => {
    await expectValidationError(
      invoicesClientWithToken,
      'Send POST /invoices with the default user\'s token, payment_method "gift-card", payment_details with a 15-character gift_card_number and a 4-character validation_code, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT" and a non-empty string as cart_id.',
      validationBody({ payment_method: 'gift-card', payment_details: InvoiceFactory.giftCardDetails({ gift_card_number: InvoiceFactory.shortGiftCardNumber() }) }),
      ['payment_details.gift_card_number'],
      'Verify the body has a "payment_details.gift_card_number" key with at least one message.'
    );
  });

  test('API-0495: Create invoice with a gift card validation code that is not 4 characters returns 422', async ({ invoicesClientWithToken }) => {
    await expectValidationError(
      invoicesClientWithToken,
      'Send POST /invoices with the default user\'s token, payment_method "gift-card", payment_details with a 16-character gift_card_number and a 3-character validation_code, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT" and a non-empty string as cart_id.',
      validationBody({ payment_method: 'gift-card', payment_details: InvoiceFactory.giftCardDetails({ validation_code: '1a2' }) }),
      ['payment_details.validation_code'],
      'Verify the body has a "payment_details.validation_code" key with at least one message.'
    );
  });

  test('API-0496: Create invoice with a superscript character in the billing street returns 422', async ({ invoicesClientWithToken }) => {
    await expectValidationError(
      invoicesClientWithToken,
      'Send POST /invoices with the default user\'s token, payment_method "cash-on-delivery", payment_details {}, a billing_street containing the superscript digit four (U+2074), billing_city "Wien", billing_country "AT" and a non-empty string as cart_id.',
      validationBody({ billing_street: InvoiceFactory.superscriptStreet() }),
      ['billing_street'],
      'Verify the body has a billing_street key with at least one message.'
    );
  });

  test("API-0497: Create invoice with a postal code that doesn't match the country returns 422", async ({ invoicesClientWithToken }) => {
    await expectValidationError(
      invoicesClientWithToken,
      'Send POST /invoices with the default user\'s token, payment_method "cash-on-delivery", payment_details {}, billing_street "Stephansplatz 1", billing_city "Amsterdam", billing_country "NL", a billing_postal_code that doesn\'t match the Dutch format (for example "ABCDE") and a non-empty string as cart_id.',
      validationBody(InvoiceFactory.mismatchedDutchPostcode()),
      ['billing_country'],
      'Verify the body has a billing_country key with at least one message.'
    );
  });

  test('API-0498: Create invoice with an unknown cart returns 404', async ({ usersService, adminUsersService, authService, invoicesClientForToken, cleanup }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;

    // BUG-040 leaves the customer an invoice without lines, so its admin delete may answer 409 (deleteUnlessInUse expects it).
    const customer = await loggedInCustomer({ usersService, adminUsersService, authService, cleanup });

    await test.step(
      'Send POST /invoices with that access_token, payment_method "cash-on-delivery", payment_details {}, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT" and a well-formed ULID that no cart has as cart_id.',
      async () => {
        ({ request, response } = await sendCreateInvoice(invoicesClientForToken(customer.token), validationBody(), AUTH.newUser));
      }
    );

    await test.step('Verify the response status is 404.', async () => {
      expectStatus(request, response, 404);
    });

    await test.step('Verify the body\'s message is "Requested item not found".', async () => {
      expectMessage(request, response, 'Requested item not found');
    });
  });

  test('API-0499: Create invoice with an unknown cart leaves no invoice behind', async ({ usersService, adminUsersService, authService, invoicesClientForToken, cleanup }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;

    const customer = await loggedInCustomer({ usersService, adminUsersService, authService, cleanup });
    const client = invoicesClientForToken(customer.token);
    test.fail(true, 'Known issue BUG-040: A failed checkout (unknown cart) leaves an invoice without lines or payment in the customer\'s invoice list.');

    await test.step(
      'Send POST /invoices with that access_token, payment_method "cash-on-delivery", payment_details {}, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT" and a well-formed ULID that no cart has as cart_id.',
      async () => {
        await sendCreateInvoice(client, validationBody(), AUTH.newUser);
      }
    );

    await test.step('Send GET /invoices with that access_token.', async () => {
      ({ request, response } = await sendListInvoices(client, AUTH.newUser));
    });

    await test.step("Verify the body's total is 0.", async () => {
      expectNoInvoiceLeft(request, response);
    });
  });

  test('API-0500: Create invoice with payment_details null returns 422', async ({
    usersService,
    adminUsersService,
    authService,
    cartsService,
    invoicesClientForToken,
    cleanup,
  }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;

    const customer = await loggedInCustomer({ usersService, adminUsersService, authService, cleanup });
    const cartId = await createCart(cartsService, cleanup);
    test.fail(true, 'Known issue BUG-041: Returns 500 instead of 422 when payment_details is null for a method other than gift-card.');

    await test.step(
      'Send POST /invoices with that access_token, payment_method "bank-transfer", payment_details null, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT" and the cart\'s id as cart_id.',
      async () => {
        const body = { ...InvoiceFactory.cashOnDelivery(cartId), ...InvoiceFactory.nullBankTransferDetails() };
        ({ request, response } = await sendCreateInvoice(invoicesClientForToken(customer.token), body, AUTH.newUser));
      }
    );

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });
  });

  test('API-0501: Create invoice with bank-transfer details missing the required fields returns 422', async ({
    usersService,
    adminUsersService,
    authService,
    cartsService,
    invoicesClientForToken,
    cleanup,
  }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;

    const customer = await loggedInCustomer({ usersService, adminUsersService, authService, cleanup });
    const cartId = await createCart(cartsService, cleanup);
    test.fail(true, 'Known issue BUG-041: Returns 500 "Something went wrong" instead of 422 when payment_details lacks the fields the payment method requires.');

    await test.step(
      'Send POST /invoices with that access_token, payment_method "bank-transfer", payment_details {}, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT" and the cart\'s id as cart_id.',
      async () => {
        ({ request, response } = await sendCreateInvoice(invoicesClientForToken(customer.token), InvoiceFactory.withPayment(cartId, 'bank-transfer', {}), AUTH.newUser));
      }
    );

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });
  });

  test('API-0668: Create invoice with payment_details null leaves no invoice behind', async ({
    usersService,
    adminUsersService,
    authService,
    cartsService,
    invoicesClientForToken,
    cleanup,
  }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;

    const customer = await loggedInCustomer({ usersService, adminUsersService, authService, cleanup });
    const cartId = await createCart(cartsService, cleanup);
    const client = invoicesClientForToken(customer.token);
    test.fail(true, 'Known issue BUG-040: A failed checkout (payment_details null) leaves an invoice without lines or payment in the customer\'s invoice list.');

    await test.step(
      'Send POST /invoices with that access_token, payment_method "bank-transfer", payment_details null, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT" and the cart\'s id as cart_id.',
      async () => {
        // The scenario checks no status here: the call answers 500 while BUG-041 is open, so it goes through the client.
        const body = { ...InvoiceFactory.cashOnDelivery(cartId), ...InvoiceFactory.nullBankTransferDetails() };
        await sendCreateInvoice(client, body, AUTH.newUser);
      }
    );

    await test.step('Send GET /invoices with that access_token.', async () => {
      ({ request, response } = await sendListInvoices(client, AUTH.newUser));
    });

    await test.step("Verify the body's total is 0.", async () => {
      expectNoInvoiceLeft(request, response);
    });
  });
});
