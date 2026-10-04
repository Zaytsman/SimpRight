import { BaseClient, type ApiResponse } from './BaseClient';

/** Carts endpoints. Carts are anonymous: the UI keeps its cart id in `sessionStorage['cart_id']`, and no token is needed. */
export class CartsClient extends BaseClient {
  /** DELETE /carts/{cartId}: removes the cart with its items. */
  async deleteById(cartId: string): Promise<ApiResponse> {
    return this.delete(`/carts/${cartId}`);
  }
}
