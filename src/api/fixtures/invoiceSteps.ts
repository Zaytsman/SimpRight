import { test, expect } from '@playwright/test';
import type { Cleanup } from '../../fixtures/base';
import type { ApiResponse } from '../clients/BaseClient';
import type { InvoicesClient } from '../clients/InvoicesClient';
import type { Paginated } from '../dto/common';
import type {
  CreateGuestInvoiceRequest,
  CreateInvoiceRequest,
  Invoice,
  InvoiceCreated,
  InvoiceLine,
  InvoiceStatus,
  InvoiceSearchQueryBody,
  InvoiceSummary,
  PatchInvoiceRequest,
  PdfStatusResponse,
  UpdateInvoiceRequest,
  UpdateInvoiceStatusRequest,
} from '../dto/invoice';
import type { AuthService } from '../services/AuthService';
import type { CartsService } from '../services/CartsService';
import type { InvoicesService } from '../services/InvoicesService';
import type { ProductsService } from '../services/ProductsService';
import type { UsersService } from '../services/UsersService';
import { InvoiceFactory } from '../../data/factories/InvoiceFactory';
import { assertMessage, attachJson } from '../../utils/assertHelpers';
import { expectStatus, parseJson } from '../../utils/apiChecks';
import { AUTH, pageSummary, describePage, sendAndAttach } from './apiSteps';
import { addItemSetup, createCart } from './cartSteps';
import { firstListedProductId } from './productSteps';
import { loginThrowawayCustomer, registerThrowawayCustomer, type ThrowawayCustomer } from './userSteps';

/**
 * Steps shared by the Invoices specs (and the reports spec that completes an invoice). Invoices can't be deleted (no
 * DELETE route): the ones a test creates stay until the hourly re-seed, and so does a throwaway customer that holds one
 * (its admin delete gets 409, which `UsersService.deleteUnlessInUse` expects). Tests only read or change invoices they
 * created. The titles are the scenario steps verbatim; the variants pass their own title.
 */
const FIRST_PRODUCT_STEP = "Send GET /products and take the first item's id as the product's id.";
export const ADD_TWO_STEP = "Send POST /carts/{cartId} with the cart's id, the product's id as product_id and quantity 2.";
const INVOICE_CREATE_STEP =
  'Send POST /invoices with that access_token, payment_method "cash-on-delivery", payment_details {}, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT" and the cart\'s id as cart_id, and take the new invoice\'s id, invoice_number and total.';
export const PDF_STATUS_POLL_STEP =
  "Send GET /invoices/{invoice_number}/download-pdf-status with the invoice's number and that access_token, and repeat every few seconds until the response status is 200 and the body's status is COMPLETED (the PDF jobs run every minute, so allow a few minutes).";

/** The register and login steps of the scenarios with two customers (A holds the invoice, B tries to reach it). */
const CUSTOMER_A_REGISTER_STEP =
  "Send POST /users/register with a unique email, a first name, a last name and a random strong password (customer A), and take the new user's id.";
const CUSTOMER_A_LOGIN_STEP = "Send POST /users/login with customer A's email and password, and take its access_token.";
const CUSTOMER_B_REGISTER_STEP =
  "Send POST /users/register with a unique email, a first name, a last name and a random strong password (customer B), and take the new user's id.";
const CUSTOMER_B_LOGIN_STEP = "Send POST /users/login with customer B's email and password, and take its access_token.";
/** The most common wording of customer A's invoice-create step. */
const CUSTOMER_A_INVOICE_STEP =
  'Send POST /invoices with customer A\'s access_token, payment_method "cash-on-delivery", payment_details {}, billing_street "Stephansplatz 1", billing_city "Wien", billing_country "AT" and the cart\'s id as cart_id, and take the new invoice\'s id.';

export type InvoiceRequest = { method: string; path: string; auth: string; query?: Record<string, unknown>; body?: unknown };

/**
 * An invoice-create setup step (title `title`): creates the invoice through `invoicesService` (built with the
 * customer's token) and fails the step unless it succeeds. Nothing to clean up: invoices can't be deleted.
 */
export async function createInvoiceSetup(
  invoicesService: InvoicesService,
  cartId: string,
  title: string,
  auth: string,
  body: CreateInvoiceRequest = InvoiceFactory.cashOnDelivery(cartId)
): Promise<InvoiceCreated> {
  let created: InvoiceCreated | undefined;

  await test.step(title, async () => {
    const request: InvoiceRequest = { method: 'POST', path: '/invoices', auth, body };
    await attachJson('Create Invoice Request', request);
    const invoice = await invoicesService.create(body);
    await attachJson('Create Invoice Response', invoice);
    expect(
      typeof invoice.id === 'string' && invoice.id.length > 0 && typeof invoice.total === 'number',
      assertMessage({ request, expected: 'The new invoice has an id and a numeric total', actual: invoice })
    ).toBe(true);
    created = invoice;
  });

  return created!;
}

/**
 * A guest-invoice setup step (title `title`): creates the invoice through `invoicesService` (no token) and fails the
 * step unless it has an id and an invoice_number. Nothing to clean up: invoices can't be deleted.
 */
export async function createGuestInvoiceSetup(
  invoicesService: InvoicesService,
  cartId: string,
  title: string,
  body: CreateGuestInvoiceRequest = InvoiceFactory.guest(cartId)
): Promise<InvoiceCreated> {
  let created: InvoiceCreated | undefined;

  await test.step(title, async () => {
    const request: InvoiceRequest = { method: 'POST', path: '/invoices/guest', auth: AUTH.none, body };
    await attachJson('Create Guest Invoice Request', request);
    const invoice = await invoicesService.createGuest(body);
    await attachJson('Create Guest Invoice Response', invoice);
    expect(
      typeof invoice.id === 'string' && invoice.id.length > 0 && typeof invoice.invoice_number === 'string',
      assertMessage({ request, expected: 'The new invoice has an id and an invoice_number', actual: invoice })
    ).toBe(true);
    created = invoice;
  });

  return created!;
}

/**
 * A status-setting setup step (title `title`): sets the status (or sends the whole body `status`, e.g. a status_message
 * only) and fails the step unless `success` is true.
 */
export async function setInvoiceStatusSetup(
  invoicesService: InvoicesService,
  invoiceId: string,
  status: InvoiceStatus | UpdateInvoiceStatusRequest,
  title: string,
  auth: string
): Promise<void> {
  await test.step(title, async () => {
    const body: UpdateInvoiceStatusRequest = typeof status === 'string' ? { status } : status;
    const request: InvoiceRequest = { method: 'PUT', path: `/invoices/${invoiceId}/status`, auth, body };
    await attachJson('Update Invoice Status Request', request);
    const result = await invoicesService.updateStatus(invoiceId, body);
    await attachJson('Update Invoice Status Response', result);
    expect(result.success, assertMessage({ request, expected: 'success is true', actual: result })).toBe(true);
  });
}

/** The FIRST_PRODUCT_STEP step (or a variant `title`): returns the id of the first item of GET /products. */
export async function takeFirstProduct(productsService: ProductsService, title: string = FIRST_PRODUCT_STEP): Promise<string> {
  let productId = '';
  await test.step(title, async () => {
    productId = await firstListedProductId(productsService);
  });
  return productId;
}

/** The fixtures the invoice setup chain uses. */
export type InvoiceSetupFixtures = {
  usersService: UsersService;
  adminUsersService: UsersService;
  authService: AuthService;
  productsService: ProductsService;
  cartsService: CartsService;
  invoicesServiceForToken: (token: string) => InvoicesService;
  cleanup: Cleanup;
};

/** The fixtures `loggedInCustomer` uses. */
export type CustomerFixtures = Pick<InvoiceSetupFixtures, 'usersService' | 'adminUsersService' | 'authService' | 'cleanup'>;

/**
 * The register and login steps (titles verbatim, or the variants in `titles`): a throwaway customer that may come to
 * hold an invoice (removed as admin unless one holds it), logged in. Returns the customer with its access_token.
 */
export async function loggedInCustomer(
  { usersService, adminUsersService, authService, cleanup }: CustomerFixtures,
  titles: { register?: string; login?: string } = {}
): Promise<ThrowawayCustomer & { token: string }> {
  const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup, { title: titles.register, mayHoldInvoices: true });
  const token = await loginThrowawayCustomer(authService, customer, titles.login);
  return { ...customer, token };
}

/** A throwaway customer with one invoice, and what the setup took on the way. */
export interface CustomerInvoice {
  customer: ThrowawayCustomer;
  token: string;
  cartId: string;
  /** The product put in the cart, when `withProduct` was set. */
  productId?: string;
  invoice: InvoiceCreated;
}

/**
 * The setup steps most invoice scenarios start with, titles verbatim: register a throwaway customer (removed as admin
 * unless an invoice holds it), log it in, [take the first listed product,] create a cart, [add the product with quantity
 * 2,] and create a cash-on-delivery invoice with the customer's token. `withProduct` adds the bracketed steps, in the
 * order of API-0463; the titles can be replaced for other wordings.
 */
export async function createCustomerInvoice(
  { usersService, adminUsersService, authService, productsService, cartsService, invoicesServiceForToken, cleanup }: InvoiceSetupFixtures,
  options: {
    withProduct?: boolean;
    registerTitle?: string;
    loginTitle?: string;
    invoiceTitle?: string;
    /** The invoice body for the cart (default: `InvoiceFactory.cashOnDelivery`). */
    invoiceBody?: (cartId: string) => CreateInvoiceRequest;
  } = {}
): Promise<CustomerInvoice> {
  const { token, ...customer } = await loggedInCustomer(
    { usersService, adminUsersService, authService, cleanup },
    { register: options.registerTitle, login: options.loginTitle }
  );
  const productId = options.withProduct ? await takeFirstProduct(productsService) : undefined;
  const cartId = await createCart(cartsService, cleanup);
  if (productId) {
    await addItemSetup(cartsService, cartId, productId, 2, ADD_TWO_STEP);
  }
  const invoice = await createInvoiceSetup(
    invoicesServiceForToken(token),
    cartId,
    options.invoiceTitle ?? INVOICE_CREATE_STEP,
    AUTH.newUser,
    options.invoiceBody ? options.invoiceBody(cartId) : undefined
  );
  return { customer, token, cartId, productId, invoice };
}

/** Customer A with an invoice, and customer B with none, both logged in. */
export interface TwoCustomersInvoice {
  customerA: ThrowawayCustomer;
  tokenA: string;
  customerB: ThrowawayCustomer;
  tokenB: string;
  cartId: string;
  invoice: InvoiceCreated;
}

/**
 * The setup steps of the scenarios where customer B reaches for customer A's invoice, titles verbatim: register and log
 * in customer A (removed as admin unless its invoice holds it) and customer B, create a cart, and create a
 * cash-on-delivery invoice with A's token (title `invoiceTitle`, whose ending varies by scenario).
 */
export async function customerAWithInvoiceAndCustomerB(
  { usersService, adminUsersService, authService, cartsService, invoicesServiceForToken, cleanup }: Omit<InvoiceSetupFixtures, 'productsService'>,
  invoiceTitle: string = CUSTOMER_A_INVOICE_STEP
): Promise<TwoCustomersInvoice> {
  const customerA = await registerThrowawayCustomer(usersService, adminUsersService, cleanup, { title: CUSTOMER_A_REGISTER_STEP, mayHoldInvoices: true });
  const tokenA = await loginThrowawayCustomer(authService, customerA, CUSTOMER_A_LOGIN_STEP);
  const customerB = await registerThrowawayCustomer(usersService, adminUsersService, cleanup, { title: CUSTOMER_B_REGISTER_STEP });
  const tokenB = await loginThrowawayCustomer(authService, customerB, CUSTOMER_B_LOGIN_STEP);
  const cartId = await createCart(cartsService, cleanup);
  const invoice = await createInvoiceSetup(invoicesServiceForToken(tokenA), cartId, invoiceTitle, AUTH.customerA);
  return { customerA, tokenA, customerB, tokenB, cartId, invoice };
}

/** Sends POST /invoices with `invoicesClient` and attaches the request and the response. */
export async function sendCreateInvoice(
  invoicesClient: InvoicesClient,
  body: CreateInvoiceRequest | Record<string, unknown>,
  auth: string
): Promise<{ request: InvoiceRequest; response: ApiResponse }> {
  const request: InvoiceRequest = { method: 'POST', path: '/invoices', auth, body };
  return sendAndAttach('Create Invoice', request, () => invoicesClient.create(body));
}

/** Sends POST /invoices/guest with `invoicesClient` (no token) and attaches the request and the response. */
export async function sendCreateGuestInvoice(
  invoicesClient: InvoicesClient,
  body: CreateGuestInvoiceRequest | Record<string, unknown>
): Promise<{ request: InvoiceRequest; response: ApiResponse }> {
  const request: InvoiceRequest = { method: 'POST', path: '/invoices/guest', auth: AUTH.none, body };
  return sendAndAttach('Create Guest Invoice', request, () => invoicesClient.createGuest(body));
}

/**
 * Sends GET /invoices/{invoiceId} and attaches the request and the response. Tests read only invoices they created
 * (their own made-up addresses), so the body is attached as it came.
 */
export async function sendGetInvoice(invoicesClient: InvoicesClient, invoiceId: string, auth: string): Promise<{ request: InvoiceRequest; response: ApiResponse }> {
  const request: InvoiceRequest = { method: 'GET', path: `/invoices/${invoiceId}`, auth };
  return sendAndAttach('Get Invoice', request, () => invoicesClient.getById(invoiceId));
}

/**
 * The first half of a "Verify GET /invoices/{invoiceId} with the new id and <token> returns 200 with ..." step: reads
 * the invoice, checks the 200 and returns the request record and the parsed invoice for the step's other checks.
 */
export async function readInvoiceOk(invoicesClient: InvoicesClient, invoiceId: string, auth: string): Promise<{ request: InvoiceRequest; invoice: Invoice }> {
  const { request, response } = await sendGetInvoice(invoicesClient, invoiceId, auth);
  expectStatus(request, response, 200);
  return { request, invoice: parseJson<Invoice>(request, response) };
}

/**
 * What the list and search specs attach (and show as `actual`) for an invoice: no billing address or product details.
 * An admin's page holds other visitors' invoices, and the reports are public.
 */
export function invoiceSummary(invoice: Partial<InvoiceSummary>): Record<string, unknown> {
  return {
    id: invoice.id,
    user_id: invoice.user_id,
    invoice_number: invoice.invoice_number,
    invoice_date: invoice.invoice_date,
    status: invoice.status,
    subtotal: invoice.subtotal,
    total: invoice.total,
    lines: Array.isArray(invoice.invoicelines) ? invoice.invoicelines.length : invoice.invoicelines,
    payment_method: invoice.payment ? invoice.payment.payment_method : invoice.payment,
  };
}

/** `invoiceSummary` for a page: the pagination fields and the summary of each item. */
export function invoicePageSummary(page: Partial<Paginated<InvoiceSummary>>): Record<string, unknown> {
  return pageSummary(page, invoiceSummary);
}

/**
 * Sends GET /invoices (with `page` when given) and attaches the request and the response: a 2xx page as
 * `invoicePageSummary`, any other response with its body as it came (error bodies hold no visitor data).
 */
export async function sendListInvoices(invoicesClient: InvoicesClient, auth: string, page?: number): Promise<{ request: InvoiceRequest; response: ApiResponse }> {
  const request: InvoiceRequest = { method: 'GET', path: '/invoices', auth, ...(page !== undefined ? { query: { page } } : {}) };
  return sendAndAttach('List Invoices', request, () => invoicesClient.list(page), describePage(invoiceSummary));
}

/** Sends GET /invoices/search (`q` and `page` only when given) and attaches the request and the response like `sendListInvoices`. */
export async function sendSearchInvoices(
  invoicesClient: InvoicesClient,
  auth: string,
  q?: string,
  page?: number
): Promise<{ request: InvoiceRequest; response: ApiResponse }> {
  const query = { ...(q !== undefined ? { q } : {}), ...(page !== undefined ? { page } : {}) };
  const request: InvoiceRequest = { method: 'GET', path: '/invoices/search', auth, ...(Object.keys(query).length > 0 ? { query } : {}) };
  return sendAndAttach('Search Invoices', request, () => invoicesClient.search(q, page), describePage(invoiceSummary));
}

/**
 * Sends QUERY /invoices/search with `Accept: application/json` and attaches the request (with its Content-Type and
 * Accept) and the response like `sendListInvoices`. A string body is sent as-is with `contentType`.
 */
export async function sendQuerySearchInvoices(
  invoicesClient: InvoicesClient,
  auth: string,
  body: InvoiceSearchQueryBody | string,
  contentType: string = 'application/json'
): Promise<{ request: InvoiceRequest; response: ApiResponse }> {
  const request = { method: 'QUERY', path: '/invoices/search', auth, contentType, accept: 'application/json', body };
  return sendAndAttach('Query Search Invoices', request, () => invoicesClient.querySearch(body, { contentType }), describePage(invoiceSummary));
}

/** Sends PUT /invoices/{invoiceId} and attaches the request and the response (the caller's own invoice, or an error). */
export async function sendUpdateInvoice(
  invoicesClient: InvoicesClient,
  invoiceId: string,
  body: UpdateInvoiceRequest | Record<string, unknown>,
  auth: string
): Promise<{ request: InvoiceRequest; response: ApiResponse }> {
  const request: InvoiceRequest = { method: 'PUT', path: `/invoices/${invoiceId}`, auth, body };
  return sendAndAttach('Update Invoice', request, () => invoicesClient.update(invoiceId, body));
}

/** Sends PATCH /invoices/{invoiceId} and attaches the request and the response. */
export async function sendPatchInvoice(
  invoicesClient: InvoicesClient,
  invoiceId: string,
  body: PatchInvoiceRequest | Record<string, unknown>,
  auth: string
): Promise<{ request: InvoiceRequest; response: ApiResponse }> {
  const request: InvoiceRequest = { method: 'PATCH', path: `/invoices/${invoiceId}`, auth, body };
  return sendAndAttach('Patch Invoice', request, () => invoicesClient.partialUpdate(invoiceId, body));
}

/** Sends PUT /invoices/{invoiceId}/status and attaches the request and the response. */
export async function sendUpdateInvoiceStatus(
  invoicesClient: InvoicesClient,
  invoiceId: string,
  body: UpdateInvoiceStatusRequest | Record<string, unknown>,
  auth: string
): Promise<{ request: InvoiceRequest; response: ApiResponse }> {
  const request: InvoiceRequest = { method: 'PUT', path: `/invoices/${invoiceId}/status`, auth, body };
  return sendAndAttach('Update Invoice Status', request, () => invoicesClient.updateStatus(invoiceId, body));
}

/**
 * The checks of a "Verify the body's total is 1 and data has exactly one item, whose id is <the invoice's id> ..." step;
 * returns the item for the step's other checks. The page is shown as `invoicePageSummary` (no addresses).
 */
export function expectOnlyInvoice(request: unknown, page: Paginated<InvoiceSummary>, invoiceId: string): InvoiceSummary {
  const actual = invoicePageSummary(page);
  expect(page.total, assertMessage({ request, expected: 'total is 1', actual })).toBe(1);
  expect(Array.isArray(page.data) && page.data.length === 1, assertMessage({ request, expected: 'data has exactly one item', actual })).toBe(true);
  const item = page.data[0]!;
  expect(item.id, assertMessage({ request, expected: `The item's id is the invoice's id ${invoiceId}`, actual })).toBe(invoiceId);
  return item;
}

/** The checks of a "Verify the body's total is 0 and data is an empty array." step. */
export function expectEmptyInvoicePage(request: unknown, page: Paginated<InvoiceSummary>): void {
  const actual = invoicePageSummary(page);
  expect(page.total, assertMessage({ request, expected: 'total is 0', actual })).toBe(0);
  expect(Array.isArray(page.data) && page.data.length === 0, assertMessage({ request, expected: 'data is an empty array', actual })).toBe(true);
}

/** Sends GET /invoices/{invoice_number}/download-pdf and attaches the request, the status, the headers and the body's length (never the file). */
export async function sendDownloadPdf(invoicesClient: InvoicesClient, invoiceNumber: string, auth: string): Promise<{ request: InvoiceRequest; response: ApiResponse }> {
  const request: InvoiceRequest = { method: 'GET', path: `/invoices/${invoiceNumber}/download-pdf`, auth };
  return sendAndAttach('Download PDF', request, () => invoicesClient.downloadPdf(invoiceNumber), (response) => ({
    status: response.status,
    headers: response.headers,
    ...((response.headers['content-type'] ?? '').includes('json') ? { body: response.body } : { bodyLength: response.body.length }),
  }));
}

/** Sends GET /invoices/{invoice_number}/download-pdf-status and attaches the request and the response. */
export async function sendPdfStatus(invoicesClient: InvoicesClient, invoiceNumber: string, auth: string): Promise<{ request: InvoiceRequest; response: ApiResponse }> {
  const request: InvoiceRequest = { method: 'GET', path: `/invoices/${invoiceNumber}/download-pdf-status`, auth };
  return sendAndAttach('PDF Status', request, () => invoicesClient.downloadPdfStatus(invoiceNumber));
}

/** How long the PDF polls wait: the jobs run every minute, and the customer's token expires 300 s after its login. */
const PDF_POLL = { timeoutMs: 210_000, intervalMs: 5_000 } as const;

/**
 * The PDF_STATUS_POLL_STEP action: sends GET /invoices/{invoice_number}/download-pdf-status every `intervalMs` until it
 * answers 200 with status COMPLETED or `timeoutMs` has passed. It doesn't fail by itself: the Verify steps check the
 * last response, which it returns with its request. Every poll's status and body are attached as one summary.
 */
export async function pollPdfStatus(
  invoicesClient: InvoicesClient,
  invoiceNumber: string,
  auth: string,
  { timeoutMs, intervalMs }: { timeoutMs: number; intervalMs: number } = PDF_POLL
): Promise<{ request: InvoiceRequest; response: ApiResponse }> {
  const request: InvoiceRequest = { method: 'GET', path: `/invoices/${invoiceNumber}/download-pdf-status`, auth };
  const polls: { elapsedMs: number; status: number; body: string }[] = [];
  const start = Date.now();
  let response: ApiResponse | undefined;

  await attachJson('PDF Status Request', { ...request, intervalMs, timeoutMs });
  try {
    for (;;) {
      response = await invoicesClient.downloadPdfStatus(invoiceNumber);
      polls.push({ elapsedMs: Date.now() - start, status: response.status, body: response.body.slice(0, 200) });
      if (response.status === 200 && isCompleted(response)) break;
      if (Date.now() - start + intervalMs > timeoutMs) break;
      // The interval between polls of the API's own job state, as the step asks ("repeat every few seconds").
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  } finally {
    // Attached even when a poll request throws, so the report shows how far it got. A test timeout abandons the test
    // body without running this, so PDF_POLL stays well inside the PDF tests' 300 s timeout.
    await attachJson('PDF Status Polls', polls);
  }

  await attachJson('PDF Status Response', { status: response!.status, body: response!.body });
  return { request, response: response! };
}

function isCompleted(response: ApiResponse): boolean {
  try {
    return (JSON.parse(response.body) as Partial<PdfStatusResponse>).status === 'COMPLETED';
  } catch {
    return false;
  }
}

/** The checks of a "Verify the body has the keys ..." step: each key is present. */
export function expectKeys(request: unknown, body: object, keys: readonly string[]): void {
  for (const key of keys) {
    expect(key in body, assertMessage({ request, expected: `The body has the key "${key}"`, actual: Object.keys(body) })).toBe(true);
  }
}

/** The checks of a "... <fields> equal the values sent" part: each field of `body` equals the one in `sent`. */
export function expectFieldsEqual(request: unknown, body: object, sent: object, keys: readonly string[]): void {
  const actual = Object.fromEntries(keys.map((key) => [key, (body as Record<string, unknown>)[key]]));
  for (const key of keys) {
    const value = (sent as Record<string, unknown>)[key];
    expect(actual[key], assertMessage({ request, expected: `${key} is the value sent, ${JSON.stringify(value)}`, actual })).toBe(value);
  }
}

/**
 * The checks of "invoicelines has exactly one line with the product's id as product_id [and quantity <n>]"; returns the
 * line. Takes a full invoice or a list item (whose lines are untyped records).
 */
export function expectSingleInvoiceLine<Line extends { product_id?: unknown; quantity?: unknown } = InvoiceLine>(
  request: unknown,
  invoice: { invoicelines?: Line[] | null },
  productId: string,
  quantity?: number
): Line {
  const lines = Array.isArray(invoice.invoicelines) ? invoice.invoicelines : [];
  const actual = lines.map((line) => ({ product_id: line.product_id, quantity: line.quantity }));
  expect(lines.length, assertMessage({ request, expected: 'invoicelines has exactly one line', actual })).toBe(1);
  const line = lines[0]!;
  expect(line.product_id, assertMessage({ request, expected: `The line's product_id is the product's id ${productId}`, actual })).toBe(productId);
  if (quantity !== undefined) {
    expect(line.quantity, assertMessage({ request, expected: `The line's quantity is ${quantity}`, actual })).toBe(quantity);
  }
  return line;
}

/** The checks of a "... payment.payment_method "<method>"" part. */
export function expectPaymentMethod(request: unknown, invoice: Invoice, method: string): void {
  expect(invoice.payment?.payment_method, assertMessage({ request, expected: `payment.payment_method is "${method}"`, actual: invoice.payment })).toBe(method);
}

/** The checks of a "... payment.payment_details holding the <fields> sent" part: each sent field is stored with its value. */
export function expectPaymentDetails(request: unknown, invoice: Invoice, sent: Record<string, unknown>): void {
  const details = invoice.payment?.payment_details ?? null;
  for (const [key, value] of Object.entries(sent)) {
    expect(details?.[key], assertMessage({ request, expected: `payment.payment_details.${key} is the value sent, ${JSON.stringify(value)}`, actual: details })).toBe(value);
  }
}
