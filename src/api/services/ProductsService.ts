import type { ProductsClient } from '../clients/ProductsClient';
import type { Paginated } from '../dto/common';
import type { CreateProductRequest, Product, ProductDetails, ProductListQuery } from '../dto/product';
import { assertOk, parseOk } from './serviceUtils';

/**
 * Domain operations on products. Methods expect success and return parsed bodies;
 * tests that check error statuses use `ProductsClient` directly.
 */
export class ProductsService {
  constructor(private readonly client: ProductsClient) {}

  async list(query?: ProductListQuery): Promise<Paginated<Product>> {
    return parseOk(await this.client.list(query), 'list products');
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

  /**
   * Like `delete`, but a 404 counts as done: for cleanup of a product the test itself may already have deleted.
   * Admin only, like `delete`. Throws on any other non-2xx status.
   */
  async deleteIfExists(productId: string): Promise<void> {
    const response = await this.client.deleteById(productId);
    if (response.status === 404) return;
    assertOk(response, `delete product ${productId}`);
  }
}
