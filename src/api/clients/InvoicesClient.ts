import { BaseClient, type ApiResponse } from './BaseClient';
import type { CreateGuestInvoiceRequest, CreateInvoiceRequest, UpdateInvoiceStatusRequest } from '../dto/invoice';

/** Invoices endpoints. Every one needs a token except `POST /invoices/guest`. */
export class InvoicesClient extends BaseClient {
  /** `GET /invoices`: a page of the token's user's invoices (every invoice for an admin), newest first, 15 per page. */
  async list(page?: number): Promise<ApiResponse> {
    return this.get('/invoices', page !== undefined ? `page=${page}` : undefined);
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

  /** `PUT /invoices/{invoiceId}/status`. Accepts any object, for the validation scenarios. */
  async updateStatus(invoiceId: string, body: UpdateInvoiceStatusRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.put(`/invoices/${invoiceId}/status`, { data: body });
  }
}
