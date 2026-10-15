import {
  test,
  expect,
  createCustomerInvoice,
  pollPdfStatus,
  sendDownloadPdf,
  INVOICE_AUTH,
  PDF_STATUS_POLL_STEP,
  type InvoiceRequest,
} from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import { TestConstants } from '@data/TestConstants';
import { expectMessage, expectStatus } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/invoices/get-invoices-by-invoice-number-download-pdf.yml

test.describe('@invoices-api - Invoices API', () => {
  test('API-0468: Download invoice PDF returns 200 with the file once it is generated', async ({
    usersService,
    adminUsersService,
    authService,
    productsService,
    cartsService,
    invoicesServiceForToken,
    invoicesClientForToken,
    cleanup,
  }) => {
    // Skipped, not test.fail: while BUG-047 is open the poll always runs its full 210 s, which holds a worker for every run.
    test.skip(true, 'Known issue BUG-047: The invoice\'s PDF is never generated, so the download returns 404 "Document not created. Try again later.".');
    // The PDF jobs run every minute: the status poll waits up to 210 s (PDF_POLL), within the token's 300 s.
    test.setTimeout(300_000);
    let request: InvoiceRequest;
    let response: ApiResponse;

    const setup = await createCustomerInvoice({ usersService, adminUsersService, authService, productsService, cartsService, invoicesServiceForToken, cleanup });
    const client = invoicesClientForToken(setup.token);
    const invoiceNumber = setup.invoice.invoice_number;

    await test.step(PDF_STATUS_POLL_STEP, async () => {
      await pollPdfStatus(client, invoiceNumber, INVOICE_AUTH.throwaway);
    });

    await test.step("Send GET /invoices/{invoice_number}/download-pdf with the invoice's number and that access_token.", async () => {
      ({ request, response } = await sendDownloadPdf(client, invoiceNumber, INVOICE_AUTH.throwaway));
    });

    await test.step('Verify the response status is 200.', async () => {
      expect(
        response.status,
        assertMessage({ request, expected: 'Status 200', actual: { status: response.status, contentType: response.headers['content-type'], bodyLength: response.body.length } })
      ).toBe(200);
    });

    await test.step('Verify the Content-Disposition response header is "attachment; filename=<invoice_number>.pdf" with the invoice\'s number.', async () => {
      const expected = `attachment; filename=${invoiceNumber}.pdf`;
      expect(response.headers['content-disposition'], assertMessage({ request, expected: `Content-Disposition is "${expected}"`, actual: response.headers })).toBe(expected);
    });

    await test.step('Verify the response body is not empty.', async () => {
      expect(response.body.length > 0, assertMessage({ request, expected: 'The body is not empty', actual: { bodyLength: response.body.length } })).toBe(true);
    });
  });

  test('API-0469: Download invoice PDF without a token returns 401', async ({ invoicesClient }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;

    await test.step('Send GET /invoices/{invoice_number}/download-pdf with a well-formed invoice number, without an Authorization header.', async () => {
      ({ request, response } = await sendDownloadPdf(invoicesClient, TestConstants.invoices.unknownNumber, INVOICE_AUTH.none));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test('API-0470: Download invoice PDF with an unknown invoice number returns 404', async ({ invoicesClientWithToken }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;

    await test.step("Send GET /invoices/{invoice_number}/download-pdf with a well-formed invoice number that no invoice has and the default user's token.", async () => {
      ({ request, response } = await sendDownloadPdf(invoicesClientWithToken, TestConstants.invoices.unknownNumber, INVOICE_AUTH.defaultUser));
    });

    await test.step('Verify the response status is 404.', async () => {
      expectStatus(request, response, 404);
    });

    await test.step('Verify the body\'s message is "Document not created. Try again later.".', async () => {
      expectMessage(request, response, 'Document not created. Try again later.');
    });
  });
});
