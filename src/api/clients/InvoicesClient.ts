import { BaseClient, type ApiResponse } from './BaseClient';
import type {
  CreateGuestInvoiceRequest,
  CreateInvoiceRequest,
  InvoiceSearchQueryBody,
  PatchInvoiceRequest,
  UpdateInvoiceRequest,
  UpdateInvoiceStatusRequest,
} from '../dto/invoice';

/** Invoices endpoints. Every one needs a token except `POST /invoices/guest`. */
export class InvoicesClient extends BaseClient {
  /** `GET /invoices`: a page of the token's user's invoices (every invoice for an admin), newest first, 15 per page. */
  async list(page?: number): Promise<ApiResponse> {
    return this.get('/invoices', page !== undefined ? `page=${page}` : undefined);
  }

  /**
   * `GET /invoices/search`: the caller's invoices (every invoice for an admin) whose number, billing street or status
   * contains `query`. Without `query`, no `q` is sent at all; an empty string sends `q=`.
   */
  async search(query?: string, page?: number): Promise<ApiResponse> {
    const params = new URLSearchParams();
    if (query !== undefined) params.set('q', query);
    if (page !== undefined) params.set('page', String(page));
    return this.get('/invoices/search', params.toString() || undefined);
  }

  /**
   * `QUERY /invoices/search`. An object body is sent as JSON with `Content-Type: application/json`; a string body is
   * sent as-is with `options.contentType` (for the 415 checks). `accept: null` leaves out `Accept: application/json`.
   */
  async querySearch(body: InvoiceSearchQueryBody | string, options?: { contentType?: string; accept?: string | null }): Promise<ApiResponse> {
    return typeof body === 'string'
      ? this.query('/invoices/search', { rawData: body, contentType: options?.contentType, accept: options?.accept })
      : this.query('/invoices/search', { data: body, contentType: options?.contentType ?? 'application/json', accept: options?.accept });
  }

  /** `GET /invoices/{invoiceId}`: one invoice with its lines and payment (own invoices only, or any for an admin). */
  async getById(invoiceId: string): Promise<ApiResponse> {
    return this.get(`/invoices/${invoiceId}`);
  }

  /** `GET /invoices/{invoice_number}/download-pdf`: the generated PDF file (the path takes the number, not the id). */
  async downloadPdf(invoiceNumber: string): Promise<ApiResponse> {
    return this.get(`/invoices/${invoiceNumber}/download-pdf`);
  }

  /** `GET /invoices/{invoice_number}/download-pdf-status`: the state of the invoice's PDF job. */
  async downloadPdfStatus(invoiceNumber: string): Promise<ApiResponse> {
    return this.get(`/invoices/${invoiceNumber}/download-pdf-status`);
  }

  /** `POST /invoices`: an invoice for the token's user from a cart. Accepts any object, for the validation scenarios. */
  async create(body: CreateInvoiceRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.post('/invoices', body);
  }

  /** `POST /invoices/guest`: an invoice without a user (no token needed). Accepts any object, for the validation scenarios. */
  async createGuest(body: CreateGuestInvoiceRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.post('/invoices/guest', body);
  }

  /** `PUT /invoices/{invoiceId}`: replaces the billing fields of the caller's own invoice. Accepts any object, for the validation scenarios. */
  async update(invoiceId: string, body: UpdateInvoiceRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.put(`/invoices/${invoiceId}`, { data: body });
  }

  /**
   * `PATCH /invoices/{invoiceId}`: changes some billing fields or the date of the caller's own invoice. Accepts any
   * object. Named `partialUpdate` because `patch` is BaseClient's verb method.
   */
  async partialUpdate(invoiceId: string, body: PatchInvoiceRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.patch(`/invoices/${invoiceId}`, { data: body });
  }

  /** `PUT /invoices/{invoiceId}/status`. Accepts any object, for the validation scenarios. */
  async updateStatus(invoiceId: string, body: UpdateInvoiceStatusRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.put(`/invoices/${invoiceId}/status`, { data: body });
  }
}
