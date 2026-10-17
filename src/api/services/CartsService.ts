import type { CartsClient } from '../clients/CartsClient';
import type { AddCartItemRequest, Cart, CartItemResult, CreateCartRequest, CreateCartResponse } from '../dto/cart';
import { assertOk, parseOk } from './serviceUtils';

/** Domain operations on carts. Methods expect success; tests that check error statuses use `CartsClient` directly. */
export class CartsService {
  constructor(private readonly client: CartsClient) {}

  /** Creates a cart (an empty body is fine) and returns its id. Register `delete` in cleanup right after. */
  async create(body: CreateCartRequest = {}): Promise<CreateCartResponse> {
    return parseOk(await this.client.create(body), 'create cart');
  }

  /** Deletes a cart with its items. Returns nothing (204). A product can't be deleted while a cart holds it (409). */
  async delete(cartId: string): Promise<void> {
    assertOk(await this.client.deleteById(cartId), `delete cart ${cartId}`);
  }

  /** The cart with its items and their products. */
  async get(cartId: string): Promise<Cart> {
    return parseOk(await this.client.getById(cartId), `get cart ${cartId}`);
  }

  /** Adds a product to a cart (or increases its quantity), for setup steps; the response has no ids. */
  async addItem(cartId: string, body: AddCartItemRequest): Promise<CartItemResult> {
    return parseOk(await this.client.addItem(cartId, body), `add product ${body.product_id} to cart ${cartId}`);
  }

  /** Like `delete`, but a 404 counts as done: for cleanup of a cart the test itself may already have deleted. */
  async deleteIfExists(cartId: string): Promise<void> {
    const response = await this.client.deleteById(cartId);
    if (response.status === 404) return;
    assertOk(response, `delete cart ${cartId}`);
  }
}
