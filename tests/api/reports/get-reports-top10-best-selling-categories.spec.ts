import { test, expect, AUTH, sendReport, parseRows, isNumeric, expectRowCountBetween, expectNonIncreasing, type ReportRequest } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { TopSellingCategoryRow } from '@api/dto/report';
import { expectMessage, expectStatus } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/reports/get-reports-top10-best-selling-categories.yml

const PATH = '/reports/top10-best-selling-categories';

test.describe('@reports-api - Reports API', () => {
  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0596: Top 10 best selling categories returns 200 with at most ten categories, highest total first', async ({ reportsClientWithToken }) => {
      let request: ReportRequest;
      let response: ApiResponse;
      let rows: TopSellingCategoryRow[];

      await test.step("Send GET /reports/top10-best-selling-categories with the admin's token.", async () => {
        ({ request, response } = await sendReport(PATH, AUTH.admin, () => reportsClientWithToken.top10BestSellingCategories()));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step('Verify the body is an array with at least one and at most 10 items.', async () => {
        rows = parseRows<TopSellingCategoryRow>(request, response);
        expectRowCountBetween(request, rows, 1, 10);
      });

      await test.step('Verify every item has category_name (a string) and total_earned (a number or a numeric string).', async () => {
        for (const row of rows) {
          expect(
            typeof row.category_name === 'string' && isNumeric(row.total_earned),
            assertMessage({ request, expected: 'The item has category_name (a string) and total_earned (a number or a numeric string)', actual: row })
          ).toBe(true);
        }
      });

      await test.step("Verify each item's total_earned, compared as a number, is not greater than the previous item's.", async () => {
        expectNonIncreasing(request, rows, 'total_earned');
      });
    });
  });

  test('API-0597: Top 10 best selling categories without a token returns 401', async ({ reportsClient }) => {
    let request: ReportRequest;
    let response: ApiResponse;

    await test.step("Send GET /reports/top10-best-selling-categories without an Authorization header.", async () => {
      ({ request, response } = await sendReport(PATH, AUTH.none, () => reportsClient.top10BestSellingCategories()));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test('API-0598: Top 10 best selling categories with a malformed token returns 401', async ({ reportsClientWithInvalidToken }) => {
    let request: ReportRequest;
    let response: ApiResponse;

    await test.step("Send GET /reports/top10-best-selling-categories with a malformed token.", async () => {
      ({ request, response } = await sendReport(PATH, AUTH.malformed, () => reportsClientWithInvalidToken.top10BestSellingCategories()));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test('API-0599: Top 10 best selling categories as a customer returns 403', async ({ reportsClientWithToken }) => {
    let request: ReportRequest;
    let response: ApiResponse;

    await test.step("Send GET /reports/top10-best-selling-categories with the default user's token.", async () => {
      ({ request, response } = await sendReport(PATH, AUTH.defaultUser, () => reportsClientWithToken.top10BestSellingCategories()));
    });

    await test.step('Verify the response status is 403.', async () => {
      expectStatus(request, response, 403);
    });

    await test.step('Verify the body\'s message is "Forbidden".', async () => {
      expectMessage(request, response, 'Forbidden');
    });
  });
});
