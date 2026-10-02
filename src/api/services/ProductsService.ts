import type { ApiResponse } from '../clients/BaseClient';
import type { ProductsClient } from '../clients/ProductsClient';
import type { Paginated } from '../dto/common';
import type { CreateProductRequest, Product, ProductDetails } from '../dto/product';

/**
 * Domain operations on products. Methods expect success and return parsed bodies;
 * tests that check error statuses use `ProductsClient` directly.
 */
export class ProductsService {
  constructor(private readonly client: ProductsClient) {}

  async list(): Promise<Paginated<Product>> {
    return parseOk(await this.client.list(), 'list products');
  }

  async search(query: string, page?: number): Promise<Paginated<Product>> {
    return parseOk(await this.client.search(query, page), `search products "${query}"`);
  }

  async getById(productId: string): Promise<ProductDetails> {
    return parseOk(await this.client.getById(productId), `get product ${productId}`);
  }

  async create(body: CreateProductRequest): Promise<Product> {
    return parseOk(await this.client.create(body), `create product "${body.name}"`);
  }

  /** Deletes a product (admin only: build this service with an admin token). Returns nothing (204). */
  async delete(productId: string): Promise<void> {
    assertOk(await this.client.deleteById(productId), `delete product ${productId}`);
  }
}

function assertOk(response: ApiResponse, action: string): void {
  if (!response.isSuccess) {
    throw new Error(`Failed to ${action}: ${response.status} ${response.statusText}. Body: ${response.body.slice(0, 200)}`);
  }
}

function parseOk<T>(response: ApiResponse, action: string): T {
  assertOk(response, action);
  return JSON.parse(response.body) as T;
}
