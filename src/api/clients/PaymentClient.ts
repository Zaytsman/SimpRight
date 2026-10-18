import { BaseClient, type ApiResponse, type RequestOptions } from './BaseClient';
import type { PaymentCheckRequest } from '../dto/payment';

/** Payment endpoints. Public: no token is needed, and an invalid one is ignored. */
export class PaymentClient extends BaseClient {
  /**
   * POST /payment/check: validates the details of the chosen payment method; stores nothing. `maxRedirects: 0` returns
   * the 302 a failed validation gives without `Accept: application/json`, instead of following it.
   */
  async check(body: PaymentCheckRequest | Record<string, unknown>, options?: RequestOptions): Promise<ApiResponse> {
    return this.executeRequest('POST', '/payment/check', { data: body, ...options });
  }
}
