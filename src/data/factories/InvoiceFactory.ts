import type { CreateGuestInvoiceRequest, CreateInvoiceRequest, PaymentMethod } from '../../api/dto/invoice';
import { PaymentFactory } from './PaymentFactory';
import { uniqueName } from './testDataUtils';

/** Column limits of the billing fields (`StoreInvoice`). */
const STREET_MAX = 70;
const CITY_MAX = 40;
const STATE_MAX = 40;
const COUNTRY_MAX = 40;
const POSTAL_CODE_MAX = 10;

/** `text` cut or padded with `x` to exactly `length` characters. */
function ofLength(text: string, length: number): string {
  return text.length >= length ? text.slice(0, length) : text + 'x'.repeat(length - text.length);
}

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

  /** A PATCH /invoices/{invoiceId} body: by default `cashOnDelivery`'s billing street only. */
  patchBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return { billing_street: InvoiceFactory.cashOnDelivery('').billing_street, ...overrides };
  },

  /** A PUT /invoices/{invoiceId}/status body; `status` is a string so the scenarios can send values the API rejects. */
  statusBody(status: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
    return { status, ...extra };
  },

  /** A gift card number of 15 characters, one short of the required 16. */
  shortGiftCardNumber(): string {
    return 'ABCD1234efgh567';
  },

  /** A valid body with another payment method and its details, billed like `cashOnDelivery`. */
  withPayment(cartId: string, paymentMethod: PaymentMethod, paymentDetails: Record<string, unknown>): CreateInvoiceRequest {
    return InvoiceFactory.cashOnDelivery(cartId, { payment_method: paymentMethod, payment_details: paymentDetails });
  },

  /** Bank transfer details within the payment table's limits (70, 70 and 40 characters). */
  bankTransferDetails(): Record<string, unknown> {
    return { ...PaymentFactory.bankTransfer() };
  },

  /** Credit card details within the payment table's limits (40, 10, 10 and 70 characters). */
  creditCardDetails(): Record<string, unknown> {
    return { ...PaymentFactory.creditCard() };
  },

  /** Buy-now-pay-later details: 6 monthly installments, as a string (at most 40 characters). */
  buyNowPayLaterDetails(): Record<string, unknown> {
    return { monthly_installments: '6' };
  },

  /** Gift card details: a 16-character alphanumeric number and a 4-character alphanumeric code, with any field replaced. */
  giftCardDetails(overrides: { gift_card_number?: string; validation_code?: string } = {}): Record<string, unknown> {
    return { ...PaymentFactory.giftCard(overrides) };
  },

  /**
   * Billing fields at their maximum lengths (street 70, city, state and country 40 each), unique per call. The country
   * isn't a known code, so no postcode format or lookup check applies (no postal code is sent).
   */
  maxLengthAddress(): Pick<CreateInvoiceRequest, 'billing_street' | 'billing_city' | 'billing_state' | 'billing_country'> {
    return {
      billing_street: ofLength(uniqueName('Street'), STREET_MAX),
      billing_city: ofLength(uniqueName('City'), CITY_MAX),
      billing_state: ofLength(uniqueName('State'), STATE_MAX),
      billing_country: ofLength(uniqueName('Country'), COUNTRY_MAX),
    };
  },

  /** A unique billing street within the limit (70), so a search by street finds only the test's invoice. */
  uniqueStreet(): string {
    return uniqueName('Street');
  },

  /** A billing street one character over the limit (71). */
  tooLongStreet(): string {
    return ofLength(uniqueName('Street'), STREET_MAX + 1);
  },

  /** A billing city one character over the limit (41). */
  tooLongCity(): string {
    return ofLength(uniqueName('City'), CITY_MAX + 1);
  },

  /** A billing state one character over the limit (41). */
  tooLongState(): string {
    return ofLength(uniqueName('State'), STATE_MAX + 1);
  },

  /** A billing country one character over the limit (41). */
  tooLongCountry(): string {
    return ofLength(uniqueName('Country'), COUNTRY_MAX + 1);
  },

  /** A billing postal code one character over the limit (11). */
  tooLongPostalCode(): string {
    return '1'.repeat(POSTAL_CODE_MAX + 1);
  },

  /** A billing street with the superscript digit four (U+2074), which the text fields reject. */
  superscriptStreet(): string {
    return 'Stephansplatz 1⁴';
  },

  /** The billing fields of an Amsterdam address whose postal code doesn't match the Dutch format ("ABCDE"). */
  mismatchedDutchPostcode(): Pick<CreateInvoiceRequest, 'billing_city' | 'billing_country' | 'billing_postal_code'> {
    return { billing_city: 'Amsterdam', billing_country: 'NL', billing_postal_code: 'ABCDE' };
  },

  /** The payment fields of a bank transfer with payment_details null, which the API should reject (BUG-041). */
  nullBankTransferDetails(): Record<string, unknown> {
    return { payment_method: 'bank-transfer', payment_details: null };
  },

  /** A valid POST /invoices/guest body: `cashOnDelivery` plus a unique guest email (example.com, never delivered) and names. */
  guest(cartId: string, overrides: Partial<CreateGuestInvoiceRequest> = {}): CreateGuestInvoiceRequest {
    return {
      ...InvoiceFactory.cashOnDelivery(cartId),
      guest_email: `${uniqueName('smpr-guest').toLowerCase()}@example.com`,
      guest_first_name: 'Jane',
      guest_last_name: 'Doe',
      ...overrides,
    };
  },
};
