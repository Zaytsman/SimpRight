/** Invoice types (`Invoices_API.md`). Only what the tests use so far; extend with the Invoices scenarios. */

export type InvoiceStatus = 'AWAITING_FULFILLMENT' | 'ON_HOLD' | 'AWAITING_SHIPMENT' | 'SHIPPED' | 'COMPLETED';

export type PaymentMethod = 'bank-transfer' | 'cash-on-delivery' | 'credit-card' | 'buy-now-pay-later' | 'gift-card';

/** Body of `POST /invoices`. */
export interface CreateInvoiceRequest {
  payment_method: PaymentMethod;
  /** The key must be present; its fields depend on the method (`{}` for cash on delivery). */
  payment_details: Record<string, unknown>;
  billing_street: string;
  billing_city: string;
  billing_state?: string;
  billing_country: string;
  billing_postal_code?: string;
  invoice_date?: string;
  cart_id: string;
}

/** The `201` body of `POST /invoices` (the fields the tests read). */
export interface InvoiceCreated {
  id: string;
  user_id: string | null;
  invoice_number: string;
  total: number;
  [key: string]: unknown;
}

/** Body of `PUT /invoices/{invoiceId}/status`. */
export interface UpdateInvoiceStatusRequest {
  status?: InvoiceStatus;
  status_message?: string | null;
}

/** The `200` body of `PUT /invoices/{invoiceId}/status`. */
export interface UpdateInvoiceStatusResponse {
  success: boolean;
}
