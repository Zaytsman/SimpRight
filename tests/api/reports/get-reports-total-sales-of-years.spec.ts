import { test, expect, AUTH, sendReport, parseRows, expectNumberFields, registerThrowawayCustomer, loginThrowawayCustomer, firstListedProductId, createCart, addItemSetup, createInvoiceSetup, setInvoiceStatusSetup, type ReportRequest, checkStatusAndMessage } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { InvoiceCreated } from '@api/dto/invoice';
import type { TotalSalesOfYearsRow } from '@api/dto/report';
import { expectEmptyArray, expectMessage, expectStatus } from '@utils/apiChecks';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/reports/get-reports-total-sales-of-years.yml

const PATH = '/reports/total-sales-of-years';

/** The current year in UTC, which the report's years are counted from. */
function currentYear(): number {
  return new Date().getUTCFullYear();
}

/** The checks of a "Verify the body has <n> items." step; returns the rows. */
function expectRowCount(request: ReportRequest, response: ApiResponse, count: number): TotalSalesOfYearsRow[] {
  const rows = parseRows<TotalSalesOfYearsRow>(request, response);
  expect(rows.length, assertMessage({ request, expected: `${count} items`, actual: rows })).toBe(count);
  return rows;
}

/** The checks of a "Verify the items' year values go up by one from <first> to the current year." step. */
function expectYears(request: ReportRequest, rows: TotalSalesOfYearsRow[], first: number): void {
  const years = rows.map((row) => row.year);
  const expected = Array.from({ length: currentYear() - first + 1 }, (_, index) => first + index);
  expect(years, assertMessage({ request, expected: `The years ${expected.join(', ')}, in that order`, actual: years })).toEqual(expected);
}

/** The X-RateLimit-* headers of a response, as numbers (NaN when missing). */
function rateLimit(response: ApiResponse): { limit: number; remaining: number } {
  return { limit: Number(response.headers['x-ratelimit-limit']), remaining: Number(response.headers['x-ratelimit-remaining']) };
}

test.describe('@reports-api - Reports API', () => {
  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0577: Total sales of years returns 200 with the current and the previous year', async ({ reportsClientWithToken }) => {
      let request: ReportRequest;
      let response: ApiResponse;
      let rows: TotalSalesOfYearsRow[];

      await test.step("Send GET /reports/total-sales-of-years with the admin's token.", async () => {
        ({ request, response } = await sendReport(PATH, AUTH.admin, () => reportsClientWithToken.totalSalesOfYears()));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step('Verify the body has 2 items.', async () => {
        rows = expectRowCount(request, response, 2);
      });

      await test.step("Verify the items' year values are the current year minus 1 and the current year, in that order.", async () => {
        expectYears(request, rows, currentYear() - 1);
      });

      await test.step('Verify every item has a year and a total, both numbers.', async () => {
        expectNumberFields(request, rows, ['year', 'total']);
      });
    });

    test('API-0578: Total sales of years with years 3 returns four years in ascending order', async ({ reportsClientWithToken }) => {
      const years = 3;
      let request: ReportRequest;
      let response: ApiResponse;
      let rows: TotalSalesOfYearsRow[];

      await test.step("Send GET /reports/total-sales-of-years with years 3 and the admin's token.", async () => {
        ({ request, response } = await sendReport(PATH, AUTH.admin, () => reportsClientWithToken.totalSalesOfYears(years), { years }));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step('Verify the body has 4 items.', async () => {
        rows = expectRowCount(request, response, 4);
      });

      await test.step("Verify the items' year values go up by one from the current year minus 3 to the current year.", async () => {
        expectYears(request, rows, currentYear() - 3);
      });

      await test.step('Verify every item has a year and a total, both numbers.', async () => {
        expectNumberFields(request, rows, ['year', 'total']);
      });
    });

    test('API-0579: Total sales of years with years 0 returns only the current year', async ({ reportsClientWithToken }) => {
      const years = 0;
      let request: ReportRequest;
      let response: ApiResponse;

      await test.step("Send GET /reports/total-sales-of-years with years 0 and the admin's token.", async () => {
        ({ request, response } = await sendReport(PATH, AUTH.admin, () => reportsClientWithToken.totalSalesOfYears(years), { years }));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step('Verify the body has exactly one item, whose year is the current year.', async () => {
        const rows = expectRowCount(request, response, 1);
        expect(rows[0]!.year, assertMessage({ request, expected: `The item's year is the current year ${currentYear()}`, actual: rows })).toBe(currentYear());
      });
    });

    test('API-0580: Total sales of years with a negative years returns an empty list', async ({ reportsClientWithToken }) => {
      const years = -1;
      let request: ReportRequest;
      let response: ApiResponse;

      await test.step("Send GET /reports/total-sales-of-years with years -1 and the admin's token.", async () => {
        ({ request, response } = await sendReport(PATH, AUTH.admin, () => reportsClientWithToken.totalSalesOfYears(years), { years }));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step('Verify the body is an empty array.', async () => {
        expectEmptyArray(request, response);
      });
    });

    test('API-0584: Total sales of years with a non-numeric years does not return 500', async ({ reportsClientWithToken }) => {
      test.fail(true, 'Known issue BUG-044: Returns 500 for a non-numeric years instead of 422 or ignoring the value.');
      const years = 'abc';
      let request: ReportRequest;
      let response: ApiResponse;

      await test.step('Send GET /reports/total-sales-of-years with years "abc" and the admin\'s token.', async () => {
        ({ request, response } = await sendReport(PATH, AUTH.admin, () => reportsClientWithToken.totalSalesOfYears(years), { years }));
      });

      await test.step('Verify the response status is 200 or 422.', async () => {
        expect(
          [200, 422].includes(response.status),
          assertMessage({ request, expected: 'Status 200 or 422', actual: { status: response.status, body: response.body.slice(0, 500) } })
        ).toBe(true);
      });
    });

    test('API-0585: Total sales of years counts a completed invoice', async ({
      usersService,
      adminUsersService,
      authService,
      productsService,
      cartsService,
      invoicesServiceForToken,
      reportsClientWithToken,
      cleanup,
    }) => {
      // Values no other test uses, so each report is computed fresh, not read from its 5-minute cache.
      const startYears = 20 + Math.floor(Math.random() * 80);
      const years = 20 + ((startYears - 20 + 1 + Math.floor(Math.random() * 79)) % 80);
      let startTotal = 0;
      let productId = '';
      let invoice: InvoiceCreated;
      let request: ReportRequest;
      let response: ApiResponse;
      let rows: TotalSalesOfYearsRow[];

      // The customer gets an invoice (no endpoint deletes invoices), so its admin delete answers 409: deleteUnlessInUse
      // expects that, and the hourly re-seed removes the customer and its invoice.
      const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup, { mayHoldInvoices: true });
      const token = await loginThrowawayCustomer(authService, customer);

      await test.step("Send GET /products and take the first item's id as the product's id.", async () => {
        productId = await firstListedProductId(productsService);
      });

      const cartId = await createCart(cartsService, cleanup);

      await addItemSetup(cartsService, cartId, productId, 2, "Send POST /carts/{cartId} with the cart's id, the product's id as product_id and quantity 2.");

      await test.step(
        "Send GET /reports/total-sales-of-years with a years value picked at random between 20 and 99 and the admin's token, and take the last item's total as the starting total.",
        async () => {
          const start = await sendReport(PATH, AUTH.admin, () => reportsClientWithToken.totalSalesOfYears(startYears), { years: startYears });
          expectStatus(start.request, start.response, 200);
          startTotal = parseRows<TotalSalesOfYearsRow>(start.request, start.response).at(-1)!.total;
        }
      );

      invoice = await createInvoiceSetup(
        invoicesServiceForToken(token),
        cartId,
        'Send POST /invoices with that access_token, payment_method "cash-on-delivery", payment_details {}, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT" and the cart\'s id as cart_id, and take the new invoice\'s id and total.',
        AUTH.newUser
      );

      await setInvoiceStatusSetup(
        invoicesServiceForToken(token),
        invoice.id,
        'COMPLETED',
        'Send PUT /invoices/{invoiceId}/status with the invoice\'s id, that access_token and a body with status "COMPLETED".',
        AUTH.newUser
      );

      await test.step(
        "Send GET /reports/total-sales-of-years with another years value between 20 and 99, different from the first (so the report is computed fresh, not read from the cache), and the admin's token.",
        async () => {
          ({ request, response } = await sendReport(PATH, AUTH.admin, () => reportsClientWithToken.totalSalesOfYears(years), { years }));
        }
      );

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step("Verify the body has years + 1 items and its last item's year is the current year.", async () => {
        rows = expectRowCount(request, response, years + 1);
        expect(rows.at(-1)!.year, assertMessage({ request, expected: `The last item's year is the current year ${currentYear()}`, actual: rows.at(-1) })).toBe(
          currentYear()
        );
      });

      await test.step("Verify the last item's total is at least the starting total plus the invoice's total.", async () => {
        const last = rows.at(-1)!;
        // Other visitors' completed invoices can only add to the total; the cent of slack absorbs decimal rounding.
        const minimum = startTotal + invoice.total;
        expect(
          last.total >= minimum - 0.01,
          assertMessage({ request, expected: `The last item's total is at least ${minimum} (starting total ${startTotal} + invoice total ${invoice.total})`, actual: last })
        ).toBe(true);
      });
    });
  });

  test('API-0581: Total sales of years without a token returns 401', async ({ reportsClient }) => {
    await checkStatusAndMessage(
      'Send GET /reports/total-sales-of-years without an Authorization header.',
      () => sendReport(PATH, AUTH.none, () => reportsClient.totalSalesOfYears()),
      401,
      'Unauthorized'
    );
  });

  test('API-0582: Total sales of years with a malformed token returns 401', async ({ reportsClientWithInvalidToken }) => {
    await checkStatusAndMessage(
      'Send GET /reports/total-sales-of-years with a malformed token.',
      () => sendReport(PATH, AUTH.malformed, () => reportsClientWithInvalidToken.totalSalesOfYears()),
      401,
      'Unauthorized'
    );
  });

  test('API-0583: Total sales of years as a customer returns 403', async ({ reportsClientWithToken }) => {
    await checkStatusAndMessage(
      "Send GET /reports/total-sales-of-years with the default user's token.",
      () => sendReport(PATH, AUTH.defaultUser, () => reportsClientWithToken.totalSalesOfYears()),
      403,
      'Forbidden'
    );
  });

  test('API-0586: Report requests share one rate limit counter', async ({ reportsClient }) => {
    let first: { request: ReportRequest; response: ApiResponse };
    let second: { request: ReportRequest; response: ApiResponse };

    await test.step('Send GET /reports/total-sales-of-years without an Authorization header, and note the X-RateLimit-Remaining header.', async () => {
      first = await sendReport(PATH, AUTH.none, () => reportsClient.totalSalesOfYears());
    });

    await test.step('Send GET /reports/top10-purchased-products without an Authorization header, and note its X-RateLimit-Remaining header.', async () => {
      second = await sendReport('/reports/top10-purchased-products', AUTH.none, () => reportsClient.top10PurchasedProducts());
    });

    await test.step('Verify both responses have status 401.', async () => {
      expectStatus(first.request, first.response, 401);
      expectStatus(second.request, second.response, 401);
    });

    await test.step('Verify both responses have X-RateLimit-Limit 60.', async () => {
      for (const { request, response } of [first, second]) {
        expect(rateLimit(response).limit, assertMessage({ request, expected: 'X-RateLimit-Limit 60', actual: response.headers })).toBe(60);
      }
    });

    await test.step("Verify the second response's X-RateLimit-Remaining is lower than the first's.", async () => {
      const remaining = { first: rateLimit(first.response).remaining, second: rateLimit(second.response).remaining };
      expect(
        remaining.second < remaining.first,
        assertMessage({ request: [first.request, second.request], expected: "The second X-RateLimit-Remaining is lower than the first's", actual: remaining })
      ).toBe(true);
    });
  });

  test('API-0587: Report requests over 60 per minute for one user return 429', async ({
    usersService,
    adminUsersService,
    authService,
    reportsClientForToken,
    cleanup,
  }) => {
    // 61 calls in a row plus a registration and a login can take longer than the default test timeout.
    test.slow();
    const calls = 61;
    const request = { method: 'GET', path: PATH, auth: AUTH.newUser, times: calls };
    let last: ApiResponse;

    const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup);
    const token = await loginThrowawayCustomer(authService, customer);

    await test.step('Send GET /reports/total-sales-of-years 61 times in a row, within one minute, with that access_token.', async () => {
      const client = reportsClientForToken(token);
      const summary: { call: number; status: number; remaining?: string }[] = [];
      const start = Date.now();
      for (let call = 1; call <= calls; call++) {
        last = await client.totalSalesOfYears();
        summary.push({ call, status: last.status, remaining: last.headers['x-ratelimit-remaining'] });
      }
      const elapsedMs = Date.now() - start;
      await attachJson('Report Calls', { request, elapsedMs, calls: summary });
      await attachJson('Last Report Response', { status: last.status, headers: last.headers, body: last.body });
      expect(elapsedMs < 60_000, assertMessage({ request, expected: 'The 61 calls were sent within one minute', actual: { elapsedMs } })).toBe(true);
    });

    await test.step('Verify the 61st response status is 429.', async () => {
      expectStatus(request, last, 429);
    });

    await test.step('Verify the 61st response body\'s message is "Too many requests".', async () => {
      expectMessage(request, last, 'Too many requests');
    });
  });
});
