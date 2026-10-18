import { BaseClient, type ApiResponse } from './BaseClient';
import type { AddCartItemRequest, CreateCartRequest, UpdateCartItemQuantityRequest } from '../dto/cart';

/** Carts endpoints. Carts are anonymous: the UI keeps its cart id in `sessionStorage['cart_id']`, and no token is needed. */
export class CartsClient extends BaseClient {
  /** POST /carts: creates an empty cart (201 with its id). An empty body is fine. */
  async create(body: CreateCartRequest | Record<string, unknown> = {}): Promise<ApiResponse> {
    return this.post('/carts', { data: body });
  }

  /** POST /carts/{cartId}: adds a product, or increases its quantity. */
  async addItem(cartId: string, body: AddCartItemRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.post(`/carts/${cartId}`, { data: body });
  }

  /** GET /carts/{cartId}: the cart with its items and their products. */
  async getById(cartId: string): Promise<ApiResponse> {
    return this.get(`/carts/${cartId}`);
  }

  /** PUT /carts/{cartId}/product/quantity: sets (replaces) the quantity of a product in the cart. */
  async updateQuantity(cartId: string, body: UpdateCartItemQuantityRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.put(`/carts/${cartId}/product/quantity`, { data: body });
  }

  /**
   * DELETE /carts/{cartId}/product/{productId}: removes the cart's line for this product (204, also when the product
   * isn't in the cart). `productId` is the product's id, not the cart item's.
   */
  async removeProduct(cartId: string, productId: string): Promise<ApiResponse> {
    return this.delete(`/carts/${cartId}/product/${productId}`);
  }

  /** DELETE /carts/{cartId}: removes the cart with its items. */
  async deleteById(cartId: string): Promise<ApiResponse> {
    return this.delete(`/carts/${cartId}`);
  }
}
