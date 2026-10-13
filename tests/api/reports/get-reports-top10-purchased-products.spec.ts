import {
  test,
  expect,
  REPORT_AUTH,
  sendReport,
  parseRows,
  expectRowCountBetween,
  expectNoDuplicates,
  expectNonIncreasing,
  type ReportRequest,
} from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { TopPurchasedProductRow } from '@api/dto/report';
import { expectMessage, expectStatus } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/reports/get-reports-top10-purchased-products.yml

const PATH = '/reports/top10-purchased-products';

test.describe('@reports-api - Reports API', () => {
  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0592: Top 10 purchased products returns 200 with at most ten products, highest count first', async ({ reportsClientWithToken }) => {
      let request: ReportRequest;
      let response: ApiResponse;
      let rows: TopPurchasedProductRow[];

      await test.step("Send GET /reports/top10-purchased-products with the admin's token.", async () => {
        ({ request, response } = await sendReport(PATH, REPORT_AUTH.admin, () => reportsClientWithToken.top10PurchasedProducts()));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step('Verify the body is an array with at least one and at most 10 items.', async () => {
        rows = parseRows<TopPurchasedProductRow>(request, response);
        expectRowCountBetween(request, rows, 1, 10);
      });

      await test.step('Verify every item has a name (a string) and a count (a number).', async () => {
        for (const row of rows) {
          expect(
            typeof row.name === 'string' && typeof row.count === 'number',
            assertMessage({ request, expected: 'The item has a name (a string) and a count (a number)', actual: row })
          ).toBe(true);
        }
      });

      await test.step('Verify no name appears twice.', async () => {
        expectNoDuplicates(request, rows, 'name');
      });

      await test.step("Verify each item's count is not greater than the previous item's count.", async () => {
        expectNonIncreasing(request, rows, 'count');
      });
    });
  });

  test('API-0593: Top 10 purchased products without a token returns 401', async ({ reportsClient }) => {
    let request: ReportRequest;
    let response: ApiResponse;

    await test.step('Send GET /reports/top10-purchased-products without an Authorization header.', async () => {
      ({ request, response } = await sendReport(PATH, REPORT_AUTH.none, () => reportsClient.top10PurchasedProducts()));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test('API-0594: Top 10 purchased products with a malformed token returns 401', async ({ reportsClientWithInvalidToken }) => {
    let request: ReportRequest;
    let response: ApiResponse;

    await test.step('Send GET /reports/top10-purchased-products with a malformed token.', async () => {
      ({ request, response } = await sendReport(PATH, REPORT_AUTH.malformed, () => reportsClientWithInvalidToken.top10PurchasedProducts()));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test('API-0595: Top 10 purchased products as a customer returns 403', async ({ reportsClientWithToken }) => {
    let request: ReportRequest;
    let response: ApiResponse;

    await test.step("Send GET /reports/top10-purchased-products with the default user's token.", async () => {
      ({ request, response } = await sendReport(PATH, REPORT_AUTH.customer, () => reportsClientWithToken.top10PurchasedProducts()));
    });

    await test.step('Verify the response status is 403.', async () => {
      expectStatus(request, response, 403);
    });

    await test.step('Verify the body\'s message is "Forbidden".', async () => {
      expectMessage(request, response, 'Forbidden');
    });
  });
});
