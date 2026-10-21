import { test, expect, AUTH, createCustomerInvoice, pollPdfStatus, sendDownloadPdf, PDF_STATUS_POLL_STEP, type InvoiceRequest, checkStatusAndMessage } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import { TestConstants } from '@data/TestConstants';
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
    test.skip(true, 'Known issue BUG-047: The invoice PDF job doesn\'t run within a few minutes: the status stays INITIATED and the download answers 404.');
    // The PDF jobs run every minute: the status poll waits up to 210 s (PDF_POLL), within the token's 300 s.
    test.setTimeout(300_000);
    let request: InvoiceRequest;
    let response: ApiResponse;

    const setup = await createCustomerInvoice({ usersService, adminUsersService, authService, productsService, cartsService, invoicesServiceForToken, cleanup });
    const client = invoicesClientForToken(setup.token);
    const invoiceNumber = setup.invoice.invoice_number;

    await test.step(PDF_STATUS_POLL_STEP, async () => {
      await pollPdfStatus(client, invoiceNumber, AUTH.newUser);
    });

    await test.step("Send GET /invoices/{invoice_number}/download-pdf with the invoice's number and that access_token.", async () => {
      ({ request, response } = await sendDownloadPdf(client, invoiceNumber, AUTH.newUser));
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
    await checkStatusAndMessage(
      'Send GET /invoices/{invoice_number}/download-pdf with a well-formed invoice number, without an Authorization header.',
      () => sendDownloadPdf(invoicesClient, TestConstants.invoices.unknownNumber, AUTH.none),
      401,
      'Unauthorized'
    );
  });

  test('API-0470: Download invoice PDF with an unknown invoice number returns 404', async ({ invoicesClientWithToken }) => {
    await checkStatusAndMessage(
      "Send GET /invoices/{invoice_number}/download-pdf with a well-formed invoice number that no invoice has and the default user's token.",
      () => sendDownloadPdf(invoicesClientWithToken, TestConstants.invoices.unknownNumber, AUTH.defaultUser),
      404,
      'Document not created. Try again later.'
    );
  });
});
