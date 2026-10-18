import { BaseClient, type ApiResponse, type RequestOptions } from './BaseClient';
import type { PostcodeLookupQuery } from '../dto/postcode';

/** Postcode endpoints. Public: no token is needed. */
export class PostcodeClient extends BaseClient {
  /**
   * GET /postcode-lookup. Values are encoded with `encodeURIComponent` (a space is `%20`, not `queryString`'s `+`), a
   * missing key isn't sent, an empty string is sent as `key=` and an array as `key[]=value`. `maxRedirects: 0` returns
   * the 302 a failed validation gives without `Accept: application/json`.
   */
  async lookup(query: PostcodeLookupQuery, options?: RequestOptions): Promise<ApiResponse> {
    const pairs: string[] = [];
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const item of value) pairs.push(`${key}[]=${encodeURIComponent(item)}`);
      } else {
        pairs.push(`${key}=${encodeURIComponent(value)}`);
      }
    }
    return this.executeRequest('GET', '/postcode-lookup', { query: pairs.join('&') || undefined, ...options });
  }
}
