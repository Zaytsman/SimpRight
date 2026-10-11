import { BaseClient, type ApiResponse } from './BaseClient';
import type { CreateProductSpecRequest, UpdateProductSpecRequest } from '../dto/productSpec';

/**
 * Product specs: /products/{productId}/specs and /product-specs/names. The reads are public; POST, PUT and DELETE need a
 * token (any role).
 */
export class ProductSpecsClient extends BaseClient {
  /** `query` adds query parameters (the API ignores them). */
  async list(productId: string, query?: Record<string, string>): Promise<ApiResponse> {
    const params = new URLSearchParams(query ?? {});
    return this.get(`/products/${productId}/specs`, params.toString() || undefined);
  }

  /**
   * Accepts any object as the body, so tests can send the invalid payloads validation scenarios need.
   * `accept: null` leaves out `Accept: application/json`; `maxRedirects: 0` returns the 302 a failed validation
   * gives without it, instead of following it.
   */
  async create(
    productId: string,
    body: CreateProductSpecRequest | Record<string, unknown>,
    options?: { accept?: string | null; maxRedirects?: number }
  ): Promise<ApiResponse> {
    return this.executeRequest('POST', `/products/${productId}/specs`, { data: body, accept: options?.accept, maxRedirects: options?.maxRedirects });
  }

  async getById(productId: string, specId: string): Promise<ApiResponse> {
    return this.get(`/products/${productId}/specs/${specId}`);
  }

  /** Accepts any object as the body; `accept` and `maxRedirects` as in `create`. */
  async update(
    productId: string,
    specId: string,
    body: UpdateProductSpecRequest | Record<string, unknown>,
    options?: { accept?: string | null; maxRedirects?: number }
  ): Promise<ApiResponse> {
    return this.executeRequest('PUT', `/products/${productId}/specs/${specId}`, { data: body, accept: options?.accept, maxRedirects: options?.maxRedirects });
  }

  async deleteById(productId: string, specId: string): Promise<ApiResponse> {
    return this.delete(`/products/${productId}/specs/${specId}`);
  }

  /** GET /product-specs/names. */
  async names(): Promise<ApiResponse> {
    return this.get('/product-specs/names');
  }
}
