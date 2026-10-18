import type { BankTransferDetails, CreditCardDetails, GiftCardDetails } from '../../api/dto/payment';

/**
 * Payment details for POST /payment/check, with the values of the payment scenarios. Never calls the API.
 * Nothing is stored by the check, so there are no unique names.
 */
export const PaymentFactory = {
  /** Valid bank transfer details ("Test Bank", "Jane Doe", "123456789"), with any field replaced. */
  bankTransfer(overrides: Partial<BankTransferDetails> = {}): BankTransferDetails {
    return { bank_name: 'Test Bank', account_name: 'Jane Doe', account_number: '123456789', ...overrides };
  },

  /** Valid credit card details (expiring the same month next year), with any field replaced. */
  creditCard(overrides: Partial<CreditCardDetails> = {}): CreditCardDetails {
    return {
      credit_card_number: '1234-5678-9101-1121',
      expiration_date: PaymentFactory.expirationDate(12),
      cvv: '123',
      card_holder_name: 'Jane Doe',
      ...overrides,
    };
  },

  /** Valid gift card details ("ABCD1234efgh5678", "1a2B"), with any field replaced. */
  giftCard(overrides: Partial<GiftCardDetails> = {}): GiftCardDetails {
    return { gift_card_number: 'ABCD1234efgh5678', validation_code: '1a2B', ...overrides };
  },

  /**
   * An expiry date in the API's `m/Y` form (`10/2027`), `monthOffset` months from the current month in UTC:
   * 12 is the same month next year, 0 the current month, -12 the same month one year ago.
   */
  expirationDate(monthOffset: number): string {
    const now = new Date();
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, 1));
    return `${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`;
  },
};
