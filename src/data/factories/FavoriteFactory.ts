import type { CreateFavoriteRequest } from '../../api/dto/favorite';
import { TestConstants } from '../TestConstants';

/**
 * Payloads for the Favorites API. Never calls the API and never holds ids of seeded records: product and user ids are
 * looked up by a test step and passed in. The invalid payloads are plain objects, because they break the request type on purpose.
 */
export const FavoriteFactory = {
  /** A valid POST /favorites body for the product with this id. */
  addFavorite(productId: string): CreateFavoriteRequest {
    return { product_id: productId };
  },

  /** A POST /favorites body that also names a user (`user_id`): the API must ignore it and take the user from the token. */
  addFavoriteForUser(productId: string, userId: string): Record<string, unknown> {
    return { product_id: productId, user_id: userId };
  },

  /** A POST /favorites body without product_id: an empty JSON object. */
  withoutProductId(): Record<string, unknown> {
    return {};
  },

  /** A POST /favorites body whose product_id is a well-formed ULID that no product has. */
  unknownProduct(): CreateFavoriteRequest {
    return { product_id: TestConstants.products.unknownId };
  },
};
