import { BaseClient, type ApiResponse } from './BaseClient';
import type { BrandSearchQueryBody, CreateBrandRequest, UpdateBrandRequest } from '../dto/brand';

export class BrandsClient extends BaseClient {
  async list(): Promise<ApiResponse> {
    return this.get('/brands');
  }

  /** Accepts any object as the body, so tests can send the invalid payloads validation scenarios need. */
  async create(body: CreateBrandRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.post('/brands', body);
  }

  async getById(brandId: string): Promise<ApiResponse> {
    return this.get(`/brands/${brandId}`);
  }

  /** Accepts any object as the body, so tests can send the invalid payloads validation scenarios need. */
  async update(brandId: string, body: UpdateBrandRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.put(`/brands/${brandId}`, { data: body });
  }

  /**
   * PATCH /brands/{brandId}. Named `partialUpdate` because `patch` is BaseClient's verb method.
   * Accepts any object as the body, so tests can send the invalid payloads validation scenarios need.
   */
  async partialUpdate(brandId: string, body: UpdateBrandRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.patch(`/brands/${brandId}`, { data: body });
  }

  async deleteById(brandId: string): Promise<ApiResponse> {
    return this.delete(`/brands/${brandId}`);
  }

  /** Without `query`, no `q` is sent at all; an array sends `q[]=<value>` for each value (invalid input). */
  async search(query?: string | string[]): Promise<ApiResponse> {
    const params = new URLSearchParams();
    if (Array.isArray(query)) {
      for (const value of query) params.append('q[]', value);
    } else if (query !== undefined) {
      params.set('q', query);
    }
    return this.get('/brands/search', params.toString() || undefined);
  }

  /**
   * QUERY /brands/search. An object body is sent as JSON with `Content-Type: application/json`; a string body is
   * sent as-is with `options.contentType` (for the 415 checks). `accept: null` leaves out `Accept: application/json`.
   */
  async querySearch(body: BrandSearchQueryBody | string, options?: { contentType?: string; accept?: string | null }): Promise<ApiResponse> {
    return typeof body === 'string'
      ? this.query('/brands/search', { rawData: body, contentType: options?.contentType, accept: options?.accept })
      : this.query('/brands/search', { data: body, contentType: options?.contentType ?? 'application/json', accept: options?.accept });
  }
}
