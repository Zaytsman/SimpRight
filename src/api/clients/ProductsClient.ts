import { BaseClient, type ApiResponse } from './BaseClient';
import type { CreateProductRequest, PatchProductRequest, ProductListQuery, ProductQueryBody, ProductSearchQueryBody, UpdateProductRequest } from '../dto/product';

export class ProductsClient extends BaseClient {
  async list(query?: ProductListQuery): Promise<ApiResponse> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) params.set(key, String(value));
    }
    return this.get('/products', params.toString() || undefined);
  }

  /**
   * QUERY /products. An object body is sent as JSON with `Content-Type: application/json`; a string body is sent
   * as-is with `options.contentType` (for the 415 checks). `accept: null` leaves out `Accept: application/json`.
   */
  async queryList(body: ProductQueryBody | string, options?: { contentType?: string; accept?: string | null }): Promise<ApiResponse> {
    return typeof body === 'string'
      ? this.query('/products', { rawData: body, contentType: options?.contentType, accept: options?.accept })
      : this.query('/products', { data: body, contentType: options?.contentType ?? 'application/json', accept: options?.accept });
  }

  /**
   * QUERY /products/search. An object body is sent as JSON with `Content-Type: application/json`; a string body is
   * sent as-is with `options.contentType` (for the 415 checks). `accept: null` leaves out `Accept: application/json`.
   */
  async querySearch(body: ProductSearchQueryBody | string, options?: { contentType?: string; accept?: string | null }): Promise<ApiResponse> {
    return typeof body === 'string'
      ? this.query('/products/search', { rawData: body, contentType: options?.contentType, accept: options?.accept })
      : this.query('/products/search', { data: body, contentType: options?.contentType ?? 'application/json', accept: options?.accept });
  }

  /** Without `query`, no `q` is sent at all; an empty string sends `q=`. */
  async search(query?: string, page?: number): Promise<ApiResponse> {
    const params = new URLSearchParams();
    if (query !== undefined) params.set('q', query);
    if (page !== undefined) params.set('page', String(page));
    return this.get('/products/search', params.toString() || undefined);
  }

  async create(body: CreateProductRequest): Promise<ApiResponse> {
    return this.post('/products', body);
  }

  async getById(productId: string): Promise<ApiResponse> {
    return this.get(`/products/${productId}`);
  }

  /** Accepts any object as the body, so tests can send the invalid payloads validation scenarios need. */
  async update(productId: string, body: UpdateProductRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.put(`/products/${productId}`, { data: body });
  }

  /**
   * PATCH /products/{productId}. Named `partialUpdate` because `patch` is BaseClient's verb method.
   * Accepts any object as the body, so tests can send the invalid payloads validation scenarios need.
   */
  async partialUpdate(productId: string, body: PatchProductRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.patch(`/products/${productId}`, { data: body });
  }

  async deleteById(productId: string): Promise<ApiResponse> {
    return this.delete(`/products/${productId}`);
  }

  async related(productId: string): Promise<ApiResponse> {
    return this.get(`/products/${productId}/related`);
  }
}
