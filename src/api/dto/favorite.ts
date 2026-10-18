import type { Product } from './product';

/** Body of `POST /favorites`: the product to mark as a favourite of the token's user. */
export interface CreateFavoriteRequest {
  product_id: string;
}

/** The product of a favourite in `GET /favorites`: without `category` and `brand` (those relations aren't loaded). */
export interface FavoriteProduct extends Omit<Product, 'category' | 'brand' | 'in_stock'> {
  /** A number (the stock count) when the caller has an admin token. */
  in_stock: boolean | number;
}

/** A favourite as returned by the Favorites API. `GET /favorites` includes the product. */
export interface Favorite {
  id: string;
  user_id: string;
  product_id: string;
  /** Only in `GET /favorites`. */
  product?: FavoriteProduct;
}
