import { BaseClient, type ApiResponse } from './BaseClient';
import type { PaymentCheckRequest } from '../dto/payment';

/** Payment endpoints. Public: no token is needed, and an invalid one is ignored. */
export class PaymentClient extends BaseClient {
  /**
   * POST /payment/check: validates the details of the chosen payment method; stores nothing.
   * Accepts any object as the body, so tests can send the invalid payloads validation scenarios need.
   * `accept: null` leaves out `Accept: application/json`; `maxRedirects: 0` returns the 302 a failed
   * validation gives without it, instead of following it.
   */
  async check(
    body: PaymentCheckRequest | Record<string, unknown>,
    options?: { accept?: string | null; maxRedirects?: number }
  ): Promise<ApiResponse> {
    return this.executeRequest('POST', '/payment/check', { data: body, accept: options?.accept, maxRedirects: options?.maxRedirects });
  }
}
