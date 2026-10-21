# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api/invoices/get-invoices-by-invoice-number-download-pdf.spec.ts >> @invoices-api - Invoices API >> API-0468: Download invoice PDF returns 200 with the file once it is generated
- Location: tests/api/invoices/get-invoices-by-invoice-number-download-pdf.spec.ts:9:7

# Error details

```
Error: [Request] {"method":"GET","path":"/invoices/INV-2026000023/download-pdf","auth":"the new user's access_token"}
[Expected] Status 200
[Actual] {
  "status": 404,
  "contentType": "application/json",
  "bodyLength": 52
}

expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 404
```

# Test source

```ts
  1  | import { test, expect, AUTH, createCustomerInvoice, pollPdfStatus, sendDownloadPdf, PDF_STATUS_POLL_STEP, type InvoiceRequest, checkStatusAndMessage } from '@fixtures';
  2  | import type { ApiResponse } from '@api/clients/BaseClient';
  3  | import { TestConstants } from '@data/TestConstants';
  4  | import { assertMessage } from '@utils/assertHelpers';
  5  | 
  6  | // Scenarios: test-scenarios/api/invoices/get-invoices-by-invoice-number-download-pdf.yml
  7  | 
  8  | test.describe('@invoices-api - Invoices API', () => {
  9  |   test('API-0468: Download invoice PDF returns 200 with the file once it is generated', async ({
  10 |     usersService,
  11 |     adminUsersService,
  12 |     authService,
  13 |     productsService,
  14 |     cartsService,
  15 |     invoicesServiceForToken,
  16 |     invoicesClientForToken,
  17 |     cleanup,
  18 |   }) => {
  19 |     // The PDF jobs run every minute: the status poll waits up to 210 s (PDF_POLL), within the token's 300 s.
  20 |     test.setTimeout(300_000);
  21 |     let request: InvoiceRequest;
  22 |     let response: ApiResponse;
  23 | 
  24 |     const setup = await createCustomerInvoice({ usersService, adminUsersService, authService, productsService, cartsService, invoicesServiceForToken, cleanup });
  25 |     const client = invoicesClientForToken(setup.token);
  26 |     const invoiceNumber = setup.invoice.invoice_number;
  27 | 
  28 |     await test.step(PDF_STATUS_POLL_STEP, async () => {
  29 |       await pollPdfStatus(client, invoiceNumber, AUTH.newUser);
  30 |     });
  31 | 
  32 |     await test.step("Send GET /invoices/{invoice_number}/download-pdf with the invoice's number and that access_token.", async () => {
  33 |       ({ request, response } = await sendDownloadPdf(client, invoiceNumber, AUTH.newUser));
  34 |     });
  35 | 
  36 |     await test.step('Verify the response status is 200.', async () => {
  37 |       expect(
  38 |         response.status,
  39 |         assertMessage({ request, expected: 'Status 200', actual: { status: response.status, contentType: response.headers['content-type'], bodyLength: response.body.length } })
> 40 |       ).toBe(200);
     |         ^ Error: [Request] {"method":"GET","path":"/invoices/INV-2026000023/download-pdf","auth":"the new user's access_token"}
  41 |     });
  42 | 
  43 |     await test.step('Verify the Content-Disposition response header is "attachment; filename=<invoice_number>.pdf" with the invoice\'s number.', async () => {
  44 |       const expected = `attachment; filename=${invoiceNumber}.pdf`;
  45 |       expect(response.headers['content-disposition'], assertMessage({ request, expected: `Content-Disposition is "${expected}"`, actual: response.headers })).toBe(expected);
  46 |     });
  47 | 
  48 |     await test.step('Verify the response body is not empty.', async () => {
  49 |       expect(response.body.length > 0, assertMessage({ request, expected: 'The body is not empty', actual: { bodyLength: response.body.length } })).toBe(true);
  50 |     });
  51 |   });
  52 | 
  53 |   test('API-0469: Download invoice PDF without a token returns 401', async ({ invoicesClient }) => {
  54 |     await checkStatusAndMessage(
  55 |       'Send GET /invoices/{invoice_number}/download-pdf with a well-formed invoice number, without an Authorization header.',
  56 |       () => sendDownloadPdf(invoicesClient, TestConstants.invoices.unknownNumber, AUTH.none),
  57 |       401,
  58 |       'Unauthorized'
  59 |     );
  60 |   });
  61 | 
  62 |   test('API-0470: Download invoice PDF with an unknown invoice number returns 404', async ({ invoicesClientWithToken }) => {
  63 |     await checkStatusAndMessage(
  64 |       "Send GET /invoices/{invoice_number}/download-pdf with a well-formed invoice number that no invoice has and the default user's token.",
  65 |       () => sendDownloadPdf(invoicesClientWithToken, TestConstants.invoices.unknownNumber, AUTH.defaultUser),
  66 |       404,
  67 |       'Document not created. Try again later.'
  68 |     );
  69 |   });
  70 | });
  71 | 
```