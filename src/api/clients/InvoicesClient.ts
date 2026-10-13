import { BaseClient, type ApiResponse } from './BaseClient';
import type { CreateInvoiceRequest, UpdateInvoiceStatusRequest } from '../dto/invoice';

/** Invoices endpoints. Every one needs a token except `POST /invoices/guest`. */
export class InvoicesClient extends BaseClient {
  /** `POST /invoices`: an invoice for the token's user from a cart. Accepts any object, for the validation scenarios. */
  async create(body: CreateInvoiceRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.post('/invoices', body);
  }

  /** `PUT /invoices/{invoiceId}/status`. Accepts any object, for the validation scenarios. */
  async updateStatus(invoiceId: string, body: UpdateInvoiceStatusRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.put(`/invoices/${invoiceId}/status`, { data: body });
  }
}
