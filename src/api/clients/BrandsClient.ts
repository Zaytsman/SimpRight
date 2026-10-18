import { BaseClient, queryString, type ApiResponse, type QueryBodyOptions } from './BaseClient';
import type { BrandSearchQueryBody, CreateBrandRequest, UpdateBrandRequest } from '../dto/brand';

export class BrandsClient extends BaseClient {
  async list(): Promise<ApiResponse> {
    return this.get('/brands');
  }

  async create(body: CreateBrandRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.post('/brands', { data: body });
  }

  async getById(brandId: string): Promise<ApiResponse> {
    return this.get(`/brands/${brandId}`);
  }

  async update(brandId: string, body: UpdateBrandRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.put(`/brands/${brandId}`, { data: body });
  }

  /** PATCH /brands/{brandId}. */
  async partialUpdate(brandId: string, body: UpdateBrandRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.patch(`/brands/${brandId}`, { data: body });
  }

  async deleteById(brandId: string): Promise<ApiResponse> {
    return this.delete(`/brands/${brandId}`);
  }

  /** Without `query`, no `q` is sent at all; an array sends `q[]=<value>` for each value (invalid input). */
  async search(query?: string | string[]): Promise<ApiResponse> {
    return this.get('/brands/search', queryString({ q: query }));
  }

  /** QUERY /brands/search, with `queryBody`'s handling of object and string bodies. */
  async querySearch(body: BrandSearchQueryBody | string, options?: QueryBodyOptions): Promise<ApiResponse> {
    return this.queryBody('/brands/search', body, options);
  }
}
