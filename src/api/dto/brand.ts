/** A brand, as returned by GET /brands, GET /brands/{brandId} and POST /brands (POST returns the keys as name, slug, id). */
export interface Brand {
  id: string;
  name: string;
  slug: string;
}

/** POST /brands: both fields required; slug is alpha_dash (ASCII), unique among brands, max 120 like the name. */
export interface CreateBrandRequest {
  name: string;
  slug: string;
}

/** PUT and PATCH /brands/{brandId}: no field is required. */
export type UpdateBrandRequest = Partial<CreateBrandRequest>;

/** QUERY /brands/search body; `q` is optional (no `q` returns every brand). An array is invalid input the 422 checks send. */
export interface BrandSearchQueryBody {
  q?: string | string[];
}
