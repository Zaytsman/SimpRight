import { BaseClient, type ApiResponse } from './BaseClient';
import type { PostcodeLookupQuery } from '../dto/postcode';

/** Postcode endpoints. Public: no token is needed. */
export class PostcodeClient extends BaseClient {
  /**
   * GET /postcode-lookup. Values are encoded with `encodeURIComponent` (a space is `%20`), a missing key isn't
   * sent, an empty string is sent as `key=` and an array as `key[]=value`. `accept: null` leaves out
   * `Accept: application/json`; `maxRedirects: 0` returns the 302 a failed validation gives without it.
   */
  async lookup(query: PostcodeLookupQuery, options?: { accept?: string | null; maxRedirects?: number }): Promise<ApiResponse> {
    const pairs: string[] = [];
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const item of value) pairs.push(`${key}[]=${encodeURIComponent(item)}`);
      } else {
        pairs.push(`${key}=${encodeURIComponent(value)}`);
      }
    }
    return this.executeRequest('GET', '/postcode-lookup', {
      query: pairs.join('&') || undefined,
      accept: options?.accept,
      maxRedirects: options?.maxRedirects,
    });
  }
}
