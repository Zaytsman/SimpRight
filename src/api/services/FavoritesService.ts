import type { FavoritesClient } from '../clients/FavoritesClient';
import type { Favorite } from '../dto/favorite';
import { assertOk, parseOk } from './serviceUtils';

/**
 * Domain operations on the favourites of the client's token's user. Methods expect success and return
 * parsed bodies; tests that check error statuses use `FavoritesClient` directly.
 */
export class FavoritesService {
  constructor(private readonly client: FavoritesClient) {}

  async list(): Promise<Favorite[]> {
    return parseOk(await this.client.list(), 'list favorites');
  }

  async add(productId: string): Promise<Favorite> {
    return parseOk(await this.client.create({ product_id: productId }), `add product ${productId} to favorites`);
  }

  /** Returns nothing (204). */
  async delete(favoriteId: string): Promise<void> {
    assertOk(await this.client.deleteById(favoriteId), `delete favorite ${favoriteId}`);
  }

  /** Removes every favourite of the user (a user with favourites can't be deleted: 409). */
  async deleteAll(): Promise<void> {
    for (const favorite of await this.list()) {
      await this.delete(favorite.id);
    }
  }
}
