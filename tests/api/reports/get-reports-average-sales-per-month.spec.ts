import {
  test,
  REPORT_AUTH,
  sendReport,
  parseRows,
  expectPeriodRows,
  expectNumberFields,
  expectZeroRows,
  type ReportRequest,
} from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { AverageSalesPerMonthRow } from '@api/dto/report';
import { TestConstants } from '@data/TestConstants';
import { expectMessage, expectStatus } from '@utils/apiChecks';

// Scenarios: test-scenarios/api/reports/get-reports-average-sales-per-month.yml

const PATH = '/reports/average-sales-per-month';

test.describe('@reports-api - Reports API', () => {
  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0604: Average sales per month returns 200 with twelve months', async ({ reportsClientWithToken }) => {
      let request: ReportRequest;
      let response: ApiResponse;
      let rows: AverageSalesPerMonthRow[];

      await test.step("Send GET /reports/average-sales-per-month with the admin's token.", async () => {
        ({ request, response } = await sendReport(PATH, REPORT_AUTH.admin, () => reportsClientWithToken.averageSalesPerMonth()));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step('Verify the body has exactly 12 items whose month values are 1 to 12, in that order.', async () => {
        rows = parseRows<AverageSalesPerMonthRow>(request, response);
        expectPeriodRows(request, rows, 'month', 12);
      });

      await test.step("Verify every item's average and amount are numbers.", async () => {
        expectNumberFields(request, rows, ['average', 'amount']);
      });
    });

    test('API-0605: Average sales per month for a year without invoices returns twelve zero rows', async ({ reportsClientWithToken }) => {
      const year = TestConstants.reports.yearWithoutInvoices;
      let request: ReportRequest;
      let response: ApiResponse;
      let rows: AverageSalesPerMonthRow[];

      await test.step("Send GET /reports/average-sales-per-month with year 1990 and the admin's token.", async () => {
        ({ request, response } = await sendReport(PATH, REPORT_AUTH.admin, () => reportsClientWithToken.averageSalesPerMonth(year), { year }));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step('Verify the body has exactly 12 items whose month values are 1 to 12, in that order.', async () => {
        rows = parseRows<AverageSalesPerMonthRow>(request, response);
        expectPeriodRows(request, rows, 'month', 12);
      });

      await test.step("Verify every item's average is 0 and amount is 0.", async () => {
        expectZeroRows(request, rows);
      });
    });
  });

  test('API-0606: Average sales per month without a token returns 401', async ({ reportsClient }) => {
    let request: ReportRequest;
    let response: ApiResponse;

    await test.step("Send GET /reports/average-sales-per-month without an Authorization header.", async () => {
      ({ request, response } = await sendReport(PATH, REPORT_AUTH.none, () => reportsClient.averageSalesPerMonth()));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test('API-0607: Average sales per month with a malformed token returns 401', async ({ reportsClientWithInvalidToken }) => {
    let request: ReportRequest;
    let response: ApiResponse;

    await test.step("Send GET /reports/average-sales-per-month with a malformed token.", async () => {
      ({ request, response } = await sendReport(PATH, REPORT_AUTH.malformed, () => reportsClientWithInvalidToken.averageSalesPerMonth()));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test('API-0608: Average sales per month as a customer returns 403', async ({ reportsClientWithToken }) => {
    let request: ReportRequest;
    let response: ApiResponse;

    await test.step("Send GET /reports/average-sales-per-month with the default user's token.", async () => {
      ({ request, response } = await sendReport(PATH, REPORT_AUTH.customer, () => reportsClientWithToken.averageSalesPerMonth()));
    });

    await test.step('Verify the response status is 403.', async () => {
      expectStatus(request, response, 403);
    });

    await test.step('Verify the body\'s message is "Forbidden".', async () => {
      expectMessage(request, response, 'Forbidden');
    });
  });
});
