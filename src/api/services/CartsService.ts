import type { CartsClient } from '../clients/CartsClient';
import { assertOk } from './serviceUtils';

/** Domain operations on carts. Methods expect success; tests that check error statuses use `CartsClient` directly. */
export class CartsService {
  constructor(private readonly client: CartsClient) {}

  /** Deletes a cart with its items. Returns nothing (204). A product can't be deleted while a cart holds it (409). */
  async delete(cartId: string): Promise<void> {
    assertOk(await this.client.deleteById(cartId), `delete cart ${cartId}`);
  }
}
