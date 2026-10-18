import { test, expect } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { PostcodeClient } from '@api/clients/PostcodeClient';
import type { FieldValidationError } from '@api/dto/common';
import type { PostcodeFormatError, PostcodeLookupQuery, PostcodeLookupResult } from '@api/dto/postcode';
import { describeAccept, expectContentTypeStartsWith, expectErrorKeys, expectLocation, expectNoOtherKeys, expectStatus, parseJson } from '@utils/apiChecks';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/postcode/get-postcode-lookup.yml

/** The Dutch input most scenarios send. */
const NL_QUERY = { country: 'NL', postcode: '1011AB', house_number: '5' } as const;
const RESULT_KEYS = ['street', 'house_number', 'city', 'state', 'country', 'postcode'] as const;
const FORMAT_MESSAGE = 'The postal code format is not valid for the selected country.';
/** Where the API redirects a failed validation that doesn't ask for JSON (the steps name it literally). */
const REDIRECT_LOCATION = 'https://api.practicesoftwaretesting.com';

type LookupRequest = {
  method: 'GET';
  path: '/postcode-lookup';
  query: PostcodeLookupQuery;
  headers: { Accept: string; Authorization?: string };
  followRedirects?: false;
};

type LookupOptions = {
  /** The Accept header; `null` leaves it out (Playwright then sends its default, any type). */
  accept?: string | null;
  /** `false` returns a 3xx as it is. */
  followRedirects?: false;
  /** Attach the invalid token header to the request record (the client fixture sends it). */
  invalidToken?: boolean;
  /** Attachment name prefix, to tell two calls of one test apart. */
  name?: string;
};

/** Sends GET /postcode-lookup and attaches the request and the response. */
async function sendLookup(
  client: PostcodeClient,
  query: PostcodeLookupQuery,
  options: LookupOptions = {}
): Promise<{ request: LookupRequest; response: ApiResponse }> {
  const request: LookupRequest = {
    method: 'GET',
    path: '/postcode-lookup',
    query,
    headers: { Accept: describeAccept(options.accept),...(options.invalidToken ? { Authorization: 'Bearer <an invalid, made-up token>' } : {}) },
    ...(options.followRedirects === false ? { followRedirects: false as const } : {}),
  };
  const response = await client.lookup(query, {
    accept: options.accept,
    maxRedirects: options.followRedirects === false ? 0 : undefined,
  });
  const name = options.name ?? 'Lookup';
  await attachJson(`${name} Request`, request);
  await attachJson(`${name} Response`, { status: response.status, headers: response.headers, body: response.body });
  return { request, response };
}

function parseResult(response: ApiResponse): PostcodeLookupResult {
  return parseJson<PostcodeLookupResult>(undefined, response);
}

/** Checks one field of a 200 body against the expected value. */
function expectField(request: LookupRequest, body: PostcodeLookupResult, field: keyof PostcodeLookupResult, expected: string): void {
  expect(body[field], assertMessage({ request, expected: `${field} is "${expected}"`, actual: body })).toBe(expected);
}

/** The common shape of the parameter validation scenarios: send, 422, the keys, no other keys. */
async function checkValidationError(client: PostcodeClient, sendStep: string, query: PostcodeLookupQuery, keysStep: string, keys: string[]): Promise<void> {
  let request: LookupRequest;
  let response: ApiResponse;
  let errorBody: FieldValidationError;

  await test.step(sendStep, async () => {
    ({ request, response } = await sendLookup(client, query, { accept: 'application/json' }));
  });

  await test.step('Verify the response status is 422.', async () => {
    expectStatus(request, response, 422);
  });

  await test.step(keysStep, async () => {
    errorBody = expectErrorKeys(request, response, keys);
  });

  await test.step('Verify the body\'s errors has no other keys.', async () => {
    expectNoOtherKeys(request, errorBody, keys);
  });
}

/** The common shape of the format scenarios: send, 422, the format message, no errors key. */
async function checkFormatError(client: PostcodeClient, sendStep: string, query: PostcodeLookupQuery): Promise<void> {
  let request: LookupRequest;
  let response: ApiResponse;
  let errorBody: PostcodeFormatError;

  await test.step(sendStep, async () => {
    ({ request, response } = await sendLookup(client, query, { accept: 'application/json' }));
  });

  await test.step('Verify the response status is 422.', async () => {
    expectStatus(request, response, 422);
  });

  await test.step('Verify the body\'s message is "The postal code format is not valid for the selected country.".', async () => {
    errorBody = parseJson<PostcodeFormatError>(request, response);
    expect(errorBody.message, assertMessage({ request, expected: `message is "${FORMAT_MESSAGE}"`, actual: errorBody })).toBe(FORMAT_MESSAGE);
  });

  await test.step('Verify the body has no errors key.', async () => {
    expect('errors' in errorBody, assertMessage({ request, expected: 'The body has no "errors" key', actual: errorBody })).toBe(false);
  });
}

/** The common shape of the redirect scenarios: send without following redirects, 302, the Location. */
async function checkRedirect(client: PostcodeClient, sendStep: string, accept: string | null): Promise<void> {
  let request: LookupRequest;
  let response: ApiResponse;

  await test.step(sendStep, async () => {
    ({ request, response } = await sendLookup(client, {}, { accept, followRedirects: false }));
  });

  await test.step('Verify the response status is 302.', async () => {
    expectStatus(request, response, 302);
  });

  await test.step('Verify the Location header is "https://api.practicesoftwaretesting.com".', async () => {
    expectLocation(request, response, REDIRECT_LOCATION);
  });
}

/** The checks of a "Verify both responses have status 200." step. */
function expectBothOk(calls: { request: LookupRequest; response: ApiResponse }[]): void {
  for (const { request, response } of calls) expectStatus(request, response, 200);
}

/** Checks that two bodies have the same street, city and state. */
function expectSameLocality(request: LookupRequest, first: PostcodeLookupResult, second: PostcodeLookupResult, expected: string): void {
  const pick = ({ street, city, state }: PostcodeLookupResult) => ({ street, city, state });
  expect(pick(second), assertMessage({ request, expected, actual: { first: pick(first), second: pick(second) } })).toEqual(pick(first));
}

test.describe('@postcode-api - Postcode API', () => {
  test.use({ authMode: 'none' });

  test('API-0643: Look up a Dutch postcode returns the address', { tag: '@smoke' }, async ({ postcodeClient }) => {
    let request: LookupRequest;
    let response: ApiResponse;
    let body: PostcodeLookupResult;

    await test.step('Send GET /postcode-lookup without an Authorization header, with country "NL", postcode "1011AB" and house_number "5".', async () => {
      ({ request, response } = await sendLookup(postcodeClient, { ...NL_QUERY }));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
      body = parseResult(response);
    });

    await test.step('Verify the Content-Type header starts with "application/json".', async () => {
      expectContentTypeStartsWith(request, response, 'application/json');
    });

    await test.step('Verify the body has the keys street, house_number, city, state, country and postcode, and each value is a string.', async () => {
      for (const key of RESULT_KEYS) {
        expect(typeof body[key], assertMessage({ request, expected: `"${key}" is a string`, actual: body })).toBe('string');
      }
    });

    await test.step('Verify the body\'s country is "NL".', async () => {
      expectField(request, body, 'country', 'NL');
    });

    await test.step('Verify the body\'s postcode is "1011AB".', async () => {
      expectField(request, body, 'postcode', '1011AB');
    });

    await test.step('Verify the body\'s house_number is "5".', async () => {
      expectField(request, body, 'house_number', '5');
    });
  });

  test('API-0644: Look up without a house number returns a generated one', async ({ postcodeClient }) => {
    let request: LookupRequest;
    let response: ApiResponse;

    await test.step('Send GET /postcode-lookup without an Authorization header, with country "NL" and postcode "1011AB" and no house_number.', async () => {
      ({ request, response } = await sendLookup(postcodeClient, { country: 'NL', postcode: '1011AB' }));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the body\'s house_number is a string holding a whole number from 1 to 250.', async () => {
      const houseNumber = parseResult(response).house_number;
      const isWholeNumberInRange = typeof houseNumber === 'string' && /^\d+$/.test(houseNumber) && Number(houseNumber) >= 1 && Number(houseNumber) <= 250;
      expect(isWholeNumberInRange, assertMessage({ request, expected: 'house_number is a string holding a whole number from 1 to 250', actual: houseNumber })).toBe(
        true
      );
    });
  });

  test('API-0645: Look up with an empty house number returns the same address as without one', async ({ postcodeClient }) => {
    let first: { request: LookupRequest; response: ApiResponse };
    let second: { request: LookupRequest; response: ApiResponse };

    await test.step('Send GET /postcode-lookup without an Authorization header, with country "NL" and postcode "1011AB" and no house_number.', async () => {
      first = await sendLookup(postcodeClient, { country: 'NL', postcode: '1011AB' }, { name: 'First Lookup' });
    });

    await test.step('Send GET /postcode-lookup again with the same country and postcode and an empty house_number (`house_number=`).', async () => {
      second = await sendLookup(postcodeClient, { country: 'NL', postcode: '1011AB', house_number: '' }, { name: 'Second Lookup' });
    });

    await test.step('Verify both responses have status 200.', async () => {
      expectBothOk([first, second]);
    });

    await test.step('Verify the second body equals the first body.', async () => {
      const firstBody = parseResult(first.response);
      const secondBody = parseResult(second.response);
      expect(secondBody, assertMessage({ request: second.request, expected: 'The second body equals the first body', actual: { first: firstBody, second: secondBody } })).toEqual(
        firstBody
      );
    });
  });

  test('API-0646: Look up with different house numbers returns the same locality', async ({ postcodeClient }) => {
    let first: { request: LookupRequest; response: ApiResponse };
    let second: { request: LookupRequest; response: ApiResponse };

    await test.step('Send GET /postcode-lookup without an Authorization header, with country "NL", postcode "1011AB" and house_number "5".', async () => {
      first = await sendLookup(postcodeClient, { ...NL_QUERY }, { name: 'First Lookup' });
    });

    await test.step('Send GET /postcode-lookup again with the same country and postcode and house_number "99".', async () => {
      second = await sendLookup(postcodeClient, { ...NL_QUERY, house_number: '99' }, { name: 'Second Lookup' });
    });

    await test.step('Verify both responses have status 200.', async () => {
      expectBothOk([first, second]);
    });

    await test.step('Verify the two bodies have the same street, city and state.', async () => {
      expectSameLocality(second.request, parseResult(first.response), parseResult(second.response), 'The same street, city and state for house numbers 5 and 99');
    });

    await test.step('Verify each body\'s house_number is the number that request sent.', async () => {
      expectField(first.request, parseResult(first.response), 'house_number', '5');
      expectField(second.request, parseResult(second.response), 'house_number', '99');
    });
  });

  test('API-0647: Look up with lower-case country and postcode returns them in upper case with the same locality', async ({ postcodeClient }) => {
    let first: { request: LookupRequest; response: ApiResponse };
    let second: { request: LookupRequest; response: ApiResponse };
    let secondBody: PostcodeLookupResult;

    await test.step('Send GET /postcode-lookup without an Authorization header, with country "NL", postcode "1011AB" and house_number "5".', async () => {
      first = await sendLookup(postcodeClient, { ...NL_QUERY }, { name: 'First Lookup' });
    });

    await test.step('Send GET /postcode-lookup again with country "nl", postcode "1011ab" and house_number "5".', async () => {
      second = await sendLookup(postcodeClient, { country: 'nl', postcode: '1011ab', house_number: '5' }, { name: 'Second Lookup' });
    });

    await test.step('Verify both responses have status 200.', async () => {
      expectBothOk([first, second]);
      secondBody = parseResult(second.response);
    });

    await test.step('Verify the second body\'s country is "NL".', async () => {
      expectField(second.request, secondBody, 'country', 'NL');
    });

    await test.step('Verify the second body\'s postcode is "1011AB".', async () => {
      expectField(second.request, secondBody, 'postcode', '1011AB');
    });

    await test.step('Verify the second body\'s street, city and state equal the first body\'s.', async () => {
      expectSameLocality(second.request, parseResult(first.response), secondBody, 'The same street, city and state for "NL"/"1011AB" and "nl"/"1011ab"');
    });
  });

  test('API-0648: Look up a Dutch postcode with a space returns 200 and echoes the space', async ({ postcodeClient }) => {
    let request: LookupRequest;
    let response: ApiResponse;
    let body: PostcodeLookupResult;

    await test.step(
      'Send GET /postcode-lookup without an Authorization header, with country "NL", postcode "1011 AB" (a space between the digits and the letters) and house_number "5".',
      async () => {
        ({ request, response } = await sendLookup(postcodeClient, { ...NL_QUERY, postcode: '1011 AB' }));
      }
    );

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
      body = parseResult(response);
    });

    await test.step('Verify the body\'s country is "NL".', async () => {
      expectField(request, body, 'country', 'NL');
    });

    await test.step('Verify the body\'s postcode is "1011 AB".', async () => {
      expectField(request, body, 'postcode', '1011 AB');
    });
  });

  test('API-0649: Look up a US postcode with the four-digit extension returns 200', async ({ postcodeClient }) => {
    let request: LookupRequest;
    let response: ApiResponse;
    let body: PostcodeLookupResult;

    await test.step('Send GET /postcode-lookup without an Authorization header, with country "US", postcode "90210-1234" and house_number "5".', async () => {
      ({ request, response } = await sendLookup(postcodeClient, { country: 'US', postcode: '90210-1234', house_number: '5' }));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
      body = parseResult(response);
    });

    await test.step('Verify the body\'s country is "US".', async () => {
      expectField(request, body, 'country', 'US');
    });

    await test.step('Verify the body\'s postcode is "90210-1234".', async () => {
      expectField(request, body, 'postcode', '90210-1234');
    });
  });

  test('API-0650: Look up a French postcode returns an empty state', async ({ postcodeClient }) => {
    let request: LookupRequest;
    let response: ApiResponse;
    let body: PostcodeLookupResult;

    await test.step('Send GET /postcode-lookup without an Authorization header, with country "FR", postcode "75001" and house_number "5".', async () => {
      ({ request, response } = await sendLookup(postcodeClient, { country: 'FR', postcode: '75001', house_number: '5' }));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
      body = parseResult(response);
    });

    await test.step('Verify the body\'s country is "FR".', async () => {
      expectField(request, body, 'country', 'FR');
    });

    await test.step('Verify the body\'s postcode is "75001".', async () => {
      expectField(request, body, 'postcode', '75001');
    });

    await test.step('Verify the body\'s state is an empty string.', async () => {
      expectField(request, body, 'state', '');
    });
  });

  test('API-0651: Look up with a country that has no known format skips the postcode format check', async ({ postcodeClient }) => {
    let request: LookupRequest;
    let response: ApiResponse;
    let body: PostcodeLookupResult;

    await test.step(
      'Send GET /postcode-lookup without an Authorization header, with country "ZZ" (not in the contract\'s country list), postcode "1011" and house_number "5".',
      async () => {
        ({ request, response } = await sendLookup(postcodeClient, { country: 'ZZ', postcode: '1011', house_number: '5' }));
      }
    );

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
      body = parseResult(response);
    });

    await test.step('Verify the body\'s country is "ZZ".', async () => {
      expectField(request, body, 'country', 'ZZ');
    });

    await test.step('Verify the body\'s postcode is "1011".', async () => {
      expectField(request, body, 'postcode', '1011');
    });

    await test.step('Verify the body\'s house_number is "5".', async () => {
      expectField(request, body, 'house_number', '5');
    });
  });

  test('API-0652: Look up with country, postcode and house number at their length limits returns 200', async ({ postcodeClient }) => {
    // 40 lower-case letters, so the upper-case check compares something that changed.
    const country = 'abcdefghij'.repeat(4);
    let request: LookupRequest;
    let response: ApiResponse;
    let body: PostcodeLookupResult;

    await test.step(
      'Send GET /postcode-lookup without an Authorization header, with country a string of 40 letters, postcode "90210-1234" (10 characters) and house_number "ABCDEFGHIJ" (10 characters).',
      async () => {
        ({ request, response } = await sendLookup(postcodeClient, { country, postcode: '90210-1234', house_number: 'ABCDEFGHIJ' }));
      }
    );

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
      body = parseResult(response);
    });

    await test.step('Verify the body\'s country is the sent country in upper case.', async () => {
      expectField(request, body, 'country', country.toUpperCase());
    });

    await test.step('Verify the body\'s postcode is "90210-1234".', async () => {
      expectField(request, body, 'postcode', '90210-1234');
    });

    await test.step('Verify the body\'s house_number is "ABCDEFGHIJ".', async () => {
      expectField(request, body, 'house_number', 'ABCDEFGHIJ');
    });
  });

  test('API-0653: Look up with Accept text/xml still returns JSON', async ({ postcodeClient }) => {
    let request: LookupRequest;
    let response: ApiResponse;
    let body: PostcodeLookupResult;

    await test.step(
      'Send GET /postcode-lookup without an Authorization header, with Accept: text/xml, country "NL", postcode "1011AB" and house_number "5".',
      async () => {
        ({ request, response } = await sendLookup(postcodeClient, { ...NL_QUERY }, { accept: 'text/xml' }));
      }
    );

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the Content-Type header starts with "application/json".', async () => {
      expectContentTypeStartsWith(request, response, 'application/json');
    });

    await test.step('Verify the body is JSON with the keys street, house_number, city, state, country and postcode.', async () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(response.body);
      } catch {
        parsed = undefined;
      }
      expect(
        typeof parsed === 'object' && parsed !== null,
        assertMessage({ request, expected: 'The body is a JSON object', actual: response.body.slice(0, 500) })
      ).toBe(true);
      body = parsed as PostcodeLookupResult;
      for (const key of RESULT_KEYS) {
        expect(key in body, assertMessage({ request, expected: `The body has the key "${key}"`, actual: body })).toBe(true);
      }
    });

    await test.step('Verify the body\'s country is "NL".', async () => {
      expectField(request, body, 'country', 'NL');
    });
  });

  test('API-0654: Look up with an invalid token returns 200', async ({ postcodeClientWithInvalidToken }) => {
    let request: LookupRequest;
    let response: ApiResponse;

    await test.step(
      'Send GET /postcode-lookup with an Authorization header holding an invalid token (a made-up string, not issued by the API), country "NL", postcode "1011AB" and house_number "5".',
      async () => {
        ({ request, response } = await sendLookup(postcodeClientWithInvalidToken, { ...NL_QUERY }, { invalidToken: true }));
      }
    );

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the body\'s country is "NL".', async () => {
      expectField(request, parseResult(response), 'country', 'NL');
    });
  });

  test('API-0655: Look up without country and postcode returns 422 for both', async ({ postcodeClient }) => {
    const expectedMessage = 'The country field is required. (and 1 more error)';
    let request: LookupRequest;
    let response: ApiResponse;
    let errorBody: FieldValidationError;

    await test.step('Send GET /postcode-lookup without an Authorization header, with Accept: application/json and no country, postcode or house_number.', async () => {
      ({ request, response } = await sendLookup(postcodeClient, {}, { accept: 'application/json' }));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step('Verify the body\'s errors has the keys country and postcode, each with at least one message.', async () => {
      errorBody = expectErrorKeys(request, response, ['country', 'postcode']);
    });

    await test.step('Verify the body\'s errors has no other keys.', async () => {
      expectNoOtherKeys(request, errorBody, ['country', 'postcode']);
    });

    await test.step('Verify the body\'s message is "The country field is required. (and 1 more error)".', async () => {
      expect(errorBody.message, assertMessage({ request, expected: `message is "${expectedMessage}"`, actual: errorBody.message })).toBe(expectedMessage);
    });
  });

  test('API-0656: Look up with empty country and postcode returns 422 for both', async ({ postcodeClient }) => {
    await checkValidationError(
      postcodeClient,
      'Send GET /postcode-lookup without an Authorization header, with Accept: application/json, an empty country (`country=`) and an empty postcode (`postcode=`).',
      { country: '', postcode: '' },
      'Verify the body\'s errors has the keys country and postcode, each with at least one message.',
      ['country', 'postcode']
    );
  });

  test('API-0657: Look up without a postcode returns 422 before the format check', async ({ postcodeClient }) => {
    await checkValidationError(
      postcodeClient,
      'Send GET /postcode-lookup without an Authorization header, with Accept: application/json, country "AT" and no postcode.',
      { country: 'AT' },
      'Verify the body\'s errors has the key postcode with at least one message.',
      ['postcode']
    );
  });

  test('API-0658: Look up with country sent as an array returns 422', async ({ postcodeClient }) => {
    await checkValidationError(
      postcodeClient,
      'Send GET /postcode-lookup without an Authorization header, with Accept: application/json, country sent as an array (`country[]=NL`) and postcode "1011AB".',
      { country: ['NL'], postcode: '1011AB' },
      'Verify the body\'s errors has the key country with at least one message.',
      ['country']
    );
  });

  test('API-0659: Look up with a 41-character country returns 422', async ({ postcodeClient }) => {
    await checkValidationError(
      postcodeClient,
      'Send GET /postcode-lookup without an Authorization header, with Accept: application/json, country a string of 41 letters and postcode "1011AB".',
      { country: 'a'.repeat(41), postcode: '1011AB' },
      'Verify the body\'s errors has the key country with at least one message.',
      ['country']
    );
  });

  test('API-0660: Look up with an 11-character postcode returns 422', async ({ postcodeClient }) => {
    await checkValidationError(
      postcodeClient,
      'Send GET /postcode-lookup without an Authorization header, with Accept: application/json, country "ZZ" and postcode a string of 11 digits.',
      { country: 'ZZ', postcode: '12345678901' },
      'Verify the body\'s errors has the key postcode with at least one message.',
      ['postcode']
    );
  });

  test('API-0661: Look up with an 11-character house number returns 422', async ({ postcodeClient }) => {
    await checkValidationError(
      postcodeClient,
      'Send GET /postcode-lookup without an Authorization header, with Accept: application/json, country "NL", postcode "1011AB" and house_number a string of 11 digits.',
      { country: 'NL', postcode: '1011AB', house_number: '12345678901' },
      'Verify the body\'s errors has the key house_number with at least one message.',
      ['house_number']
    );
  });

  test('API-0662: Look up an Austrian postcode in the Dutch format returns 422', async ({ postcodeClient }) => {
    await checkFormatError(
      postcodeClient,
      'Send GET /postcode-lookup without an Authorization header, with Accept: application/json, country "AT" and postcode "1011AB".',
      { country: 'AT', postcode: '1011AB' }
    );
  });

  test('API-0663: Look up a Dutch postcode with digits only returns 422', async ({ postcodeClient }) => {
    await checkFormatError(
      postcodeClient,
      'Send GET /postcode-lookup without an Authorization header, with Accept: application/json, country "NL" and postcode "1011".',
      { country: 'NL', postcode: '1011' }
    );
  });

  test('API-0664: Look up a postcode in the wrong format without Accept still returns a JSON 422', async ({ postcodeClient }) => {
    let request: LookupRequest;
    let response: ApiResponse;

    await test.step(
      'Send GET /postcode-lookup without an Authorization header, without following redirects and with the Accept header left out, with country "AT" and postcode "1011AB".',
      async () => {
        ({ request, response } = await sendLookup(postcodeClient, { country: 'AT', postcode: '1011AB' }, { accept: null, followRedirects: false }));
      }
    );

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step('Verify the Content-Type header starts with "application/json".', async () => {
      expectContentTypeStartsWith(request, response, 'application/json');
    });

    await test.step('Verify the body\'s message is "The postal code format is not valid for the selected country.".', async () => {
      const body = parseJson<PostcodeFormatError>(request, response);
      expect(body.message, assertMessage({ request, expected: `message is "${FORMAT_MESSAGE}"`, actual: body })).toBe(FORMAT_MESSAGE);
    });
  });

  test('API-0665: Look up without country and postcode and without Accept returns a 302 redirect', async ({ postcodeClient }) => {
    await checkRedirect(
      postcodeClient,
      'Send GET /postcode-lookup without an Authorization header, without a Referer header, without following redirects and with the Accept header left out, with no country, postcode or house_number.',
      null
    );
  });

  test('API-0666: Look up without country and postcode with Accept */* returns a 302 redirect', async ({ postcodeClient }) => {
    await checkRedirect(
      postcodeClient,
      'Send GET /postcode-lookup without an Authorization header, without a Referer header, without following redirects and with Accept: */*, with no country, postcode or house_number.',
      '*/*'
    );
  });

  test('API-0667: Look up a postcode with a leading space returns it trimmed', async ({ postcodeClient }) => {
    test.fail(true, 'Known issue BUG-045: Echoes a postcode with leading whitespace untrimmed and builds the address from the untrimmed value, although the format check trims it.');
    let request: LookupRequest;
    let response: ApiResponse;

    await test.step(
      'Send GET /postcode-lookup without an Authorization header, with country "NL", postcode " 1011AB" (a leading space, sent URL-encoded as `%201011AB`) and house_number "5".',
      async () => {
        ({ request, response } = await sendLookup(postcodeClient, { ...NL_QUERY, postcode: ' 1011AB' }));
      }
    );

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the body\'s postcode is "1011AB" (without the space).', async () => {
      expectField(request, parseResult(response), 'postcode', '1011AB');
    });
  });
});
