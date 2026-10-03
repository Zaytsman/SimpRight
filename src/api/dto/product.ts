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

/** PATCH /products/{productId}: only validated fields are applied, so `co2_rating` and `stock` aren't accepted. */
export type PatchProductRequest = Partial<Omit<CreateProductRequest, 'co2_rating' | 'stock'>>;

/** PUT and PATCH /products/{productId} on success. */
export interface UpdateProductResponse {
  success: boolean;
}

/** GET /products query parameters (filters, sorting, pagination); none is required. */
export interface ProductListQuery {
  /** Brand id, or several ids separated by commas. */
  by_brand?: string;
  /** Category id, or several ids separated by commas. */
  by_category?: string;
  /** Category slug; also matches its direct sub-categories. */
  by_category_slug?: string;
  /** `true` or `1` returns only rentals; anything else, or no value, only non-rentals. */
  is_rental?: string;
  /** Range filter, e.g. `price,10,30`. */
  between?: string;
  /** `<column>,<asc|desc>`, e.g. `price,desc`. */
  sort?: string;
  /** `true` or `1`: only products with CO2 rating A or B. */
  eco_friendly?: string;
  /** Name contains this text. */
  q?: string;
  /** `name:value1|value2,name2:value3`. */
  by_spec?: string;
  /** Page number, starting at 1. */
  page?: number;
}

/** QUERY /products body: the GET /products criteria as JSON (the API merges the keys into the query string). */
export interface ProductQueryBody extends Omit<ProductListQuery, 'page'> {
  /** Page number, starting at 1 (a string in the body). */
  page?: string;
}

/** QUERY /products/search body: the GET /products/search parameters as JSON; without `q` the result is empty. */
export interface ProductSearchQueryBody {
  /** Search term. */
  q?: string;
  /** Page number, starting at 1 (a string in the body). */
  page?: string;
}
