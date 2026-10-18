import { test, expect, AUTH, createCustomerInvoice, pollPdfStatus, sendPdfStatus, PDF_STATUS_POLL_STEP, type InvoiceRequest, checkStatusAndMessage } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { PdfStatusResponse } from '@api/dto/invoice';
import { TestConstants } from '@data/TestConstants';
import { expectStatus, parseJson } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/invoices/get-invoices-by-invoice-number-download-pdf-status.yml

/** The checks of a "Verify the body's status is "<status>"." step. */
function expectPdfStatus(request: InvoiceRequest, response: ApiResponse, status: string): void {
  const body = parseJson<Partial<PdfStatusResponse>>(request, response);
  expect(body.status, assertMessage({ request, expected: `status is "${status}"`, actual: body })).toBe(status);
}

test.describe('@invoices-api - Invoices API', () => {
  test('API-0471: Get PDF status returns 200 with COMPLETED once the PDF is generated', async ({
    usersService,
    adminUsersService,
    authService,
    productsService,
    cartsService,
    invoicesServiceForToken,
    invoicesClientForToken,
    cleanup,
  }) => {
    // The PDF jobs run every minute: the poll waits up to 210 s (PDF_POLL), within the token's 300 s.
    test.setTimeout(300_000);
    let request: InvoiceRequest;
    let response: ApiResponse;

    const setup = await createCustomerInvoice({ usersService, adminUsersService, authService, productsService, cartsService, invoicesServiceForToken, cleanup });

    await test.step(PDF_STATUS_POLL_STEP, async () => {
      ({ request, response } = await pollPdfStatus(invoicesClientForToken(setup.token), setup.invoice.invoice_number, AUTH.newUser));
    });

    await test.step("Verify the last response's status is 200.", async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the body\'s status is "COMPLETED".', async () => {
      expectPdfStatus(request, response, 'COMPLETED');
    });
  });

  test('API-0472: Get PDF status without a token returns 401', async ({ invoicesClient }) => {
    await checkStatusAndMessage(
      'Send GET /invoices/{invoice_number}/download-pdf-status with a well-formed invoice number, without an Authorization header.',
      () => sendPdfStatus(invoicesClient, TestConstants.invoices.unknownNumber, AUTH.none),
      401,
      'Unauthorized'
    );
  });

  test('API-0473: Get PDF status with an unknown invoice number returns 400 with NOT_INITIATED', async ({ invoicesClientWithToken }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;

    await test.step("Send GET /invoices/{invoice_number}/download-pdf-status with a well-formed invoice number that no invoice has and the default user's token.", async () => {
      ({ request, response } = await sendPdfStatus(invoicesClientWithToken, TestConstants.invoices.unknownNumber, AUTH.defaultUser));
    });

    await test.step('Verify the response status is 400.', async () => {
      expectStatus(request, response, 400);
    });

    await test.step('Verify the body\'s status is "NOT_INITIATED".', async () => {
      expectPdfStatus(request, response, 'NOT_INITIATED');
    });
  });
});
