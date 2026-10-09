/** Body of `POST /carts`. Both fields are optional (an empty body is fine); they decide the location discount. */
export interface CreateCartRequest {
  lat?: number;
  lng?: number;
}

/** `POST /carts` (201): the new cart's id. */
export interface CreateCartResponse {
  id: string;
}

/** Body of `POST /carts/{cartId}`: adds the product, or increases its quantity when it's already in the cart. */
export interface AddCartItemRequest {
  product_id: string;
  /** An integer from 1 to 99. */
  quantity: number;
}

/** `POST /carts/{cartId}` (200): no ids, read the cart to see the item. */
export interface CartItemResult {
  result: string;
}

/** `GET /carts/{cartId}`: the cart with its items, each with its product. */
export interface Cart {
  id: string;
  /** 15 when the cart holds a rental and a non-rental product, else null. */
  additional_discount_percentage: number | null;
  lat: number | null;
  lng: number | null;
  cart_items: CartItem[];
}

/** A line of a cart. */
export interface CartItem {
  id: string;
  quantity: number;
  /** Location discount: null when the cart has no coordinates, 0 when no city matches. */
  discount_percentage: number | null;
  cart_id: string;
  product_id: string;
  /** Only when discount_percentage is non-zero. */
  discounted_price?: number;
  product: CartProduct;
}

/** The product as loaded for a cart: no product_image, category or brand. */
export interface CartProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  is_location_offer: boolean;
  is_rental: boolean;
  co2_rating: string;
  /** A boolean, or the stock count (a number) when the caller has an admin token. */
  in_stock: boolean | number;
  is_eco_friendly: boolean;
}
