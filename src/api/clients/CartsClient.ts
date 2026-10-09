import { BaseClient, type ApiResponse } from './BaseClient';
import type { AddCartItemRequest, CreateCartRequest } from '../dto/cart';

/** Carts endpoints. Carts are anonymous: the UI keeps its cart id in `sessionStorage['cart_id']`, and no token is needed. */
export class CartsClient extends BaseClient {
  /** POST /carts: creates an empty cart (201 with its id). An empty body is fine. */
  async create(body: CreateCartRequest | Record<string, unknown> = {}): Promise<ApiResponse> {
    return this.post('/carts', body);
  }

  /**
   * POST /carts/{cartId}: adds a product, or increases its quantity. Accepts any object as the body,
   * so tests can send the invalid payloads validation scenarios need.
   */
  async addItem(cartId: string, body: AddCartItemRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.post(`/carts/${cartId}`, body);
  }

  /** GET /carts/{cartId}: the cart with its items and their products. */
  async getById(cartId: string): Promise<ApiResponse> {
    return this.get(`/carts/${cartId}`);
  }

  /** DELETE /carts/{cartId}: removes the cart with its items. */
  async deleteById(cartId: string): Promise<ApiResponse> {
    return this.delete(`/carts/${cartId}`);
  }
}
