import { BaseClient, type ApiResponse } from './BaseClient';
import type { CreateFavoriteRequest } from '../dto/favorite';

/** Favorites endpoints: every one acts on the favourites of the client's token's user. */
export class FavoritesClient extends BaseClient {
  /** `GET /favorites`: the user's favourites, each with its product. */
  async list(): Promise<ApiResponse> {
    return this.get('/favorites');
  }

  /** `POST /favorites`: adds a favourite (409 "Duplicate Entry" when the product already is one). */
  async create(body: CreateFavoriteRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.post('/favorites', body);
  }

  /** `DELETE /favorites/{favoriteId}`: removes one of the user's favourites. */
  async deleteById(favoriteId: string): Promise<ApiResponse> {
    return this.delete(`/favorites/${favoriteId}`);
  }
}
