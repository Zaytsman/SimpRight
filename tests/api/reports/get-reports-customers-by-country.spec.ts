import { test, expect, AUTH, sendReport, parseRows, expectNoDuplicates, type ReportRequest, checkReportRejected } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { CustomersByCountryRow } from '@api/dto/report';
import { expectStatus } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/reports/get-reports-customers-by-country.yml

const PATH = '/reports/customers-by-country';

test.describe('@reports-api - Reports API', () => {
  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0600: Customers by country returns 200 with a customer count per country', async ({ reportsClientWithToken }) => {
      let request: ReportRequest;
      let response: ApiResponse;
      let rows: CustomersByCountryRow[];

      await test.step("Send GET /reports/customers-by-country with the admin's token.", async () => {
        ({ request, response } = await sendReport(PATH, AUTH.admin, () => reportsClientWithToken.customersByCountry()));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step('Verify the body is an array with at least one item.', async () => {
        rows = parseRows<CustomersByCountryRow>(request, response);
        expect(rows.length, assertMessage({ request, expected: 'At least one item', actual: rows.length })).toBeGreaterThan(0);
      });

      await test.step('Verify every item has an amount (a number) and a country (a string, or null for customers registered without one).', async () => {
        for (const row of rows) {
          expect(
            typeof row.amount === 'number' && (typeof row.country === 'string' || row.country === null),
            assertMessage({ request, expected: 'The item has an amount (a number) and a country (a string, or null)', actual: row })
          ).toBe(true);
        }
      });

      await test.step('Verify no country appears twice.', async () => {
        expectNoDuplicates(request, rows, 'country');
      });
    });
  });

  test('API-0601: Customers by country without a token returns 401', async ({ reportsClient }) => {
    await checkReportRejected(
      "Send GET /reports/customers-by-country without an Authorization header.",
      () => sendReport(PATH, AUTH.none, () => reportsClient.customersByCountry()),
      401
    );
  });

  test('API-0602: Customers by country with a malformed token returns 401', async ({ reportsClientWithInvalidToken }) => {
    await checkReportRejected(
      "Send GET /reports/customers-by-country with a malformed token.",
      () => sendReport(PATH, AUTH.malformed, () => reportsClientWithInvalidToken.customersByCountry()),
      401
    );
  });

  test('API-0603: Customers by country as a customer returns 403', async ({ reportsClientWithToken }) => {
    await checkReportRejected(
      "Send GET /reports/customers-by-country with the default user's token.",
      () => sendReport(PATH, AUTH.defaultUser, () => reportsClientWithToken.customersByCountry()),
      403
    );
  });
});
