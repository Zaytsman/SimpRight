import type { InvoicesClient } from '../clients/InvoicesClient';
import type { CreateInvoiceRequest, InvoiceCreated, UpdateInvoiceStatusRequest, UpdateInvoiceStatusResponse } from '../dto/invoice';
import { parseOk } from './serviceUtils';

/**
 * Domain operations on invoices, for setup steps. Methods expect success and return parsed bodies; tests that check
 * statuses use `InvoicesClient` directly. There is no endpoint that deletes an invoice.
 */
export class InvoicesService {
  constructor(private readonly client: InvoicesClient) {}

  /** Creates an invoice for the token's user (201). */
  async create(body: CreateInvoiceRequest): Promise<InvoiceCreated> {
    return parseOk(await this.client.create(body), 'create invoice');
  }

  /** Sets an invoice's status (any logged-in user can, for any invoice). */
  async updateStatus(invoiceId: string, body: UpdateInvoiceStatusRequest): Promise<UpdateInvoiceStatusResponse> {
    return parseOk(await this.client.updateStatus(invoiceId, body), `update the status of invoice ${invoiceId}`);
  }
}
