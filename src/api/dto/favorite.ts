/** Body of `POST /favorites`: the product to mark as a favourite of the token's user. */
export interface CreateFavoriteRequest {
  product_id: string;
}

/** A favourite as returned by the Favorites API. `GET /favorites` includes the product. */
export interface Favorite {
  id: string;
  user_id: string;
  product_id: string;
  /** Only in `GET /favorites`. */
  product?: { id: string; name: string };
}
