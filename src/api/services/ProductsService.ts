import type { ApiResponse } from '../clients/BaseClient';
import type { ProductsClient } from '../clients/ProductsClient';
import type { Paginated } from '../dto/common';
import type { Product } from '../dto/product';

/**
 * Domain operations on products. Methods expect success and return parsed bodies;
 * tests that check error statuses use `ProductsClient` directly.
 */
export class ProductsService {
  constructor(private readonly client: ProductsClient) {}

  async search(query: string, page?: number): Promise<Paginated<Product>> {
    return parseOk(await this.client.search(query, page), `search products "${query}"`);
  }

  async getById(productId: string): Promise<Product> {
    return parseOk(await this.client.getById(productId), `get product ${productId}`);
  }
}

function parseOk<T>(response: ApiResponse, action: string): T {
  if (!response.isSuccess) {
    throw new Error(`Failed to ${action}: ${response.status} ${response.statusText}. Body: ${response.body.slice(0, 200)}`);
  }
  return JSON.parse(response.body) as T;
}
