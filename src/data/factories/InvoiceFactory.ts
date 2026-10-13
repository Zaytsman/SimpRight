import type { CreateInvoiceRequest } from '@api/dto/invoice';

/**
 * Payloads for the Invoices API. Never calls the API and never holds ids of seeded records: the cart id is created by a
 * test step and passed in.
 */
export const InvoiceFactory = {
  /**
   * A valid POST /invoices body paid cash on delivery, billed to Stephansplatz 1, Wien, AT (no postal code, so the
   * address isn't cross-checked against the postcode lookup).
   */
  cashOnDelivery(cartId: string, overrides: Partial<CreateInvoiceRequest> = {}): CreateInvoiceRequest {
    return {
      payment_method: 'cash-on-delivery',
      payment_details: {},
      billing_street: 'Stephansplatz 1',
      billing_city: 'Wien',
      billing_country: 'AT',
      cart_id: cartId,
      ...overrides,
    };
  },
};
