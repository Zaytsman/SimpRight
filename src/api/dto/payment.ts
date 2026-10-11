/** The `payment_method` values that `POST /payment/check` validates; any other value skips validation (200). */
export type PaymentMethod = 'bank-transfer' | 'cash-on-delivery' | 'credit-card' | 'buy-now-pay-later' | 'gift-card';

/** `payment_details` for `bank-transfer`. */
export interface BankTransferDetails {
  /** Letters and spaces, at most 255 characters. */
  bank_name: string;
  /** Letters, digits, spaces, `.`, `'` and `-`, at most 255 characters. */
  account_name: string;
  /** Digits only, at most 255 characters. */
  account_number: string;
}

/** `payment_details` for `credit-card`. */
export interface CreditCardDetails {
  /** `dddd-dddd-dddd-dddd`, dashes required. */
  credit_card_number: string;
  /** `m/Y` (e.g. `12/2030`), in a month after the current one. */
  expiration_date: string;
  /** 3 or 4 digits. */
  cvv: string;
  /** Letters and spaces, at most 255 characters. */
  card_holder_name: string;
}

/** `payment_details` for `buy-now-pay-later`. */
export interface BuyNowPayLaterDetails {
  /** Numeric (a number or a numeric string); the spec types it as a string. */
  monthly_installments: number;
}

/** `payment_details` for `gift-card`. */
export interface GiftCardDetails {
  /** Exactly 16 letters or digits. */
  gift_card_number: string;
  /** Exactly 4 letters or digits. */
  validation_code: string;
}

/** The object under `payment_details`: the fields of the chosen method (`{}` for cash on delivery). */
export type PaymentDetails = BankTransferDetails | CreditCardDetails | BuyNowPayLaterDetails | GiftCardDetails | Record<string, never>;

/** Body of `POST /payment/check`. Neither field is required by the API (an empty body gives 200). */
export interface PaymentCheckRequest {
  payment_method?: PaymentMethod;
  payment_details?: PaymentDetails;
}

/** `POST /payment/check` (200). */
export interface PaymentCheckResponse {
  /** "Payment was successful". */
  message: string;
}
