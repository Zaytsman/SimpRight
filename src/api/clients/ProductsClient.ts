import { BaseClient, type ApiResponse } from './BaseClient';
import type { CreateProductRequest, UpdateProductRequest } from '../dto/product';

export class ProductsClient extends BaseClient {
  async list(): Promise<ApiResponse> {
    return this.get('/products');
  }

  async search(query: string, page?: number): Promise<ApiResponse> {
    const params = new URLSearchParams({ q: query });
    if (page !== undefined) params.set('page', String(page));
    return this.get('/products/search', params.toString());
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

  async deleteById(productId: string): Promise<ApiResponse> {
    return this.delete(`/products/${productId}`);
  }

  async related(productId: string): Promise<ApiResponse> {
    return this.get(`/products/${productId}/related`);
  }
}
