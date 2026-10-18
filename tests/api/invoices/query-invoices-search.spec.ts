import { test, createCustomerInvoice, AUTH, sendQuerySearchInvoices, expectOnlyInvoice, type CustomerInvoice, type InvoiceRequest } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { Paginated } from '@api/dto/common';
import type { InvoiceSummary } from '@api/dto/invoice';
import { expectAcceptQuery, expectMessage, expectStatus } from '@utils/apiChecks';

// Scenarios: test-scenarios/api/invoices/query-invoices-search.yml

test.describe('@invoices-api - Invoices API', () => {
  test('API-0459: QUERY search by invoice number returns 200 with the matching invoice', async ({
    usersService,
    adminUsersService,
    authService,
    productsService,
    cartsService,
    invoicesServiceForToken,
    invoicesClientForToken,
    cleanup,
  }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;

    const setup: CustomerInvoice = await createCustomerInvoice({ usersService, adminUsersService, authService, productsService, cartsService, invoicesServiceForToken, cleanup });

    await test.step(
      'Send QUERY /invoices/search with that access_token, Content-Type: application/json, Accept: application/json and the body { "q": <the invoice\'s number> }.',
      async () => {
        ({ request, response } = await sendQuerySearchInvoices(invoicesClientForToken(setup.token), AUTH.newUser, { q: setup.invoice.invoice_number }));
      }
    );

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the Accept-Query response header is application/json.', async () => {
      expectAcceptQuery(request, response);
    });

    await test.step("Verify the body's total is 1 and data has exactly one item, whose id is the new invoice's id.", async () => {
      expectOnlyInvoice(request, JSON.parse(response.body) as Paginated<InvoiceSummary>, setup.invoice.id);
    });
  });

  test("API-0460: QUERY search with an empty body object returns 200 with the caller's invoices", async ({
    usersService,
    adminUsersService,
    authService,
    productsService,
    cartsService,
    invoicesServiceForToken,
    invoicesClientForToken,
    cleanup,
  }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;

    const setup: CustomerInvoice = await createCustomerInvoice({ usersService, adminUsersService, authService, productsService, cartsService, invoicesServiceForToken, cleanup });

    await test.step(
      'Send QUERY /invoices/search with that access_token, Content-Type: application/json, Accept: application/json and an empty JSON object as the body.',
      async () => {
        ({ request, response } = await sendQuerySearchInvoices(invoicesClientForToken(setup.token), AUTH.newUser, {}));
      }
    );

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's total is 1 and data has exactly one item, whose id is the new invoice's id.", async () => {
      expectOnlyInvoice(request, JSON.parse(response.body) as Paginated<InvoiceSummary>, setup.invoice.id);
    });
  });

  test('API-0461: QUERY search without a token returns 401', async ({ invoicesClient }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;

    await test.step(
      'Send QUERY /invoices/search without an Authorization header, with Content-Type: application/json, Accept: application/json and an empty JSON object as the body.',
      async () => {
        ({ request, response } = await sendQuerySearchInvoices(invoicesClient, AUTH.none, {}));
      }
    );

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test('API-0462: QUERY search without a JSON Content-Type returns 415', async ({ invoicesClientWithToken }) => {
    let request: InvoiceRequest;
    let response: ApiResponse;

    await test.step(
      "Send QUERY /invoices/search with the default user's token, Content-Type: text/plain, Accept: application/json and a plain-text body.",
      async () => {
        ({ request, response } = await sendQuerySearchInvoices(invoicesClientWithToken, AUTH.defaultUser, 'q=INV', 'text/plain'));
      }
    );

    await test.step('Verify the response status is 415.', async () => {
      expectStatus(request, response, 415);
    });
  });
});
