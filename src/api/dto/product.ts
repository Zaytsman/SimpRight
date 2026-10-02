export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  is_location_offer: boolean;
  is_rental: boolean;
  co2_rating: string;
  in_stock: boolean;
  is_eco_friendly: boolean;
  product_image: ProductImage;
  category: { id: string; name: string; slug: string };
  brand: { id: string; name: string };
}

/** A product's image, as returned in `product_image`. */
export interface ProductImage {
  id: string;
  by_name: string;
  by_url: string;
  source_name: string;
  source_url: string;
  file_name: string;
  title: string;
}

/** A product's specification, returned in `specs` by GET /products/{productId}. */
export interface ProductSpec {
  id: string;
  product_id: string;
  spec_name: string;
  spec_value: string;
  spec_unit: string | null;
}

/** GET /products/{productId}: the product with its category's parent and its specs. */
export interface ProductDetails extends Omit<Product, 'category' | 'in_stock'> {
  category: { id: string; name: string; slug: string; parent_id: string | null };
  /** A boolean, or the stock count (a number) when the caller has an admin token. */
  in_stock: boolean | number;
  specs: ProductSpec[];
}

/** An item of GET /products/{productId}/related: no co2_rating, and a category with id and name. */
export interface RelatedProduct extends Omit<Product, 'co2_rating' | 'category'> {
  category: { id: string; name: string };
}

/** POST /products. The ids must exist (an unknown one makes the API return 500). */
export interface CreateProductRequest {
  name: string;
  description?: string;
  price: number;
  category_id: string;
  brand_id: string;
  product_image_id: string;
  is_location_offer: boolean;
  is_rental: boolean;
  co2_rating?: string;
  stock?: number;
}

/** PUT /products/{productId}: no field is required. */
export type UpdateProductRequest = Partial<CreateProductRequest>;

/** PUT and PATCH /products/{productId} on success. */
export interface UpdateProductResponse {
  success: boolean;
}
