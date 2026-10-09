import type { CartsClient } from '../clients/CartsClient';
import type { CreateCartRequest, CreateCartResponse } from '../dto/cart';
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
}
