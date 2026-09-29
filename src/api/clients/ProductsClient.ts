import { BaseClient, type ApiResponse } from './BaseClient';

export class ProductsClient extends BaseClient {
  async search(query: string, page?: number): Promise<ApiResponse> {
    const params = new URLSearchParams({ q: query });
    if (page !== undefined) params.set('page', String(page));
    return this.get('/products/search', params.toString());
  }

  async getById(productId: string): Promise<ApiResponse> {
    return this.get(`/products/${productId}`);
  }
}
