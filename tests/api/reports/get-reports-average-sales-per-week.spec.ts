import { test, sendReport, AUTH, parseRows, expectPeriodRows, expectNumberFields, expectZeroRows, type ReportRequest } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { AverageSalesPerWeekRow } from '@api/dto/report';
import { TestConstants } from '@data/TestConstants';
import { expectMessage, expectStatus } from '@utils/apiChecks';

// Scenarios: test-scenarios/api/reports/get-reports-average-sales-per-week.yml

const PATH = '/reports/average-sales-per-week';

test.describe('@reports-api - Reports API', () => {
  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0609: Average sales per week returns 200 with 52 weeks', async ({ reportsClientWithToken }) => {
      let request: ReportRequest;
      let response: ApiResponse;
      let rows: AverageSalesPerWeekRow[];

      await test.step("Send GET /reports/average-sales-per-week with the admin's token.", async () => {
        ({ request, response } = await sendReport(PATH, AUTH.admin, () => reportsClientWithToken.averageSalesPerWeek()));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step('Verify the body has exactly 52 items whose week values are 1 to 52, in that order.', async () => {
        rows = parseRows<AverageSalesPerWeekRow>(request, response);
        expectPeriodRows(request, rows, 'week', 52);
      });

      await test.step("Verify every item's average and amount are numbers.", async () => {
        expectNumberFields(request, rows, ['average', 'amount']);
      });
    });

    test('API-0610: Average sales per week for a year without invoices returns 52 zero rows', async ({ reportsClientWithToken }) => {
      const year = TestConstants.reports.yearWithoutInvoices;
      let request: ReportRequest;
      let response: ApiResponse;
      let rows: AverageSalesPerWeekRow[];

      await test.step("Send GET /reports/average-sales-per-week with year 1990 and the admin's token.", async () => {
        ({ request, response } = await sendReport(PATH, AUTH.admin, () => reportsClientWithToken.averageSalesPerWeek(year), { year }));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step('Verify the body has exactly 52 items whose week values are 1 to 52, in that order.', async () => {
        rows = parseRows<AverageSalesPerWeekRow>(request, response);
        expectPeriodRows(request, rows, 'week', 52);
      });

      await test.step("Verify every item's average is 0 and amount is 0.", async () => {
        expectZeroRows(request, rows);
      });
    });
  });

  test('API-0611: Average sales per week without a token returns 401', async ({ reportsClient }) => {
    let request: ReportRequest;
    let response: ApiResponse;

    await test.step("Send GET /reports/average-sales-per-week without an Authorization header.", async () => {
      ({ request, response } = await sendReport(PATH, AUTH.none, () => reportsClient.averageSalesPerWeek()));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test('API-0612: Average sales per week with a malformed token returns 401', async ({ reportsClientWithInvalidToken }) => {
    let request: ReportRequest;
    let response: ApiResponse;

    await test.step("Send GET /reports/average-sales-per-week with a malformed token.", async () => {
      ({ request, response } = await sendReport(PATH, AUTH.malformed, () => reportsClientWithInvalidToken.averageSalesPerWeek()));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test('API-0613: Average sales per week as a customer returns 403', async ({ reportsClientWithToken }) => {
    let request: ReportRequest;
    let response: ApiResponse;

    await test.step("Send GET /reports/average-sales-per-week with the default user's token.", async () => {
      ({ request, response } = await sendReport(PATH, AUTH.defaultUser, () => reportsClientWithToken.averageSalesPerWeek()));
    });

    await test.step('Verify the response status is 403.', async () => {
      expectStatus(request, response, 403);
    });

    await test.step('Verify the body\'s message is "Forbidden".', async () => {
      expectMessage(request, response, 'Forbidden');
    });
  });
});
