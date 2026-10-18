import { test, expect } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { PaymentClient } from '@api/clients/PaymentClient';
import type { FieldValidationError } from '@api/dto/common';
import type { PaymentCheckResponse } from '@api/dto/payment';
import { PaymentFactory } from '@data/factories/PaymentFactory';
import { describeAccept, expectContentTypeStartsWith, expectErrorKeys, expectLocation, expectNoOtherKeys, expectStatus } from '@utils/apiChecks';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/payment/post-payment-check.yml

const SUCCESS_MESSAGE = 'Payment was successful';
/** Where the API redirects a failed validation that doesn't ask for JSON (the steps name it literally). */
const REDIRECT_LOCATION = 'https://api.practicesoftwaretesting.com';

type CheckRequest = {
  method: 'POST';
  path: '/payment/check';
  headers: { Accept: string; Authorization?: string };
  followRedirects?: false;
  body: unknown;
};

type CheckOptions = {
  /** The Accept header; `null` leaves it out (Playwright then sends its default `*` + `/*`). */
  accept?: string | null;
  /** `false` returns a 3xx as it is. */
  followRedirects?: false;
};

/** Sends POST /payment/check and attaches the request and the response. */
async function sendCheck(
  client: PaymentClient,
  body: Record<string, unknown>,
  options: CheckOptions & {
    /** Attach the invalid token header to the request record (the client fixture sends it). */
    invalidToken?: boolean;
  } = {}
): Promise<{ request: CheckRequest; response: ApiResponse }> {
  const request: CheckRequest = {
    method: 'POST',
    path: '/payment/check',
    headers: { Accept: describeAccept(options.accept), ...(options.invalidToken ? { Authorization: 'Bearer <an invalid, made-up token>' } : {}) },
    ...(options.followRedirects === false ? { followRedirects: false as const } : {}),
    body,
  };
  const response = await client.check(body, {
    accept: options.accept,
    maxRedirects: options.followRedirects === false ? 0 : undefined,
  });
  await attachJson('Payment Check Request', request);
  await attachJson('Payment Check Response', { status: response.status, headers: response.headers, body: response.body });
  return { request, response };
}

/** The checks of a "Verify the body's message is "Payment was successful"." step. */
function expectSuccessMessage(request: CheckRequest, response: ApiResponse): void {
  const body = JSON.parse(response.body) as PaymentCheckResponse;
  expect(body.message, assertMessage({ request, expected: `message is "${SUCCESS_MESSAGE}"`, actual: body })).toBe(SUCCESS_MESSAGE);
}

/** The checks of a "Verify that message contains "..."." step: the key's first message. */
function expectFirstMessageContains(request: CheckRequest, body: FieldValidationError, key: string, text: string): void {
  const message = body.errors?.[key]?.[0];
  expect(message, assertMessage({ request, expected: `The first message of "${key}" contains "${text}"`, actual: body.errors?.[key] })).toContain(text);
}

/**
 * The common shape of the "one invalid field" scenarios: send, then 422, then the key, then (optionally) the
 * message text and "no other keys". Each call passes the scenario's step titles verbatim.
 */
async function checkSingleFieldError(
  client: PaymentClient,
  sendStep: string,
  body: Record<string, unknown>,
  key: string,
  checks: { contains?: { step: string; text: string }; noOtherKeys: boolean }
): Promise<void> {
  let request: CheckRequest;
  let response: ApiResponse;
  let errorBody: FieldValidationError;

  await test.step(sendStep, async () => {
    ({ request, response } = await sendCheck(client, body));
  });

  await test.step('Verify the response status is 422.', async () => {
    expectStatus(request, response, 422);
  });

  await test.step(`Verify the body's errors has the key ${key} with at least one message.`, async () => {
    errorBody = expectErrorKeys(request, response, [key]);
  });

  if (checks.contains) {
    const { step, text } = checks.contains;
    await test.step(step, async () => {
      expectFirstMessageContains(request, errorBody, key, text);
    });
  }

  if (checks.noOtherKeys) {
    await test.step('Verify the body\'s errors has no other keys.', async () => {
      expectNoOtherKeys(request, errorBody, [key]);
    });
  }
}

/** The common shape of the success scenarios: send, then 200, then the success message. */
async function checkSuccess(
  client: PaymentClient,
  sendStep: string,
  body: Record<string, unknown>,
  options: CheckOptions & { invalidToken?: boolean } = {}
): Promise<void> {
  let request: CheckRequest;
  let response: ApiResponse;

  await test.step(sendStep, async () => {
    ({ request, response } = await sendCheck(client, body, options));
  });

  await test.step('Verify the response status is 200.', async () => {
    expectStatus(request, response, 200);
  });

  await test.step('Verify the body\'s message is "Payment was successful".', async () => {
    expectSuccessMessage(request, response);
  });
}

/** The common shape of the "missing details" scenarios: send without payment_details, then 422, then every key. */
async function checkMissingDetails(client: PaymentClient, sendStep: string, body: Record<string, unknown>, keysStep: string, keys: string[]): Promise<void> {
  let request: CheckRequest;
  let response: ApiResponse;

  await test.step(sendStep, async () => {
    ({ request, response } = await sendCheck(client, body));
  });

  await test.step('Verify the response status is 422.', async () => {
    expectStatus(request, response, 422);
  });

  await test.step(keysStep, async () => {
    expectErrorKeys(request, response, keys);
  });
}

/** The common shape of the redirect scenarios: send without following redirects, then 302, then the Location. */
async function checkRedirect(client: PaymentClient, sendStep: string, accept: string | null): Promise<void> {
  let request: CheckRequest;
  let response: ApiResponse;

  await test.step(sendStep, async () => {
    ({ request, response } = await sendCheck(client, { payment_method: 'bank-transfer' }, { accept, followRedirects: false }));
  });

  await test.step('Verify the response status is 302.', async () => {
    expectStatus(request, response, 302);
  });

  await test.step('Verify the Location header is "https://api.practicesoftwaretesting.com".', async () => {
    expectLocation(request, response, REDIRECT_LOCATION);
  });
}

const BANK_TRANSFER_KEYS = ['payment_details.bank_name', 'payment_details.account_name', 'payment_details.account_number'];
const CREDIT_CARD_KEYS = [
  'payment_details.credit_card_number',
  'payment_details.expiration_date',
  'payment_details.cvv',
  'payment_details.card_holder_name',
];

test.describe('@payment-api - Payment API', () => {
  test.use({ authMode: 'none' });

  test('API-0614: Check bank transfer details returns 200', async ({ paymentClient }) => {
    await checkSuccess(
      paymentClient,
      'Send POST /payment/check without an Authorization header, with payment_method "bank-transfer" and payment_details { bank_name: "Test Bank", account_name: "Jane Doe", account_number: "123456789" }.',
      { payment_method: 'bank-transfer', payment_details: PaymentFactory.bankTransfer() }
    );
  });

  test('API-0615: Check credit card details returns 200', { tag: '@smoke' }, async ({ paymentClient }) => {
    await checkSuccess(
      paymentClient,
      'Send POST /payment/check without an Authorization header, with payment_method "credit-card" and payment_details { credit_card_number: "1234-5678-9101-1121", expiration_date: the same month next year in m/Y form, cvv: "123", card_holder_name: "Jane Doe" }.',
      { payment_method: 'credit-card', payment_details: PaymentFactory.creditCard() }
    );
  });

  test('API-0616: Check buy now pay later details returns 200', async ({ paymentClient }) => {
    await checkSuccess(
      paymentClient,
      'Send POST /payment/check without an Authorization header, with payment_method "buy-now-pay-later" and payment_details { monthly_installments: 6 }.',
      { payment_method: 'buy-now-pay-later', payment_details: { monthly_installments: 6 } }
    );
  });

  test('API-0617: Check gift card details returns 200', async ({ paymentClient }) => {
    await checkSuccess(
      paymentClient,
      'Send POST /payment/check without an Authorization header, with payment_method "gift-card" and payment_details { gift_card_number: "ABCD1234efgh5678", validation_code: "1a2B" }.',
      { payment_method: 'gift-card', payment_details: PaymentFactory.giftCard() }
    );
  });

  test('API-0618: Check cash on delivery with empty payment details returns 200', async ({ paymentClient }) => {
    await checkSuccess(
      paymentClient,
      'Send POST /payment/check without an Authorization header, with payment_method "cash-on-delivery" and payment_details as an empty object.',
      { payment_method: 'cash-on-delivery', payment_details: {} }
    );
  });

  test('API-0619: Check payment with Accept text/xml returns the answer as XML', async ({ paymentClient }) => {
    const expectedXml = '<response><message>Payment was successful</message></response>';
    let request: CheckRequest;
    let response: ApiResponse;

    await test.step(
      'Send POST /payment/check without an Authorization header, with Accept: text/xml, payment_method "gift-card" and payment_details { gift_card_number: "ABCD1234efgh5678", validation_code: "1a2B" }.',
      async () => {
        ({ request, response } = await sendCheck(
          paymentClient,
          { payment_method: 'gift-card', payment_details: PaymentFactory.giftCard() },
          { accept: 'text/xml' }
        ));
      }
    );

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the Content-Type header starts with "text/xml".', async () => {
      expectContentTypeStartsWith(request, response, 'text/xml');
    });

    await test.step('Verify the body is <response><message>Payment was successful</message></response>.', async () => {
      // The document without its XML declaration (`<?xml version="1.0"?>`) and the whitespace around it.
      const document = response.body.trim().replace(/^<\?xml[^?]*\?>/, '').trim();
      expect(document, assertMessage({ request, expected: `The XML document is ${expectedXml}`, actual: response.body })).toBe(expectedXml);
    });
  });

  test('API-0620: Check payment with an invalid token returns 200', async ({ paymentClientWithInvalidToken }) => {
    await checkSuccess(
      paymentClientWithInvalidToken,
      'Send POST /payment/check with an Authorization header holding an invalid token (a made-up string, not issued by the API), payment_method "cash-on-delivery" and payment_details as an empty object.',
      { payment_method: 'cash-on-delivery', payment_details: {} },
      { invalidToken: true }
    );
  });

  test('API-0621: Check bank transfer without payment details returns 422 for every field', async ({ paymentClient }) => {
    const expectedMessage = 'The payment details.bank name field is required. (and 2 more errors)';
    let request: CheckRequest;
    let response: ApiResponse;
    let errorBody: FieldValidationError;

    await test.step('Send POST /payment/check without an Authorization header, with payment_method "bank-transfer" and no payment_details.', async () => {
      ({ request, response } = await sendCheck(paymentClient, { payment_method: 'bank-transfer' }));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step(
      'Verify the body\'s errors has the keys payment_details.bank_name, payment_details.account_name and payment_details.account_number, each with at least one message.',
      async () => {
        errorBody = expectErrorKeys(request, response, BANK_TRANSFER_KEYS);
      }
    );

    await test.step('Verify the body\'s message is "The payment details.bank name field is required. (and 2 more errors)".', async () => {
      expect(errorBody.message, assertMessage({ request, expected: `message is "${expectedMessage}"`, actual: errorBody.message })).toBe(expectedMessage);
    });
  });

  test('API-0622: Check credit card without payment details returns 422 for every field', async ({ paymentClient }) => {
    await checkMissingDetails(
      paymentClient,
      'Send POST /payment/check without an Authorization header, with payment_method "credit-card" and no payment_details.',
      { payment_method: 'credit-card' },
      'Verify the body\'s errors has the keys payment_details.credit_card_number, payment_details.expiration_date, payment_details.cvv and payment_details.card_holder_name, each with at least one message.',
      CREDIT_CARD_KEYS
    );
  });

  test('API-0623: Check buy now pay later without payment details returns 422', async ({ paymentClient }) => {
    await checkMissingDetails(
      paymentClient,
      'Send POST /payment/check without an Authorization header, with payment_method "buy-now-pay-later" and no payment_details.',
      { payment_method: 'buy-now-pay-later' },
      'Verify the body\'s errors has the key payment_details.monthly_installments with at least one message.',
      ['payment_details.monthly_installments']
    );
  });

  test('API-0624: Check gift card without payment details returns 422 for every field', async ({ paymentClient }) => {
    await checkMissingDetails(
      paymentClient,
      'Send POST /payment/check without an Authorization header, with payment_method "gift-card" and no payment_details.',
      { payment_method: 'gift-card' },
      'Verify the body\'s errors has the keys payment_details.gift_card_number and payment_details.validation_code, each with at least one message.',
      ['payment_details.gift_card_number', 'payment_details.validation_code']
    );
  });

  test('API-0625: Check bank transfer with payment_details that is not an object returns 422', async ({ paymentClient }) => {
    await checkMissingDetails(
      paymentClient,
      'Send POST /payment/check without an Authorization header, with payment_method "bank-transfer" and payment_details "abc" (a string, not an object).',
      { payment_method: 'bank-transfer', payment_details: 'abc' },
      'Verify the body\'s errors has the keys payment_details.bank_name, payment_details.account_name and payment_details.account_number, each with at least one message.',
      BANK_TRANSFER_KEYS
    );
  });

  test('API-0626: Check bank transfer with digits in the bank name returns 422', async ({ paymentClient }) => {
    await checkSingleFieldError(
      paymentClient,
      'Send POST /payment/check without an Authorization header, with payment_method "bank-transfer" and payment_details { bank_name: "Bank123", account_name: "Jane Doe", account_number: "123456789" }.',
      { payment_method: 'bank-transfer', payment_details: PaymentFactory.bankTransfer({ bank_name: 'Bank123' }) },
      'payment_details.bank_name',
      { noOtherKeys: true }
    );
  });

  test('API-0627: Check bank transfer with disallowed characters in the account name returns 422', async ({ paymentClient }) => {
    await checkSingleFieldError(
      paymentClient,
      'Send POST /payment/check without an Authorization header, with payment_method "bank-transfer" and payment_details { bank_name: "Test Bank", account_name: "Jane@Doe!", account_number: "123456789" }.',
      { payment_method: 'bank-transfer', payment_details: PaymentFactory.bankTransfer({ account_name: 'Jane@Doe!' }) },
      'payment_details.account_name',
      { noOtherKeys: true }
    );
  });

  test('API-0628: Check bank transfer with letters in the account number returns 422', async ({ paymentClient }) => {
    await checkSingleFieldError(
      paymentClient,
      'Send POST /payment/check without an Authorization header, with payment_method "bank-transfer" and payment_details { bank_name: "Test Bank", account_name: "Jane Doe", account_number: "12AB34" }.',
      { payment_method: 'bank-transfer', payment_details: PaymentFactory.bankTransfer({ account_number: '12AB34' }) },
      'payment_details.account_number',
      { noOtherKeys: true }
    );
  });

  test('API-0629: Check bank transfer with a bank name over 255 characters returns 422', async ({ paymentClient }) => {
    await checkSingleFieldError(
      paymentClient,
      'Send POST /payment/check without an Authorization header, with payment_method "bank-transfer" and payment_details { bank_name: a string of 256 letters, account_name: "Jane Doe", account_number: "123456789" }.',
      { payment_method: 'bank-transfer', payment_details: PaymentFactory.bankTransfer({ bank_name: 'a'.repeat(256) }) },
      'payment_details.bank_name',
      { noOtherKeys: true }
    );
  });

  test('API-0630: Check credit card number without dashes returns 422', async ({ paymentClient }) => {
    await checkSingleFieldError(
      paymentClient,
      'Send POST /payment/check without an Authorization header, with payment_method "credit-card" and payment_details { credit_card_number: "1234567891011121", expiration_date: the same month next year in m/Y form, cvv: "123", card_holder_name: "Jane Doe" }.',
      { payment_method: 'credit-card', payment_details: PaymentFactory.creditCard({ credit_card_number: '1234567891011121' }) },
      'payment_details.credit_card_number',
      { noOtherKeys: true }
    );
  });

  test('API-0631: Check credit card with an expiration date in the past returns 422', async ({ paymentClient }) => {
    await checkSingleFieldError(
      paymentClient,
      'Send POST /payment/check without an Authorization header, with payment_method "credit-card" and payment_details { credit_card_number: "1234-5678-9101-1121", expiration_date: the same month one year ago in m/Y form, cvv: "123", card_holder_name: "Jane Doe" }.',
      { payment_method: 'credit-card', payment_details: PaymentFactory.creditCard({ expiration_date: PaymentFactory.expirationDate(-12) }) },
      'payment_details.expiration_date',
      { contains: { step: 'Verify that message contains "must be a date after today".', text: 'must be a date after today' }, noOtherKeys: true }
    );
  });

  test('API-0632: Check credit card expiring in the current month returns 422', async ({ paymentClient }) => {
    await checkSingleFieldError(
      paymentClient,
      'Send POST /payment/check without an Authorization header, with payment_method "credit-card" and payment_details { credit_card_number: "1234-5678-9101-1121", expiration_date: the current month in m/Y form, cvv: "123", card_holder_name: "Jane Doe" }.',
      { payment_method: 'credit-card', payment_details: PaymentFactory.creditCard({ expiration_date: PaymentFactory.expirationDate(0) }) },
      'payment_details.expiration_date',
      { contains: { step: 'Verify that message contains "must be a date after today".', text: 'must be a date after today' }, noOtherKeys: false }
    );
  });

  test('API-0633: Check credit card with an expiration date in the wrong format returns 422', async ({ paymentClient }) => {
    await checkSingleFieldError(
      paymentClient,
      'Send POST /payment/check without an Authorization header, with payment_method "credit-card" and payment_details { credit_card_number: "1234-5678-9101-1121", expiration_date: "2099-12", cvv: "123", card_holder_name: "Jane Doe" }.',
      { payment_method: 'credit-card', payment_details: PaymentFactory.creditCard({ expiration_date: '2099-12' }) },
      'payment_details.expiration_date',
      { contains: { step: 'Verify that message contains "must match the format m/Y".', text: 'must match the format m/Y' }, noOtherKeys: true }
    );
  });

  test('API-0634: Check credit card with a 2-digit cvv returns 422', async ({ paymentClient }) => {
    await checkSingleFieldError(
      paymentClient,
      'Send POST /payment/check without an Authorization header, with payment_method "credit-card" and payment_details { credit_card_number: "1234-5678-9101-1121", expiration_date: the same month next year in m/Y form, cvv: "12", card_holder_name: "Jane Doe" }.',
      { payment_method: 'credit-card', payment_details: PaymentFactory.creditCard({ cvv: '12' }) },
      'payment_details.cvv',
      { noOtherKeys: true }
    );
  });

  test('API-0635: Check credit card with digits in the card holder name returns 422', async ({ paymentClient }) => {
    await checkSingleFieldError(
      paymentClient,
      'Send POST /payment/check without an Authorization header, with payment_method "credit-card" and payment_details { credit_card_number: "1234-5678-9101-1121", expiration_date: the same month next year in m/Y form, cvv: "123", card_holder_name: "John123" }.',
      { payment_method: 'credit-card', payment_details: PaymentFactory.creditCard({ card_holder_name: 'John123' }) },
      'payment_details.card_holder_name',
      { noOtherKeys: true }
    );
  });

  test('API-0636: Check buy now pay later with a non-numeric installments value returns 422', async ({ paymentClient }) => {
    await checkSingleFieldError(
      paymentClient,
      'Send POST /payment/check without an Authorization header, with payment_method "buy-now-pay-later" and payment_details { monthly_installments: "abc" }.',
      { payment_method: 'buy-now-pay-later', payment_details: { monthly_installments: 'abc' } },
      'payment_details.monthly_installments',
      { contains: { step: 'Verify that message contains "must be a number".', text: 'must be a number' }, noOtherKeys: false }
    );
  });

  test('API-0637: Check gift card with a 15-character card number returns 422', async ({ paymentClient }) => {
    await checkSingleFieldError(
      paymentClient,
      'Send POST /payment/check without an Authorization header, with payment_method "gift-card" and payment_details { gift_card_number: a string of 15 letters and digits, validation_code: "1a2B" }.',
      { payment_method: 'gift-card', payment_details: PaymentFactory.giftCard({ gift_card_number: 'ABCD1234efgh567' }) },
      'payment_details.gift_card_number',
      { noOtherKeys: true }
    );
  });

  test('API-0638: Check gift card with a 3-character validation code returns 422', async ({ paymentClient }) => {
    await checkSingleFieldError(
      paymentClient,
      'Send POST /payment/check without an Authorization header, with payment_method "gift-card" and payment_details { gift_card_number: "ABCD1234efgh5678", validation_code: "1a2" }.',
      { payment_method: 'gift-card', payment_details: PaymentFactory.giftCard({ validation_code: '1a2' }) },
      'payment_details.validation_code',
      { noOtherKeys: true }
    );
  });

  test('API-0639: Check invalid payment details without Accept application/json returns a 302 redirect', async ({ paymentClient }) => {
    await checkRedirect(
      paymentClient,
      'Send POST /payment/check without an Authorization header, without following redirects and with the Accept header left out, with payment_method "bank-transfer" and no payment_details.',
      null
    );
  });

  test('API-0640: Check invalid payment details with Accept text/xml returns a 302 redirect', async ({ paymentClient }) => {
    await checkRedirect(
      paymentClient,
      'Send POST /payment/check without an Authorization header, without following redirects and with Accept: text/xml, with payment_method "bank-transfer" and no payment_details.',
      'text/xml'
    );
  });

  test('API-0641: Check payment with a payment method in a different case skips validation and returns 200', async ({ paymentClient }) => {
    await checkSuccess(
      paymentClient,
      'Send POST /payment/check without an Authorization header, with payment_method "Bank Transfer" and no payment_details.',
      { payment_method: 'Bank Transfer' }
    );
  });

  test('API-0642: Check payment with an empty body returns 200', async ({ paymentClient }) => {
    await checkSuccess(paymentClient, 'Send POST /payment/check without an Authorization header, with an empty JSON object as the body.', {});
  });
});
