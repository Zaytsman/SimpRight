import { BaseClient, queryString, type ApiResponse, type QueryBodyOptions } from './BaseClient';
import type { CreateProductRequest, PatchProductRequest, ProductListQuery, ProductQueryBody, ProductSearchQueryBody, UpdateProductRequest } from '../dto/product';

export class ProductsClient extends BaseClient {
  async list(query?: ProductListQuery): Promise<ApiResponse> {
    return this.get('/products', queryString({ ...query }));
  }

  /** QUERY /products, with `queryBody`'s handling of object and string bodies. */
  async queryList(body: ProductQueryBody | string, options?: QueryBodyOptions): Promise<ApiResponse> {
    return this.queryBody('/products', body, options);
  }

  /** QUERY /products/search, with `queryBody`'s handling of object and string bodies. */
  async querySearch(body: ProductSearchQueryBody | string, options?: QueryBodyOptions): Promise<ApiResponse> {
    return this.queryBody('/products/search', body, options);
  }

  /** Without `query`, no `q` is sent at all; an empty string sends `q=`. */
  async search(query?: string, page?: number): Promise<ApiResponse> {
    return this.get('/products/search', queryString({ q: query, page }));
  }

  async create(body: CreateProductRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.post('/products', { data: body });
  }

  async getById(productId: string): Promise<ApiResponse> {
    return this.get(`/products/${productId}`);
  }

  async update(productId: string, body: UpdateProductRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.put(`/products/${productId}`, { data: body });
  }

  /** PATCH /products/{productId}. */
  async partialUpdate(productId: string, body: PatchProductRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.patch(`/products/${productId}`, { data: body });
  }

  async deleteById(productId: string): Promise<ApiResponse> {
    return this.delete(`/products/${productId}`);
  }
}
