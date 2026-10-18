import { BaseClient, queryString, type ApiResponse, type QueryBodyOptions } from './BaseClient';
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
    return this.get('/invoices', queryString({ page }));
  }

  /**
   * `GET /invoices/search`: the caller's invoices (every invoice for an admin) whose number, billing street or status
   * contains `query`. Without `query`, no `q` is sent at all; an empty string sends `q=`.
   */
  async search(query?: string, page?: number): Promise<ApiResponse> {
    return this.get('/invoices/search', queryString({ q: query, page }));
  }

  /** `QUERY /invoices/search`, with `queryBody`'s handling of object and string bodies. */
  async querySearch(body: InvoiceSearchQueryBody | string, options?: QueryBodyOptions): Promise<ApiResponse> {
    return this.queryBody('/invoices/search', body, options);
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

  /** `POST /invoices`: an invoice for the token's user from a cart. */
  async create(body: CreateInvoiceRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.post('/invoices', { data: body });
  }

  /** `POST /invoices/guest`: an invoice without a user (no token needed). */
  async createGuest(body: CreateGuestInvoiceRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.post('/invoices/guest', { data: body });
  }

  /** `PUT /invoices/{invoiceId}`: replaces the billing fields of the caller's own invoice. */
  async update(invoiceId: string, body: UpdateInvoiceRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.put(`/invoices/${invoiceId}`, { data: body });
  }

  /** `PATCH /invoices/{invoiceId}`: changes some billing fields or the date of the caller's own invoice. */
  async partialUpdate(invoiceId: string, body: PatchInvoiceRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.patch(`/invoices/${invoiceId}`, { data: body });
  }

  /** `PUT /invoices/{invoiceId}/status`. */
  async updateStatus(invoiceId: string, body: UpdateInvoiceStatusRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.put(`/invoices/${invoiceId}/status`, { data: body });
  }
}
