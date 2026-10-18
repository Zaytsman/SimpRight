import { test, expect, AUTH, sendReport, parseRows, isNumeric, expectNoDuplicates, type ReportRequest, checkReportRejected } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { TotalSalesPerCountryRow } from '@api/dto/report';
import { expectStatus } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/reports/get-reports-total-sales-per-country.yml

const PATH = '/reports/total-sales-per-country';

test.describe('@reports-api - Reports API', () => {
  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0588: Total sales per country returns 200 with a list of countries and totals', async ({ reportsClientWithToken }) => {
      let request: ReportRequest;
      let response: ApiResponse;
      let rows: TotalSalesPerCountryRow[];

      await test.step("Send GET /reports/total-sales-per-country with the admin's token.", async () => {
        ({ request, response } = await sendReport(PATH, AUTH.admin, () => reportsClientWithToken.totalSalesPerCountry()));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step('Verify the body is an array (it is empty until the first invoice is COMPLETED after a re-seed).', async () => {
        rows = parseRows<TotalSalesPerCountryRow>(request, response);
      });

      await test.step('Verify every item has billing_country (a string) and total_sales (a number or a numeric string).', async () => {
        for (const row of rows) {
          expect(
            typeof row.billing_country === 'string' && isNumeric(row.total_sales),
            assertMessage({ request, expected: 'The item has billing_country (a string) and total_sales (a number or a numeric string)', actual: row })
          ).toBe(true);
        }
      });

      await test.step('Verify no billing_country appears twice.', async () => {
        expectNoDuplicates(request, rows, 'billing_country');
      });
    });
  });

  test('API-0589: Total sales per country without a token returns 401', async ({ reportsClient }) => {
    await checkReportRejected(
      "Send GET /reports/total-sales-per-country without an Authorization header.",
      () => sendReport(PATH, AUTH.none, () => reportsClient.totalSalesPerCountry()),
      401
    );
  });

  test('API-0590: Total sales per country with a malformed token returns 401', async ({ reportsClientWithInvalidToken }) => {
    await checkReportRejected(
      "Send GET /reports/total-sales-per-country with a malformed token.",
      () => sendReport(PATH, AUTH.malformed, () => reportsClientWithInvalidToken.totalSalesPerCountry()),
      401
    );
  });

  test('API-0591: Total sales per country as a customer returns 403', async ({ reportsClientWithToken }) => {
    await checkReportRejected(
      "Send GET /reports/total-sales-per-country with the default user's token.",
      () => sendReport(PATH, AUTH.defaultUser, () => reportsClientWithToken.totalSalesPerCountry()),
      403
    );
  });
});
